// EPUB Parser for VibeReader

class EPUBParser {
    constructor() {
        this.zip = null;
        this.opfPath = null;
        this.manifest = {};
        this.spine = [];
        this.toc = [];
        this.metadata = {};
    }

    async parseFile(file) {
        try {
            // Load JSZip library dynamically if not available
            if (typeof JSZip === 'undefined') {
                await this.loadJSZip();
            }

            const arrayBuffer = await file.arrayBuffer();
            this.zip = await JSZip.loadAsync(arrayBuffer);

            // Find and parse container.xml
            await this.parseContainer();
            
            // Parse OPF file
            await this.parseOPF();
            
            // Parse NCX/NAV for table of contents
            await this.parseTOC();
            
            // Extract content
            const content = await this.extractContent();
            
            return {
                metadata: this.metadata,
                toc: this.toc,
                content: content,
                type: 'epub'
            };
        } catch (error) {
            console.error('Error parsing EPUB:', error);
            throw new Error('Failed to parse EPUB file: ' + error.message);
        }
    }

    async loadJSZip() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async parseContainer() {
        const containerFile = this.zip.file('META-INF/container.xml');
        if (!containerFile) {
            throw new Error('Invalid EPUB: Missing container.xml');
        }

        const containerXML = await containerFile.async('text');
        const parser = new DOMParser();
        const doc = parser.parseFromString(containerXML, 'text/xml');
        
        const rootfile = doc.querySelector('rootfile');
        if (!rootfile) {
            throw new Error('Invalid EPUB: No rootfile found');
        }

        this.opfPath = rootfile.getAttribute('full-path');
    }

    async parseOPF() {
        const opfFile = this.zip.file(this.opfPath);
        if (!opfFile) {
            throw new Error('Invalid EPUB: OPF file not found');
        }

        const opfXML = await opfFile.async('text');
        const parser = new DOMParser();
        const doc = parser.parseFromString(opfXML, 'text/xml');

        // Parse metadata
        this.parseMetadata(doc);
        
        // Parse manifest
        this.parseManifest(doc);
        
        // Parse spine
        this.parseSpine(doc);
    }

    parseMetadata(doc) {
        const metadata = doc.querySelector('metadata');
        if (!metadata) return;

        this.metadata = {
            title: this.getMetadataValue(metadata, 'title') || 'Unknown Title',
            creator: this.getMetadataValue(metadata, 'creator') || 'Unknown Author',
            language: this.getMetadataValue(metadata, 'language') || 'en',
            publisher: this.getMetadataValue(metadata, 'publisher') || '',
            date: this.getMetadataValue(metadata, 'date') || '',
            description: this.getMetadataValue(metadata, 'description') || '',
            identifier: this.getMetadataValue(metadata, 'identifier') || ''
        };
    }

    getMetadataValue(metadata, tagName) {
        const element = metadata.querySelector(tagName) || 
                      metadata.querySelector(`dc\\:${tagName}`) ||
                      metadata.querySelector(`[name="${tagName}"]`);
        return element ? element.textContent.trim() : null;
    }

    parseManifest(doc) {
        const manifestItems = doc.querySelectorAll('manifest item');
        manifestItems.forEach(item => {
            const id = item.getAttribute('id');
            const href = item.getAttribute('href');
            const mediaType = item.getAttribute('media-type');
            
            this.manifest[id] = {
                href: this.resolveHref(href),
                mediaType: mediaType
            };
        });
    }

    parseSpine(doc) {
        const spineItems = doc.querySelectorAll('spine itemref');
        spineItems.forEach(item => {
            const idref = item.getAttribute('idref');
            if (this.manifest[idref]) {
                this.spine.push({
                    id: idref,
                    href: this.manifest[idref].href,
                    linear: item.getAttribute('linear') !== 'no'
                });
            }
        });
    }

    async parseTOC() {
        // Try to find NCX file first
        const ncxItem = Object.values(this.manifest).find(item => 
            item.mediaType === 'application/x-dtbncx+xml'
        );

        if (ncxItem) {
            await this.parseNCX(ncxItem.href);
        } else {
            // Try to find NAV file (EPUB3)
            const navItem = Object.values(this.manifest).find(item => 
                item.mediaType === 'application/xhtml+xml' && 
                item.href.includes('nav')
            );
            
            if (navItem) {
                await this.parseNAV(navItem.href);
            } else {
                // Generate basic TOC from spine
                this.generateBasicTOC();
            }
        }
    }

    async parseNCX(ncxHref) {
        const ncxFile = this.zip.file(ncxHref);
        if (!ncxFile) return;

        const ncxXML = await ncxFile.async('text');
        const parser = new DOMParser();
        const doc = parser.parseFromString(ncxXML, 'text/xml');

        const navPoints = doc.querySelectorAll('navPoint');
        this.toc = Array.from(navPoints).map((navPoint, index) => {
            const label = navPoint.querySelector('navLabel text');
            const content = navPoint.querySelector('content');
            
            return {
                id: `toc-${index}`,
                title: label ? label.textContent.trim() : `Chapter ${index + 1}`,
                href: content ? this.resolveHref(content.getAttribute('src')) : '',
                level: this.getNavPointLevel(navPoint)
            };
        });
    }

    async parseNAV(navHref) {
        const navFile = this.zip.file(navHref);
        if (!navFile) return;

        const navHTML = await navFile.async('text');
        const parser = new DOMParser();
        const doc = parser.parseFromString(navHTML, 'text/html');

        const tocNav = doc.querySelector('nav[epub\\:type="toc"]') || 
                      doc.querySelector('nav#toc') ||
                      doc.querySelector('nav');

        if (tocNav) {
            const links = tocNav.querySelectorAll('a');
            this.toc = Array.from(links).map((link, index) => ({
                id: `toc-${index}`,
                title: link.textContent.trim() || `Chapter ${index + 1}`,
                href: this.resolveHref(link.getAttribute('href')),
                level: this.getLinkLevel(link)
            }));
        }
    }

    generateBasicTOC() {
        this.toc = this.spine.map((item, index) => ({
            id: `toc-${index}`,
            title: `Chapter ${index + 1}`,
            href: item.href,
            level: 1
        }));
    }

    async extractContent() {
        const content = [];
        
        for (const spineItem of this.spine) {
            if (!spineItem.linear) continue;
            
            const file = this.zip.file(spineItem.href);
            if (!file) continue;

            try {
                const html = await file.async('text');
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                // Clean up the HTML content
                await this.cleanupHTML(doc);
                
                content.push({
                    id: spineItem.id,
                    href: spineItem.href,
                    title: this.extractTitle(doc),
                    content: doc.body ? doc.body.innerHTML : html
                });
            } catch (error) {
                console.warn(`Failed to extract content from ${spineItem.href}:`, error);
            }
        }
        
        return content;
    }

    async cleanupHTML(doc) {
        // Remove script tags
        const scripts = doc.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        // Remove style tags (we'll use our own styling)
        const styles = doc.querySelectorAll('style');
        styles.forEach(style => style.remove());
        
        // Remove link tags for stylesheets
        const links = doc.querySelectorAll('link[rel="stylesheet"]');
        links.forEach(link => link.remove());
        
        // Convert relative image paths to data URLs if possible
        const images = doc.querySelectorAll('img');
        console.log(`Found ${images.length} images to process`);
        
        const imagePromises = Array.from(images).map(async (img, index) => {
            const src = img.getAttribute('src');
            console.log(`Processing image ${index + 1}: original src = "${src}"`);
            
            if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                const imagePath = this.resolveHref(src);
                console.log(`Resolved image path: "${imagePath}"`);
                
                // List all files in the EPUB to help debug
                const allFiles = Object.keys(this.zip.files);
                const imageFiles = allFiles.filter(f => f.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i));
                console.log(`Available image files in EPUB:`, imageFiles);
                
                const imageFile = this.zip.file(imagePath);
                if (imageFile) {
                    try {
                        console.log(`Found image file, extracting: ${imagePath}`);
                        const imageData = await imageFile.async('base64');
                        const mimeType = this.getMimeType(imagePath);
                        const dataUrl = `data:${mimeType};base64,${imageData}`;
                        img.src = dataUrl;
                        
                        // Add responsive styling and click handler
                        this.setupImageDisplay(img);
                        
                        console.log(`✅ Successfully converted image: ${imagePath} (${imageData.length} bytes)`);
                    } catch (error) {
                        console.error(`❌ Failed to load image ${imagePath}:`, error);
                        img.style.display = 'none';
                    }
                } else {
                    console.warn(`❌ Image file not found in EPUB: "${imagePath}"`);
                    console.log(`Trying alternative paths...`);
                    
                    // Try some alternative path resolutions
                    const alternatives = [
                        src, // Original path
                        src.replace(/^\.\//, ''), // Remove leading ./
                        src.replace(/^\//, ''), // Remove leading /
                        'images/' + src.split('/').pop(), // Try images/ directory
                        'OEBPS/' + src, // Try OEBPS prefix
                        'OEBPS/images/' + src.split('/').pop() // Try OEBPS/images/
                    ];
                    
                    let found = false;
                    for (const altPath of alternatives) {
                        const altFile = this.zip.file(altPath);
                        if (altFile) {
                            console.log(`✅ Found image at alternative path: ${altPath}`);
                            try {
                                const imageData = await altFile.async('base64');
                                const mimeType = this.getMimeType(altPath);
                                img.src = `data:${mimeType};base64,${imageData}`;
                                
                                // Add responsive styling and click handler
                                this.setupImageDisplay(img);
                                
                                found = true;
                                break;
                            } catch (error) {
                                console.warn(`Failed to load alternative path ${altPath}:`, error);
                            }
                        }
                    }
                    
                    if (!found) {
                        img.style.display = 'none';
                    }
                }
            } else {
                console.log(`Skipping image ${index + 1}: external or data URL`);
            }
        });
        
        // Wait for all image processing to complete
        await Promise.all(imagePromises);
        
        // Process endnotes if EndnoteHandler is available
        if (window.EndnoteHandler && window.app && window.app.endnoteHandler) {
            window.app.endnoteHandler.processEndnotes(doc.body || doc);
        }
    }

    extractTitle(doc) {
        const h1 = doc.querySelector('h1');
        const title = doc.querySelector('title');
        
        if (h1) return h1.textContent.trim();
        if (title) return title.textContent.trim();
        return '';
    }

    resolveHref(href) {
        if (!href) return '';
        
        // Remove fragment identifier
        const cleanHref = href.split('#')[0];
        
        // Resolve relative to OPF directory
        const opfDir = this.opfPath.substring(0, this.opfPath.lastIndexOf('/'));
        if (opfDir && !cleanHref.startsWith('/')) {
            return opfDir + '/' + cleanHref;
        }
        
        return cleanHref;
    }

    getNavPointLevel(navPoint) {
        let level = 1;
        let parent = navPoint.parentElement;
        while (parent && parent.tagName === 'navPoint') {
            level++;
            parent = parent.parentElement;
        }
        return level;
    }

    getLinkLevel(link) {
        let level = 1;
        let parent = link.parentElement;
        while (parent) {
            if (parent.tagName === 'OL' || parent.tagName === 'UL') {
                const parentList = parent.parentElement;
                if (parentList && (parentList.tagName === 'LI' || parentList.tagName === 'OL' || parentList.tagName === 'UL')) {
                    level++;
                }
            }
            parent = parent.parentElement;
        }
        return level;
    }

    setupImageDisplay(img) {
        // Add responsive styling
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '1rem auto';
        img.style.cursor = 'pointer';
        img.style.borderRadius = '4px';
        img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        img.style.transition = 'transform 0.2s ease';
        
        // Add hover effect
        img.addEventListener('mouseenter', () => {
            img.style.transform = 'scale(1.02)';
        });
        
        img.addEventListener('mouseleave', () => {
            img.style.transform = 'scale(1)';
        });
        
        // Add click handler for fullscreen
        img.addEventListener('click', (e) => {
            e.preventDefault();
            this.openImageFullscreen(img);
        });
    }
    
    openImageFullscreen(img) {
        // Create fullscreen overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            cursor: pointer;
        `;
        
        // Create fullscreen image
        const fullscreenImg = document.createElement('img');
        fullscreenImg.src = img.src;
        fullscreenImg.style.cssText = `
            max-width: 95vw;
            max-height: 95vh;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        
        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 30px;
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            font-size: 2rem;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s ease;
        `;
        
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.3)';
        });
        
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.2)';
        });
        
        // Add elements to overlay
        overlay.appendChild(fullscreenImg);
        overlay.appendChild(closeBtn);
        
        // Close handlers
        const closeFullscreen = () => {
            document.body.removeChild(overlay);
            document.body.style.overflow = '';
        };
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeFullscreen();
            }
        });
        
        closeBtn.addEventListener('click', closeFullscreen);
        
        // Escape key handler
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeFullscreen();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        
        document.addEventListener('keydown', escapeHandler);
        
        // Add to DOM
        document.body.style.overflow = 'hidden';
        document.body.appendChild(overlay);
    }

    getMimeType(filename) {
        const ext = filename.toLowerCase().split('.').pop();
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'webp': 'image/webp'
        };
        return mimeTypes[ext] || 'image/jpeg';
    }
}

// Export for use in other modules
window.EPUBParser = EPUBParser;
