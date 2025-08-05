// Text Selection Handler for VibeReader

class TextSelectionHandler {
    constructor(app) {
        this.app = app;
        this.selectedText = '';
        this.selectedRange = null;
        this.selectionMenu = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const readingContainer = document.getElementById('readingContainer');
        this.selectionMenu = document.getElementById('textSelectionMenu');

        // Text selection events
        document.addEventListener('mouseup', (e) => {
            setTimeout(() => this.handleTextSelection(e), 10);
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Escape') {
                this.hideSelectionMenu();
            }
        });

        // Click outside to hide menu
        document.addEventListener('click', (e) => {
            if (!this.selectionMenu.contains(e.target) && 
                !e.target.closest('.chapter-content')) {
                this.hideSelectionMenu();
            }
        });

        // Selection menu buttons
        document.getElementById('highlightBtn').addEventListener('click', () => {
            this.highlightSelectedText();
        });

        document.getElementById('askAiBtn').addEventListener('click', () => {
            this.askAIAboutSelection();
        });

        document.getElementById('addNoteBtn').addEventListener('click', () => {
            this.addNoteForSelection();
        });
    }

    handleTextSelection(e) {
        const selection = window.getSelection();
        
        if (selection.rangeCount === 0) {
            this.hideSelectionMenu();
            return;
        }

        const range = selection.getRangeAt(0);
        const selectedText = selection.toString().trim();

        if (selectedText.length === 0) {
            this.hideSelectionMenu();
            return;
        }

        // Check if selection is within reading content
        const readingContainer = document.getElementById('readingContainer');
        if (!readingContainer.contains(range.commonAncestorContainer)) {
            this.hideSelectionMenu();
            return;
        }

        this.selectedText = selectedText;
        this.selectedRange = range.cloneRange();

        // Show selection menu
        this.showSelectionMenu(e.clientX, e.clientY);
    }

    showSelectionMenu(x, y) {
        if (!this.selectionMenu) return;

        // Position the menu
        this.selectionMenu.style.left = `${x}px`;
        this.selectionMenu.style.top = `${y - 60}px`;
        this.selectionMenu.classList.remove('hidden');

        // Adjust position if menu goes off screen
        const rect = this.selectionMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (rect.right > viewportWidth) {
            this.selectionMenu.style.left = `${viewportWidth - rect.width - 10}px`;
        }

        if (rect.top < 0) {
            this.selectionMenu.style.top = `${y + 20}px`;
        }

        if (rect.left < 0) {
            this.selectionMenu.style.left = '10px';
        }
    }

    hideSelectionMenu() {
        if (this.selectionMenu) {
            this.selectionMenu.classList.add('hidden');
        }
        
        // Clear selection
        window.getSelection().removeAllRanges();
        this.selectedText = '';
        this.selectedRange = null;
    }

    highlightSelectedText() {
        if (!this.selectedText || !this.selectedRange) return;

        try {
            // Create highlight data
            const highlight = {
                id: this.generateHighlightId(),
                text: this.selectedText,
                timestamp: new Date().toISOString(),
                chapter: this.getCurrentChapter(),
                color: 'yellow' // Default color
            };

            // Apply highlight to DOM
            this.applyHighlight(highlight);

            // Save highlight
            const bookId = this.app.fileHandler.getCurrentBook()?.id;
            if (bookId) {
                const highlights = this.app.storage.getHighlights(bookId);
                highlights.push(highlight);
                this.app.storage.saveHighlights(bookId, highlights);

                // Update sidebar
                this.app.sidebar.displayHighlights(highlights);
            }

            this.hideSelectionMenu();
            
        } catch (error) {
            console.error('Failed to create highlight:', error);
            this.app.showError('Failed to create highlight');
        }
    }

    applyHighlight(highlight) {
        if (!this.selectedRange) return;

        try {
            // Create highlight span
            const highlightSpan = document.createElement('span');
            highlightSpan.className = 'text-highlight';
            highlightSpan.setAttribute('data-highlight-id', highlight.id);
            highlightSpan.setAttribute('title', `Highlighted on ${new Date(highlight.timestamp).toLocaleDateString()}`);

            // Wrap the selected content
            this.selectedRange.surroundContents(highlightSpan);
            
        } catch (error) {
            // Fallback: try to highlight by replacing text
            console.warn('Failed to apply highlight with surroundContents, trying fallback:', error);
            this.applyHighlightFallback(highlight);
        }
    }

    applyHighlightFallback(highlight) {
        // This is a simplified fallback - in a production app you'd want more robust highlighting
        const readingContainer = document.getElementById('readingContainer');
        const walker = document.createTreeWalker(
            readingContainer,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        for (const textNode of textNodes) {
            if (textNode.textContent.includes(this.selectedText)) {
                const parent = textNode.parentNode;
                const text = textNode.textContent;
                const index = text.indexOf(this.selectedText);
                
                if (index !== -1) {
                    const before = text.substring(0, index);
                    const highlighted = text.substring(index, index + this.selectedText.length);
                    const after = text.substring(index + this.selectedText.length);

                    const fragment = document.createDocumentFragment();
                    
                    if (before) fragment.appendChild(document.createTextNode(before));
                    
                    const highlightSpan = document.createElement('span');
                    highlightSpan.className = 'text-highlight';
                    highlightSpan.setAttribute('data-highlight-id', highlight.id);
                    highlightSpan.textContent = highlighted;
                    fragment.appendChild(highlightSpan);
                    
                    if (after) fragment.appendChild(document.createTextNode(after));

                    parent.replaceChild(fragment, textNode);
                    break;
                }
            }
        }
    }

    askAIAboutSelection() {
        if (!this.selectedText) return;

        // Pre-fill the question input with selected text
        const questionInput = document.getElementById('questionInput');
        if (questionInput) {
            questionInput.value = `What does this mean: "${this.selectedText}"`;
            questionInput.focus();
        }

        this.hideSelectionMenu();
    }

    addNoteForSelection() {
        if (!this.selectedText) return;

        // Show note modal with selected text
        const noteModal = document.getElementById('noteModal');
        const selectedTextPreview = document.getElementById('selectedTextPreview');
        const noteTextarea = document.getElementById('noteTextarea');

        if (selectedTextPreview) {
            selectedTextPreview.textContent = this.selectedText;
        }

        if (noteTextarea) {
            noteTextarea.value = '';
            noteTextarea.focus();
        }

        if (noteModal) {
            noteModal.classList.remove('hidden');
        }

        this.hideSelectionMenu();
    }

    getCurrentChapter() {
        // Find which chapter the selection is in
        const readingContainer = document.getElementById('readingContainer');
        const chapters = readingContainer.querySelectorAll('.chapter');
        
        if (!this.selectedRange) return 0;

        for (let i = 0; i < chapters.length; i++) {
            if (chapters[i].contains(this.selectedRange.commonAncestorContainer)) {
                return i;
            }
        }
        
        return 0;
    }

    generateHighlightId() {
        return 'highlight_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    removeHighlight(highlightId) {
        const highlightElement = document.querySelector(`[data-highlight-id="${highlightId}"]`);
        if (highlightElement) {
            // Replace highlight span with its text content
            const parent = highlightElement.parentNode;
            const textNode = document.createTextNode(highlightElement.textContent);
            parent.replaceChild(textNode, highlightElement);
            
            // Normalize the parent to merge adjacent text nodes
            parent.normalize();
        }

        // Remove from storage
        const bookId = this.app.fileHandler.getCurrentBook()?.id;
        if (bookId) {
            const highlights = this.app.storage.getHighlights(bookId);
            const updatedHighlights = highlights.filter(h => h.id !== highlightId);
            this.app.storage.saveHighlights(bookId, updatedHighlights);
            
            // Update sidebar
            this.app.sidebar.displayHighlights(updatedHighlights);
        }
    }

    getSelectedText() {
        return this.selectedText;
    }

    clearSelection() {
        this.hideSelectionMenu();
    }
}

// Export for use in other modules
window.TextSelectionHandler = TextSelectionHandler;
