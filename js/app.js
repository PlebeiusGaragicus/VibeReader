// Main Application for VibeReader

class VibeReaderApp {
    constructor() {
        this.storage = null;
        this.fileHandler = null;
        this.textSelection = null;
        this.sidebar = null;
        this.aiIntegration = null;
        this.themeManager = null;
        this.scrollManager = null;
        
        this.init();
    }

    async init() {
        try {
            // Initialize storage
            this.storage = new StorageManager();
            
            // Initialize theme and scroll managers
            this.themeManager = new ThemeManager();
            this.scrollManager = new ScrollManager();
            
            // Initialize AI integration
            this.aiIntegration = new AIIntegration(this);
            
            // Initialize UI components
            this.sidebar = new SidebarManager(this);
            this.fileHandler = new FileHandler(this);
            this.textSelection = new TextSelectionHandler(this);
            
            // Setup global event listeners
            this.setupGlobalEventListeners();
            
            // Check for previously loaded books
            this.checkForStoredBooks();
            
            // Add build info to meta tag for cache busting
            this.addBuildInfoToPage();
            
            console.log(`VibeReader initialized successfully (Build ${BuildInfo.build})`);
            
        } catch (error) {
            console.error('Failed to initialize VibeReader:', error);
            this.showError('Failed to initialize application: ' + error.message);
        }
    }

    setupGlobalEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key to close modals and menus
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
            
            // Ctrl/Cmd + K for quick search (future feature)
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                // TODO: Implement quick search
            }
            
            // Ctrl/Cmd + H to toggle highlights
            if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault();
                this.toggleHighlights();
            }
        });

        // Handle modal backdrop clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Handle beforeunload to save state
        window.addEventListener('beforeunload', () => {
            this.saveCurrentState();
        });
    }

    checkForStoredBooks() {
        const lastBookId = this.storage.getLastBook();
        
        if (lastBookId) {
            const lastBookData = this.storage.getBookData(lastBookId);
            if (lastBookData) {
                this.showResumeBookOption(lastBookId, lastBookData);
            }
        }
    }

    showResumeBookOption(bookId, bookData) {
        const resumeSection = document.getElementById('resumeBookSection');
        const lastBookTitle = document.getElementById('lastBookTitle');
        const resumeBtn = document.getElementById('resumeLastBookBtn');
        
        if (resumeSection && lastBookTitle && resumeBtn) {
            // Set the book title
            lastBookTitle.textContent = bookData.metadata?.title || 'Unknown Book';
            
            // Show the resume section
            resumeSection.classList.remove('hidden');
            
            // Add click handler
            resumeBtn.addEventListener('click', () => {
                this.resumeLastBook(bookId, bookData);
            });
        }
    }

    async resumeLastBook(bookId, bookData) {
        try {
            // Hide the resume section
            const resumeSection = document.getElementById('resumeBookSection');
            if (resumeSection) {
                resumeSection.classList.add('hidden');
            }
            
            // Load the book using the file handler
            await this.fileHandler.loadBookFromData(bookId, bookData);
            
            console.log('Resumed last book:', bookData.metadata?.title);
        } catch (error) {
            console.error('Failed to resume last book:', error);
            this.showError('Failed to resume book: ' + error.message);
        }
    }

    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.classList.add('hidden');
        });
        
        // Also close text selection menu
        if (this.textSelection) {
            this.textSelection.clearSelection();
        }
    }

    toggleHighlights() {
        const highlights = document.querySelectorAll('.text-highlight');
        const isVisible = highlights.length > 0 && !highlights[0].style.display;
        
        highlights.forEach(highlight => {
            highlight.style.display = isVisible ? 'none' : '';
        });
    }

    handleResize() {
        // Adjust layout for mobile/tablet views
        const mainContent = document.querySelector('.main-content');
        const leftPanel = document.querySelector('.left-panel');
        const rightPanel = document.querySelector('.right-panel');
        
        if (window.innerWidth < 768) {
            // Mobile layout adjustments
            if (leftPanel) leftPanel.style.width = '100%';
            if (rightPanel) rightPanel.style.width = '100%';
        } else if (window.innerWidth < 1024) {
            // Tablet layout adjustments
            if (leftPanel) leftPanel.style.width = '250px';
            if (rightPanel) rightPanel.style.width = '250px';
        } else {
            // Desktop layout
            if (leftPanel) leftPanel.style.width = '300px';
            if (rightPanel) rightPanel.style.width = '300px';
        }
    }

    saveCurrentState() {
        // Save current reading position and other state
        const currentBook = this.fileHandler?.getCurrentBook();
        if (currentBook) {
            const readingContainer = document.getElementById('readingContainer');
            if (readingContainer) {
                const scrollPosition = readingContainer.scrollTop;
                const scrollHeight = readingContainer.scrollHeight;
                const percentage = Math.round((scrollPosition / scrollHeight) * 100);
                
                // This could be enhanced to save more precise position
                console.log(`Saving reading position: ${percentage}%`);
            }
        }
    }

    showError(message) {
        // Enhanced error display
        console.error(message);
        
        // Create a temporary error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠️</span>
                <span class="error-message">${this.escapeHTML(message)}</span>
                <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add styles if not already present
        if (!document.querySelector('#error-notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'error-notification-styles';
            styles.textContent = `
                .error-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background-color: #fee;
                    border: 1px solid #fcc;
                    border-radius: 6px;
                    padding: 1rem;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 10000;
                    max-width: 400px;
                }
                .error-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .error-message {
                    flex: 1;
                    color: #c53030;
                }
                .error-close {
                    background: none;
                    border: none;
                    font-size: 1.2rem;
                    cursor: pointer;
                    color: #c53030;
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }

    showSuccess(message) {
        // Similar to showError but for success messages
        console.log(message);
        
        const successDiv = document.createElement('div');
        successDiv.className = 'success-notification';
        successDiv.innerHTML = `
            <div class="success-content">
                <span class="success-icon">✅</span>
                <span class="success-message">${this.escapeHTML(message)}</span>
                <button class="success-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add styles if not already present
        if (!document.querySelector('#success-notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'success-notification-styles';
            styles.textContent = `
                .success-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background-color: #f0fff4;
                    border: 1px solid #9ae6b4;
                    border-radius: 6px;
                    padding: 1rem;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 10000;
                    max-width: 400px;
                }
                .success-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .success-message {
                    flex: 1;
                    color: #2f855a;
                }
                .success-close {
                    background: none;
                    border: none;
                    font-size: 1.2rem;
                    cursor: pointer;
                    color: #2f855a;
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(successDiv);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentElement) {
                successDiv.remove();
            }
        }, 3000);
    }

    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public API methods for external access
    getCurrentBook() {
        return this.fileHandler?.getCurrentBook();
    }

    getAIStatus() {
        return this.aiIntegration?.getConfigurationStatus();
    }

    exportUserData() {
        const currentBook = this.getCurrentBook();
        if (!currentBook) return null;

        return {
            book: {
                title: currentBook.metadata.title,
                author: currentBook.metadata.creator
            },
            highlights: this.storage.getHighlights(currentBook.id),
            notes: this.storage.getNotes(currentBook.id),
            qaHistory: this.storage.getQAHistory(currentBook.id)
        };
    }

    importUserData(data) {
        const currentBook = this.getCurrentBook();
        if (!currentBook || !data) return false;

        try {
            if (data.highlights) {
                this.storage.saveHighlights(currentBook.id, data.highlights);
                this.sidebar.displayHighlights(data.highlights);
            }
            
            if (data.notes) {
                this.storage.saveNotes(currentBook.id, data.notes);
                this.sidebar.displayNotes(data.notes);
            }
            
            if (data.qaHistory) {
                this.storage.saveQAHistory(currentBook.id, data.qaHistory);
                this.sidebar.displayQAHistory(data.qaHistory);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to import user data:', error);
            return false;
        }
    }
    
    addBuildInfoToPage() {
        // Add build info to meta tag for cache busting
        if (window.BuildInfo) {
            // Add or update meta tag
            let metaTag = document.querySelector('meta[name="build"]');
            if (!metaTag) {
                metaTag = document.createElement('meta');
                metaTag.setAttribute('name', 'build');
                document.head.appendChild(metaTag);
            }
            metaTag.setAttribute('content', BuildInfo.build);
            
            // Add build info comment after title
            const titleTag = document.querySelector('title');
            if (titleTag && titleTag.nextSibling?.nodeType !== Node.COMMENT_NODE) {
                const buildComment = document.createComment(` BUILD: ${BuildInfo.build} `);
                titleTag.parentNode.insertBefore(buildComment, titleTag.nextSibling);
            }
            
            // Update build info in UI
            const buildInfoElement = document.getElementById('buildInfo');
            if (buildInfoElement) {
                buildInfoElement.textContent = `Build: ${BuildInfo.build}`;
            }
            
            // Add cache busting to all CSS and JS files
            this.addCacheBustingToResources();
            
            // Add basic styling for build info
            this.addBuildInfoStyles();
            
            console.log(`Build info added: Build ${BuildInfo.build}`);
        }
    }
    
    addCacheBustingToResources() {
        // Add cache busting query parameter to CSS and JS files
        if (!window.BuildInfo) return;
        
        const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
        const scripts = document.querySelectorAll('script[src]');
        
        // Update CSS links
        cssLinks.forEach(link => {
            const currentHref = link.getAttribute('href');
            if (currentHref && !currentHref.includes('?v=')) {
                link.setAttribute('href', `${currentHref}?v=${BuildInfo.build}`);
            }
        });
        
        // Update JS scripts
        scripts.forEach(script => {
            const currentSrc = script.getAttribute('src');
            if (currentSrc && !currentSrc.includes('?v=') && !currentSrc.includes('build-info.js')) {
                script.setAttribute('src', `${currentSrc}?v=${BuildInfo.build}`);
            }
        });
    }
    
    addBuildInfoStyles() {
        // Add styles for build info display if not already present
        if (!document.querySelector('#build-info-styles')) {
            const styles = document.createElement('style');
            styles.id = 'build-info-styles';
            styles.textContent = `
                .build-info {
                    font-size: 0.75rem;
                    color: #666;
                    background: rgba(0,0,0,0.05);
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    margin-right: 0.5rem;
                    font-family: monospace;
                    border: 1px solid rgba(0,0,0,0.1);
                }
                .build-info:hover {
                    background: rgba(0,0,0,0.1);
                    color: #333;
                }
            `;
            document.head.appendChild(styles);
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new VibeReaderApp();
});

// Export for global access
window.VibeReaderApp = VibeReaderApp;
