// Endnote Handler for VibeReader

class EndnoteHandler {
    constructor(app) {
        this.app = app;
        this.endnotes = new Map(); // Store endnote content
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Modal close events
        document.getElementById('closeEndnoteModal').addEventListener('click', () => {
            this.closeEndnoteModal();
        });

        document.getElementById('closeEndnoteBtn').addEventListener('click', () => {
            this.closeEndnoteModal();
        });

        // Close modal when clicking outside
        document.getElementById('endnoteModal').addEventListener('click', (e) => {
            if (e.target.id === 'endnoteModal') {
                this.closeEndnoteModal();
            }
        });

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('endnoteModal');
                if (!modal.classList.contains('hidden')) {
                    this.closeEndnoteModal();
                }
            }
        });

        // Global click handler to intercept endnote links
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && this.isEndnoteLinkElement(link)) {
                e.preventDefault();
                e.stopPropagation();
                
                const endnoteId = this.extractEndnoteIdFromLink(link);
                this.showEndnote(endnoteId);
            }
        }, true); // Use capture phase to intercept before other handlers
    }

    // Process endnotes in the content and convert links to modal triggers
    processEndnotes(contentElement) {
        // Find all endnote references (links that point to notes.htm or similar)
        const endnoteLinks = contentElement.querySelectorAll('a[href*="note"]');
        
        endnoteLinks.forEach((link, index) => {
            const href = link.getAttribute('href');
            
            // Check if this looks like an endnote reference
            if (this.isEndnoteReference(link)) {
                // Extract endnote number/id
                const endnoteId = this.extractEndnoteId(link, href);
                
                // Convert link to clickable endnote reference
                this.convertToEndnoteReference(link, endnoteId);
            }
        });

        // Also look for endnote content sections and extract them
        this.extractEndnoteContent(contentElement);
    }

    // Check if a link is an endnote reference
    isEndnoteReference(link) {
        const href = link.getAttribute('href');
        const text = link.textContent.trim();
        
        // Check for common endnote patterns
        return (
            href && (
                href.includes('notes.htm') ||
                href.includes('endnote') ||
                href.includes('#note') ||
                href.includes('#endnote')
            ) ||
            // Check if it's a superscript number
            (link.querySelector('sup') && /^\d+$/.test(text)) ||
            // Check if the text is just a number and parent has endnote-like attributes
            (/^\d+$/.test(text) && link.closest('[id*="endnote"]'))
        );
    }

    // Check if a link element should be treated as an endnote (for global click handler)
    isEndnoteLinkElement(link) {
        const href = link.getAttribute('href');
        
        // Check for common endnote URL patterns
        return href && (
            href.includes('notes.htm') ||
            href.includes('endnote_text_') ||
            href.includes('#endnote') ||
            href.includes('#note') ||
            // Check for relative paths that look like endnotes
            /\/notes?\.html?/i.test(href) ||
            /endnote/i.test(href)
        );
    }

    // Extract endnote ID from a link element (for global click handler)
    extractEndnoteIdFromLink(link) {
        const href = link.getAttribute('href');
        
        if (href) {
            // Try to extract from various href patterns
            const patterns = [
                /#endnote_text_(\d+)/i,
                /#note_(\d+)/i,
                /#endnote(\d+)/i,
                /endnote_text_(\d+)/i,
                /note_(\d+)/i,
                /notes\.htm#endnote_text_(\d+)/i
            ];
            
            for (const pattern of patterns) {
                const match = href.match(pattern);
                if (match) {
                    return match[1];
                }
            }
        }
        
        // Fallback: try to extract from link text or use a generated ID
        const text = link.textContent.trim();
        if (/^\d+$/.test(text)) {
            return text;
        }
        
        // Generate a fallback ID based on the href
        return `fallback_${href ? href.replace(/[^a-zA-Z0-9]/g, '_') : Date.now()}`;
    }

    // Extract endnote ID from link
    extractEndnoteId(link, href) {
        // Try to extract from href
        if (href) {
            const match = href.match(/#?(?:endnote_text_|note_|endnote)(\d+)/i);
            if (match) {
                return match[1];
            }
        }

        // Try to extract from link text
        const text = link.textContent.trim();
        if (/^\d+$/.test(text)) {
            return text;
        }

        // Try to extract from ID attributes
        const id = link.getAttribute('id') || link.closest('[id*="endnote"]')?.getAttribute('id');
        if (id) {
            const match = id.match(/endnote_reference_(\d+)/i);
            if (match) {
                return match[1];
            }
        }

        // Fallback: use link index
        return `ref_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }

    // Convert link to endnote reference
    convertToEndnoteReference(link, endnoteId) {
        // Create new endnote reference element
        const endnoteRef = document.createElement('span');
        endnoteRef.className = 'endnote-ref';
        endnoteRef.setAttribute('data-endnote-id', endnoteId);
        endnoteRef.innerHTML = link.innerHTML; // Preserve original content (like <sup>)
        endnoteRef.title = `Click to view endnote ${endnoteId}`;

        // Add click handler
        endnoteRef.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showEndnote(endnoteId);
        });

        // Replace the original link
        link.parentNode.replaceChild(endnoteRef, link);
    }

    // Extract endnote content from the document
    extractEndnoteContent(contentElement) {
        // Look for endnote content sections
        const endnoteSections = contentElement.querySelectorAll(
            '[id*="endnote_text"], [class*="endnote"], [class*="footnote"], .notes'
        );

        endnoteSections.forEach(section => {
            const id = section.getAttribute('id');
            if (id) {
                const match = id.match(/endnote_text_(\d+)/i);
                if (match) {
                    const endnoteId = match[1];
                    this.endnotes.set(endnoteId, section.innerHTML);
                    
                    // Hide the original endnote section since we'll show it in modal
                    section.style.display = 'none';
                }
            }
        });

        // Also look for structured endnote lists
        const endnoteLists = contentElement.querySelectorAll('ol li, ul li');
        endnoteLists.forEach((item, index) => {
            const parent = item.parentElement;
            if (parent && (
                parent.id?.includes('endnote') ||
                parent.className?.includes('endnote') ||
                parent.className?.includes('notes')
            )) {
                // Extract endnote number from item
                const endnoteId = this.extractEndnoteIdFromListItem(item, index + 1);
                this.endnotes.set(endnoteId, item.innerHTML);
                
                // Hide the original list
                parent.style.display = 'none';
            }
        });
    }

    // Extract endnote ID from list item
    extractEndnoteIdFromListItem(item, fallbackIndex) {
        // Look for number at the beginning of the text
        const text = item.textContent.trim();
        const match = text.match(/^(\d+)\.?\s/);
        if (match) {
            return match[1];
        }

        // Use fallback index
        return fallbackIndex.toString();
    }

    // Show endnote in modal
    showEndnote(endnoteId) {
        const modal = document.getElementById('endnoteModal');
        const titleElement = document.getElementById('endnoteTitle');
        const contentElement = document.getElementById('endnoteContent');

        // Get endnote content
        let content = this.endnotes.get(endnoteId);
        
        if (!content) {
            // Try to find endnote content in the current document
            content = this.findEndnoteInDocument(endnoteId);
        }
        
        if (!content) {
            // Fallback: create informative message with debug info
            const availableEndnotes = Array.from(this.endnotes.keys()).join(', ');
            content = `
                <p><strong>Endnote ${endnoteId}</strong></p>
                <p>The content for this endnote could not be found in the current book.</p>
                <p><em>This may be because:</em></p>
                <ul>
                    <li>The endnote content is in a separate file that wasn't loaded</li>
                    <li>The endnote format is not recognized by the parser</li>
                    <li>The endnote reference doesn't match the content structure</li>
                </ul>
                ${availableEndnotes ? `<p><small>Available endnotes: ${availableEndnotes}</small></p>` : ''}
            `;
        }

        // Update modal content
        titleElement.textContent = `📝 Endnote ${endnoteId}`;
        contentElement.innerHTML = content;

        // Show modal
        modal.classList.remove('hidden');

        // Focus the close button for accessibility
        document.getElementById('closeEndnoteBtn').focus();
        
        // Debug logging
        console.log(`Showing endnote ${endnoteId}, available endnotes:`, Array.from(this.endnotes.keys()));
    }

    // Try to find endnote content in the current document
    findEndnoteInDocument(endnoteId) {
        const readingContainer = document.getElementById('readingContainer');
        if (!readingContainer) return null;
        
        // Try various selectors to find endnote content
        const selectors = [
            `#endnote_text_${endnoteId}`,
            `#endnote${endnoteId}`,
            `#note_${endnoteId}`,
            `#note${endnoteId}`,
            `[id*="endnote_text_${endnoteId}"]`,
            `[id*="endnote${endnoteId}"]`
        ];
        
        for (const selector of selectors) {
            const element = readingContainer.querySelector(selector);
            if (element) {
                // Store the found content for future use
                const content = element.innerHTML;
                this.endnotes.set(endnoteId, content);
                return content;
            }
        }
        
        // Try to find by text content patterns
        const allElements = readingContainer.querySelectorAll('p, div, li, span');
        for (const element of allElements) {
            const text = element.textContent.trim();
            // Look for elements that start with the endnote number
            if (text.match(new RegExp(`^${endnoteId}\.?\s`))) {
                const content = element.innerHTML;
                this.endnotes.set(endnoteId, content);
                return content;
            }
        }
        
        return null;
    }

    // Close endnote modal
    closeEndnoteModal() {
        const modal = document.getElementById('endnoteModal');
        modal.classList.add('hidden');
    }

    // Clear all endnotes (when loading new book)
    clearEndnotes() {
        this.endnotes.clear();
    }

    // Get endnote count
    getEndnoteCount() {
        return this.endnotes.size;
    }

    // Debug method to list all endnotes
    listEndnotes() {
        console.log('Available endnotes:', Array.from(this.endnotes.keys()));
        return Array.from(this.endnotes.entries());
    }
}

// Export for use in other modules
window.EndnoteHandler = EndnoteHandler;
