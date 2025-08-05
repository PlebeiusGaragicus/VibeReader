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
                this.cleanupHTML(doc);
                
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

    cleanupHTML(doc) {
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
        images.forEach(async (img) => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                const imagePath = this.resolveHref(src);
                const imageFile = this.zip.file(imagePath);
                if (imageFile) {
                    try {
                        const imageData = await imageFile.async('base64');
                        const mimeType = this.getMimeType(imagePath);
                        img.src = `data:${mimeType};base64,${imageData}`;
                    } catch (error) {
                        console.warn(`Failed to load image ${imagePath}:`, error);
                    }
                }
            }
        });
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
