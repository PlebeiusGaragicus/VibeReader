class ScrollManager {
    constructor() {
        this.readingContainer = null;
        this.currentBookId = null;
        this.saveTimeout = null;
        this.init();
    }

    init() {
        this.readingContainer = document.getElementById('readingContainer');
        if (this.readingContainer) {
            this.setupScrollListener();
        }
    }

    setupScrollListener() {
        if (!this.readingContainer) return;

        this.readingContainer.addEventListener('scroll', () => {
            this.debouncedSaveScrollPosition();
        });
    }

    debouncedSaveScrollPosition() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.saveScrollPosition();
        }, 500); // Save after 500ms of no scrolling
    }

    saveScrollPosition() {
        if (!this.readingContainer || !this.currentBookId) return;

        const scrollData = {
            scrollTop: this.readingContainer.scrollTop,
            scrollHeight: this.readingContainer.scrollHeight,
            timestamp: Date.now()
        };

        const key = `vibeReader_scroll_${this.currentBookId}`;
        localStorage.setItem(key, JSON.stringify(scrollData));
    }

    restoreScrollPosition(bookId) {
        this.currentBookId = bookId;
        
        if (!this.readingContainer || !bookId) return;

        const key = `vibeReader_scroll_${bookId}`;
        const savedData = localStorage.getItem(key);
        
        if (savedData) {
            try {
                const scrollData = JSON.parse(savedData);
                
                // Wait for content to load before restoring scroll
                setTimeout(() => {
                    if (this.readingContainer.scrollHeight > 0) {
                        this.readingContainer.scrollTop = scrollData.scrollTop;
                    }
                }, 100);
                
            } catch (error) {
                console.warn('Failed to restore scroll position:', error);
            }
        }
    }

    setCurrentBook(bookId) {
        this.currentBookId = bookId;
    }

    clearScrollPosition(bookId) {
        const key = `vibeReader_scroll_${bookId}`;
        localStorage.removeItem(key);
    }

    getScrollPercentage() {
        if (!this.readingContainer) return 0;
        
        const scrollTop = this.readingContainer.scrollTop;
        const scrollHeight = this.readingContainer.scrollHeight;
        const clientHeight = this.readingContainer.clientHeight;
        
        if (scrollHeight <= clientHeight) return 100;
        
        return Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
    }
}

window.ScrollManager = ScrollManager;
