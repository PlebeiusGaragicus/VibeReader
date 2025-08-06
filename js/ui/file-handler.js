// File Handler for VibeReader

class FileHandler {
    constructor(app) {
        this.app = app;
        this.currentBook = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const browseBtn = document.getElementById('browseBtn');
        const fileUploadArea = document.getElementById('fileUploadArea');

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });

        // Browse button click
        browseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click();
        });

        // Drag and drop
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('drag-over');
        });

        fileUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('drag-over');
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });

        // Click to upload
        fileUploadArea.addEventListener('click', () => {
            fileInput.click();
        });
    }

    async handleFile(file) {
        try {
            // Show loading overlay
            this.showLoading('Processing your book...');

            // Validate file type
            const fileExtension = file.name.toLowerCase().split('.').pop();
            if (!['epub', 'mobi'].includes(fileExtension)) {
                throw new Error('Unsupported file format. Please upload an EPUB or MOBI file.');
            }

            // Parse the file
            let bookData;
            if (fileExtension === 'epub') {
                const parser = new EPUBParser();
                bookData = await parser.parseFile(file);
            } else if (fileExtension === 'mobi') {
                const parser = new MOBIParser();
                bookData = await parser.parseFile(file);
            }

            // Generate book ID
            const bookId = this.generateBookId(file.name, bookData.metadata);
            
            // Clear other books but preserve user data (notes, highlights, ask answers)
            this.app.storage.clearOtherBooks(bookId);
            
            // Store book data
            this.app.storage.saveBookData(bookId, {
                filename: file.name,
                uploadDate: new Date().toISOString(),
                ...bookData
            });
            
            // Save as last book
            this.app.storage.saveLastBook(bookId);

            // Load the book
            await this.loadBook(bookId, bookData);

            this.hideLoading();
            
        } catch (error) {
            this.hideLoading();
            this.showError('Failed to load book: ' + error.message);
            console.error('File handling error:', error);
        }
    }

    async loadBook(bookId, bookData) {
        this.currentBook = {
            id: bookId,
            ...bookData
        };

        // Update UI
        this.updateHeader(bookData.metadata);
        this.populateTableOfContents(bookData.toc);
        this.loadContent(bookData.content);
        this.loadUserData(bookId);

        // Enable AI features
        this.enableAIFeatures();

        // Update upload area
        this.updateUploadArea(bookData.metadata);

        // Restore scroll position if scroll manager is available
        if (this.app.scrollManager) {
            this.app.scrollManager.restoreScrollPosition(bookId);
        }
    }

    async loadBookFromData(bookId, bookData) {
        try {
            // Show loading overlay
            this.showLoading('Loading your book...');
            
            // Save as last book
            this.app.storage.saveLastBook(bookId);
            
            // Load the book
            await this.loadBook(bookId, bookData);
            
            this.hideLoading();
            
            console.log('Book loaded from storage:', bookData.metadata?.title);
            
        } catch (error) {
            this.hideLoading();
            this.showError('Failed to load book: ' + error.message);
            console.error('Book loading error:', error);
            throw error;
        }
    }

    updateHeader(metadata) {
        const headerCenter = document.querySelector('.header-center');
        headerCenter.innerHTML = `
            <div class="book-info">
                <h2 class="book-title">${this.escapeHTML(metadata.title)}</h2>
                <p class="book-author">by ${this.escapeHTML(metadata.creator)}</p>
            </div>
        `;
    }

    populateTableOfContents(toc) {
        const tocContainer = document.getElementById('tocContainer');
        
        if (!toc || toc.length === 0) {
            tocContainer.innerHTML = '<div class="no-book-message"><p>No table of contents available</p></div>';
            return;
        }

        const tocHTML = toc.map((item, index) => `
            <div class="toc-item ${item.level === 1 ? 'chapter' : 'section'}" 
                 data-href="${item.href}" 
                 data-index="${index}"
                 style="margin-left: ${(item.level - 1) * 1}rem">
                ${this.escapeHTML(item.title)}
            </div>
        `).join('');

        tocContainer.innerHTML = tocHTML;

        // Add click listeners
        tocContainer.querySelectorAll('.toc-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.navigateToChapter(index);
            });
        });
    }

    loadContent(content) {
        const readingContainer = document.getElementById('readingContainer');
        
        if (!content || content.length === 0) {
            readingContainer.innerHTML = '<div class="no-content"><p>No content available</p></div>';
            return;
        }

        // Create content HTML
        const contentHTML = content.map((chapter, index) => `
            <div class="chapter" id="chapter-${index}" data-chapter="${index}">
                ${chapter.title ? `<h2 class="chapter-title">${this.escapeHTML(chapter.title)}</h2>` : ''}
                <div class="chapter-content">${chapter.content}</div>
            </div>
        `).join('');

        readingContainer.innerHTML = contentHTML;
        
        // Handle image loading errors to prevent 404 console spam
        this.handleImageErrors(readingContainer);
    }
    
    handleImageErrors(container) {
        const images = container.querySelectorAll('img');
        images.forEach(img => {
            img.addEventListener('error', (e) => {
                // Replace broken images with a placeholder or hide them
                e.target.style.display = 'none';
                console.warn(`Image not found: ${e.target.src}`);
            });
            
            // Add loading attribute for better performance
            img.setAttribute('loading', 'lazy');
        });
    }

    loadUserData(bookId) {
        // Load highlights
        const highlights = this.app.storage.getHighlights(bookId);
        this.app.sidebar.displayHighlights(highlights);

        // Load notes
        const notes = this.app.storage.getNotes(bookId);
        this.app.sidebar.displayNotes(notes);

        // Load Q&A history
        const qaHistory = this.app.storage.getQAHistory(bookId);
        this.app.sidebar.displayQAHistory(qaHistory);

        // Load Ask Answers
        const askAnswers = this.app.storage.getAskAnswers(bookId);
        this.app.sidebar.displayAskAnswers(askAnswers);

        // Apply highlights to content
        this.applyHighlights(highlights);
        
        // Apply notes to content
        this.applyNotes(notes);
    }

    applyHighlights(highlights) {
        highlights.forEach(highlight => {
            try {
                // Check if highlight already exists in DOM
                const existingElement = document.querySelector(`[data-highlight-id="${highlight.id}"]`);
                if (existingElement) {
                    return; // Already applied
                }
                
                // Apply highlight by finding and wrapping the text
                this.applyHighlightToText(highlight);
            } catch (error) {
                console.warn('Failed to apply highlight:', error);
            }
        });
    }

    applyHighlightToText(highlight) {
        const readingContainer = document.getElementById('readingContainer');
        if (!readingContainer || !highlight.text) return;

        // Find text nodes containing the highlighted text
        const walker = document.createTreeWalker(
            readingContainer,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            const text = node.textContent;
            const index = text.indexOf(highlight.text);
            
            if (index !== -1) {
                // Found the text, wrap it with highlight
                const parent = node.parentNode;
                const beforeText = text.substring(0, index);
                const highlightText = text.substring(index, index + highlight.text.length);
                const afterText = text.substring(index + highlight.text.length);
                
                const fragment = document.createDocumentFragment();
                
                if (beforeText) {
                    fragment.appendChild(document.createTextNode(beforeText));
                }
                
                const highlightSpan = document.createElement('span');
                highlightSpan.className = 'text-highlight';
                highlightSpan.setAttribute('data-highlight-id', highlight.id);
                highlightSpan.setAttribute('title', `Highlighted on ${new Date(highlight.timestamp).toLocaleDateString()}`);
                highlightSpan.textContent = highlightText;
                fragment.appendChild(highlightSpan);
                
                if (afterText) {
                    fragment.appendChild(document.createTextNode(afterText));
                }
                
                parent.replaceChild(fragment, node);
                break; // Only highlight the first occurrence
            }
        }
    }

    applyNotes(notes) {
        notes.forEach(note => {
            try {
                // Check if note already exists in DOM
                const existingElement = document.querySelector(`[data-note-id="${note.id}"]`);
                if (existingElement) {
                    return; // Already applied
                }
                
                // Apply note highlight by finding and wrapping the text
                this.applyNoteToText(note);
            } catch (error) {
                console.warn('Failed to apply note:', error);
            }
        });
    }

    applyNoteToText(note) {
        const readingContainer = document.getElementById('readingContainer');
        if (!readingContainer || !note.selectedText) return;

        // Find text nodes containing the note text
        const walker = document.createTreeWalker(
            readingContainer,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            const text = node.textContent;
            const index = text.indexOf(note.selectedText);
            
            if (index !== -1) {
                // Found the text, wrap it with note highlight
                const parent = node.parentNode;
                const beforeText = text.substring(0, index);
                const noteText = text.substring(index, index + note.selectedText.length);
                const afterText = text.substring(index + note.selectedText.length);
                
                const fragment = document.createDocumentFragment();
                
                if (beforeText) {
                    fragment.appendChild(document.createTextNode(beforeText));
                }
                
                const noteSpan = document.createElement('span');
                noteSpan.className = 'text-note-highlight';
                noteSpan.setAttribute('data-note-id', note.id);
                noteSpan.setAttribute('title', `Note: ${note.text.substring(0, 100)}${note.text.length > 100 ? '...' : ''}`);
                noteSpan.textContent = noteText;
                fragment.appendChild(noteSpan);
                
                // Add note popup functionality after DOM insertion
                setTimeout(() => {
                    if (this.app.sidebar && this.app.sidebar.addNotePopupEvents) {
                        this.app.sidebar.addNotePopupEvents(noteSpan, note);
                    }
                }, 0);
                
                if (afterText) {
                    fragment.appendChild(document.createTextNode(afterText));
                }
                
                parent.replaceChild(fragment, node);
                break; // Only highlight the first occurrence
            }
        }
    }

    navigateToChapter(chapterIndex) {
        const chapter = document.getElementById(`chapter-${chapterIndex}`);
        if (chapter) {
            chapter.scrollIntoView({ behavior: 'smooth' });
            
            // Update TOC active state
            document.querySelectorAll('.toc-item').forEach(item => {
                item.classList.remove('active');
            });
            
            const tocItem = document.querySelector(`[data-index="${chapterIndex}"]`);
            if (tocItem) {
                tocItem.classList.add('active');
            }


        }
    }







    enableAIFeatures() {
        const askBtn = document.getElementById('askBtn');
        const questionInput = document.getElementById('questionInput');
        
        if (askBtn) askBtn.disabled = false;
        if (questionInput) questionInput.disabled = false;
    }

    updateUploadArea(metadata) {
        const fileUploadArea = document.getElementById('fileUploadArea');
        
        // Check if fileUploadArea exists - silently return if not found
        if (!fileUploadArea) {
            // Element may not exist in current UI state, which is normal
            return;
        }
        
        // Provide fallback values for metadata
        const safeMetadata = {
            title: (metadata && metadata.title) || 'Unknown Title',
            creator: (metadata && metadata.creator) || 'Unknown Author'
        };
        
        fileUploadArea.innerHTML = `
            <div class="current-book">
                <span class="book-icon">📖</span>
                <div class="book-details">
                    <p class="book-title">${this.escapeHTML(safeMetadata.title)}</p>
                    <p class="book-author">${this.escapeHTML(safeMetadata.creator)}</p>
                </div>
                <button class="change-book-btn" onclick="this.parentElement.parentElement.click()">Change Book</button>
            </div>
        `;
    }

    generateBookId(filename, metadata) {
        const title = metadata.title || filename;
        const author = metadata.creator || 'unknown';
        const timestamp = Date.now();
        
        return btoa(`${title}-${author}-${timestamp}`).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    }

    showLoading(message) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        
        if (loadingText) loadingText.textContent = message;
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }

    showError(message) {
        // Simple error display - could be enhanced with a proper modal
        alert(message);
    }

    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getCurrentBook() {
        return this.currentBook;
    }
}

// Export for use in other modules
window.FileHandler = FileHandler;
