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
            
            // Store book data
            this.app.storage.saveBookData(bookId, {
                filename: file.name,
                uploadDate: new Date().toISOString(),
                ...bookData
            });

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

        // Setup scroll tracking for progress
        this.setupScrollTracking();

        // Navigate to saved position
        const progress = this.app.storage.getProgress(this.currentBook.id);
        if (progress.chapter > 0) {
            this.navigateToChapter(progress.chapter);
        }
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

        // Apply highlights to content
        this.applyHighlights(highlights);
    }

    applyHighlights(highlights) {
        highlights.forEach(highlight => {
            try {
                const element = document.querySelector(`[data-highlight-id="${highlight.id}"]`);
                if (element) {
                    element.classList.add('text-highlight');
                }
            } catch (error) {
                console.warn('Failed to apply highlight:', error);
            }
        });
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

            // Save progress
            this.updateProgress(chapterIndex);
        }
    }

    setupScrollTracking() {
        const readingContainer = document.getElementById('readingContainer');
        let scrollTimeout;

        readingContainer.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.updateProgressFromScroll();
            }, 100);
        });
    }

    updateProgressFromScroll() {
        const readingContainer = document.getElementById('readingContainer');
        const chapters = readingContainer.querySelectorAll('.chapter');
        
        if (chapters.length === 0) return;

        const containerRect = readingContainer.getBoundingClientRect();
        const containerCenter = containerRect.top + containerRect.height / 2;

        let currentChapter = 0;
        let minDistance = Infinity;

        chapters.forEach((chapter, index) => {
            const chapterRect = chapter.getBoundingClientRect();
            const chapterCenter = chapterRect.top + chapterRect.height / 2;
            const distance = Math.abs(containerCenter - chapterCenter);

            if (distance < minDistance) {
                minDistance = distance;
                currentChapter = index;
            }
        });

        this.updateProgress(currentChapter);
    }

    updateProgress(chapterIndex) {
        if (!this.currentBook) return;

        const totalChapters = this.currentBook.content.length;
        const percentage = Math.round((chapterIndex / Math.max(1, totalChapters - 1)) * 100);

        // Update progress bar
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = `${percentage}%`;

        // Save progress
        this.app.storage.saveProgress(this.currentBook.id, {
            chapter: chapterIndex,
            position: 0,
            percentage: percentage
        });
    }

    enableAIFeatures() {
        const askBtn = document.getElementById('askBtn');
        const questionInput = document.getElementById('questionInput');
        
        if (askBtn) askBtn.disabled = false;
        if (questionInput) questionInput.disabled = false;
    }

    updateUploadArea(metadata) {
        const fileUploadArea = document.getElementById('fileUploadArea');
        
        // Check if fileUploadArea exists
        if (!fileUploadArea) {
            console.error('fileUploadArea element not found');
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
