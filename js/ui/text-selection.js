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

        // CRITICAL FIX: Preserve selected text for the Ask AI bubble
        // The hideSelectionMenu() call clears this.selectedText, so we need to preserve it
        this.preservedSelectedText = this.selectedText;
        
        // Show the AI question bubble
        this.showAIQuestionBubble();
        this.hideSelectionMenu();
    }

    showAIQuestionBubble() {
        const bubble = document.getElementById('aiQuestionBubble');
        const selectedTextPreview = document.getElementById('bubbleSelectedText');
        const questionInput = document.getElementById('bubbleQuestionInput');

        if (!bubble || !selectedTextPreview || !questionInput) return;

        // Set the selected text preview using preserved text
        const textToShow = this.preservedSelectedText || this.selectedText || '';
        selectedTextPreview.textContent = textToShow.length > 100 
            ? textToShow.substring(0, 100) + '...' 
            : textToShow;

        // Clear and focus the question input
        questionInput.value = '';
        questionInput.placeholder = 'Ask about this text...';

        // Position the bubble near the selection
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            // Position bubble below the selection
            let top = rect.bottom + 10;
            let left = rect.left;

            // Adjust if bubble would go off screen
            const bubbleRect = bubble.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            if (left + 350 > viewportWidth) {
                left = viewportWidth - 360;
            }
            if (left < 10) {
                left = 10;
            }
            if (top + 200 > viewportHeight) {
                top = rect.top - 210;
            }

            bubble.style.left = `${left}px`;
            bubble.style.top = `${top}px`;
        }

        // Set up event listeners FIRST (before showing bubble and focusing)
        this.setupBubbleEventListeners();
        
        // Show bubble
        bubble.classList.remove('hidden');
        
        // Focus the input after event listeners are set up and bubble is shown
        setTimeout(() => {
            const freshQuestionInput = document.getElementById('bubbleQuestionInput');
            if (freshQuestionInput) {
                freshQuestionInput.value = ''; // Clear any existing text
                freshQuestionInput.focus();
                // Set cursor at end of input
                freshQuestionInput.setSelectionRange(0, 0);
            }
        }, 150);
    }

    setupBubbleEventListeners() {
        const askBtn = document.getElementById('bubbleAskBtn');
        const cancelBtn = document.getElementById('bubbleCancelBtn');
        const questionInput = document.getElementById('bubbleQuestionInput');

        if (!askBtn || !cancelBtn || !questionInput) return;

        // Button event listeners
        askBtn.onclick = () => this.handleBubbleAsk();
        cancelBtn.onclick = () => this.hideBubble();

        // Handle Enter key to submit question - MUST be added BEFORE event blocking
        questionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleBubbleAsk();
                return;
            }
            // Allow other keydown events to bubble for normal typing
            e.stopPropagation();
            e.stopImmediatePropagation();
        });

        // Fix focus persistence for question input - exclude keydown to allow Enter handling
        // Prevent event bubbling for mouse and focus events only
        ['mousedown', 'mouseup', 'click', 'focus', 'blur', 'keyup', 'keypress'].forEach(eventType => {
            questionInput.addEventListener(eventType, (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            });
        });
        
        // Ensure input stays focusable when clicked
        questionInput.addEventListener('mousedown', (e) => {
            e.preventDefault();
            questionInput.focus();
        });
    }

    async handleBubbleAsk() {
        const questionInput = document.getElementById('bubbleQuestionInput');
        const askBtn = document.getElementById('bubbleAskBtn');
        
        if (!questionInput || !askBtn) return;

        const question = questionInput.value.trim();
        if (!question) {
            questionInput.focus();
            return;
        }

        // Disable button and show loading
        askBtn.disabled = true;
        askBtn.textContent = 'Asking...';

        try {
            // Get current book data
            const currentBook = this.app.fileHandler.getCurrentBook();
            if (!currentBook) {
                throw new Error('No book loaded');
            }

            // Use preserved selected text (fixes the clearing issue)
            const selectedTextToUse = this.preservedSelectedText || this.selectedText || '';
            
            // DEBUG: Log what we're actually sending
            console.log('=== DEBUG: Ask AI Request ===');
            console.log('Question:', question);
            console.log('Current selectedText:', this.selectedText);
            console.log('Preserved selectedText:', this.preservedSelectedText);
            console.log('Using selectedText:', selectedTextToUse);
            console.log('Selected Text Length:', selectedTextToUse ? selectedTextToUse.length : 'null');
            console.log('Book Title:', currentBook.metadata?.title);
            console.log('==============================');

            // Verify we have selected text
            if (!selectedTextToUse || selectedTextToUse.trim() === '') {
                throw new Error('No text selected. Please select some text first.');
            }

            // Immediately add thinking placeholder to smart bar
            const thinkingId = this.app.sidebar.addThinkingAIChat(question, selectedTextToUse);
            
            // Hide bubble immediately
            this.hideBubble();

            // Ask AI about the selected text with proper context
            // BUG FIX: Use askQuestionWithSelectedText with preserved selected text
            // The preserved text ensures we don't lose the selection when the menu disappears
            const response = await this.app.aiIntegration.askQuestionWithSelectedText(
                question,
                selectedTextToUse,
                currentBook
            );

            // Update the thinking placeholder with the actual response
            this.app.sidebar.updateAIChat(thinkingId, response);

            // Also add to traditional Ask Answers for backward compatibility
            this.addToAskAnswers({
                question: question,
                selectedText: selectedTextToUse,
                answer: response,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('AI question error:', error);
            alert('Failed to get AI response: ' + error.message);
        } finally {
            askBtn.disabled = false;
            askBtn.textContent = 'Ask AI';
        }
    }

    hideBubble() {
        const bubble = document.getElementById('aiQuestionBubble');
        if (bubble) {
            bubble.classList.add('hidden');
        }
        // Clear selection and preserved text
        this.clearSelection();
        this.preservedSelectedText = null;
    }

    addToAskAnswers(answerData) {
        // Save to storage
        const bookId = this.app.fileHandler.getCurrentBook()?.id;
        if (bookId) {
            const askAnswers = this.app.storage.getAskAnswers(bookId) || [];
            const answerItem = {
                id: this.generateAnswerId(),
                ...answerData
            };
            askAnswers.unshift(answerItem); // Add to beginning
            this.app.storage.saveAskAnswers(bookId, askAnswers);
            
            // Update sidebar display
            this.app.sidebar.displayAskAnswers(askAnswers);
        }
    }

    generateAnswerId() {
        return 'answer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    addNoteForSelection() {
        if (!this.selectedText) return;

        // Preserve the selected range for note creation
        this.app.sidebar.preservedSelectedRange = this.selectedRange ? this.selectedRange.cloneRange() : null;
        this.app.sidebar.preservedSelectedText = this.selectedText;

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

        // Disable save button initially since textarea is empty
        const saveNoteBtn = document.getElementById('saveNote');
        if (saveNoteBtn) {
            saveNoteBtn.disabled = true;
            saveNoteBtn.classList.add('disabled');
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
