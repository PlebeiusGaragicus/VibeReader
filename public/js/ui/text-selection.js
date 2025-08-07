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
        if (!this.selectedText || !this.selectedRange) {
            console.warn('No text selected for highlighting');
            return;
        }

        console.log('Highlighting text:', this.selectedText);

        try {
            // Create highlight data
            const highlight = {
                id: this.generateHighlightId(),
                text: this.selectedText,
                timestamp: new Date().toISOString(),
                chapter: this.getCurrentChapter(),
                color: 'yellow' // Default color
            };

            console.log('Created highlight object:', highlight);

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
                console.log('Highlight saved and sidebar updated');
            }

            this.hideSelectionMenu();
            
        } catch (error) {
            console.error('Failed to create highlight:', error);
            if (this.app.showError) {
                this.app.showError('Failed to create highlight: ' + error.message);
            } else {
                alert('Failed to create highlight: ' + error.message);
            }
        }
    }

    applyHighlight(highlight) {
        if (!this.selectedRange) {
            console.error('No selected range for highlighting');
            return;
        }

        console.log('Applying highlight:', highlight.id, 'to text:', highlight.text);

        try {
            // Check if the range can be safely wrapped with surroundContents
            const canUseSurround = this.canUseSurroundContents(this.selectedRange);
            console.log('Can use surroundContents:', canUseSurround);
            
            if (canUseSurround) {
                console.log('Using surroundContents method');
                // Create highlight span
                const highlightSpan = document.createElement('span');
                highlightSpan.className = 'text-highlight';
                highlightSpan.setAttribute('data-highlight-id', highlight.id);
                highlightSpan.setAttribute('title', `Highlighted on ${new Date(highlight.timestamp).toLocaleDateString()}`);

                // Wrap the selected content
                this.selectedRange.surroundContents(highlightSpan);
                console.log('Successfully applied highlight with surroundContents');
                console.log('Highlight span content:', highlightSpan.textContent);
                console.log('Highlight span HTML:', highlightSpan.outerHTML);
            } else {
                console.log('Using marker-based highlighting for complex selection');
                // Use marker-based approach for complex selections
                this.applyMarkerBasedHighlight(highlight);
            }
            
        } catch (error) {
            // Fallback: try marker-based highlighting
            console.warn('Failed to apply highlight with surroundContents, trying marker-based approach:', error);
            this.applyMarkerBasedHighlight(highlight);
        }
    }

    canUseSurroundContents(range) {
        try {
            // Check if the range is collapsed
            if (range.collapsed) return false;
            
            // Check if the range partially selects any non-text nodes
            const startContainer = range.startContainer;
            const endContainer = range.endContainer;
            
            // If start and end are in different elements, it might be complex
            if (startContainer !== endContainer) {
                // Check if they share a common parent that's not too far up
                const commonAncestor = range.commonAncestorContainer;
                
                // If the common ancestor is the document or body, it's too complex
                if (commonAncestor === document || commonAncestor === document.body) {
                    return false;
                }
                
                // Check if the selection crosses element boundaries in a problematic way
                const walker = document.createTreeWalker(
                    commonAncestor,
                    NodeFilter.SHOW_ELEMENT,
                    null,
                    false
                );
                
                let node;
                while (node = walker.nextNode()) {
                    // If the range intersects with an element boundary, it might be problematic
                    if (range.intersectsNode(node) && !range.selectNode) {
                        // Check if this is an inline element that's safe to cross
                        const tagName = node.tagName.toLowerCase();
                        const safeInlineTags = ['span', 'em', 'strong', 'i', 'b', 'u', 'small', 'mark'];
                        
                        if (!safeInlineTags.includes(tagName)) {
                            return false;
                        }
                    }
                }
            }
            
            // Additional check: try to clone the range to see if it's valid
            const testRange = range.cloneRange();
            
            // Test if we can clone contents without error (non-destructive)
            try {
                const clonedContents = testRange.cloneContents();
                return clonedContents !== null;
            } catch (error) {
                return false;
            }
            
        } catch (error) {
            // If any error occurs during validation, it's not safe
            return false;
        }
    }

    applyMarkerBasedHighlight(highlight) {
        console.log('Applying marker-based highlight for text:', this.selectedText);
        
        const readingContainer = document.getElementById('readingContainer');
        if (!readingContainer) {
            console.error('Reading container not found');
            return;
        }
        
        if (!this.selectedRange || this.selectedRange.collapsed) {
            console.error('No valid selection range');
            return;
        }
        
        try {
            // Insert invisible start and end markers
            const startMarker = document.createElement('span');
            startMarker.className = 'highlight-start-marker';
            startMarker.setAttribute('data-highlight-id', highlight.id);
            startMarker.style.display = 'none';
            
            const endMarker = document.createElement('span');
            endMarker.className = 'highlight-end-marker';
            endMarker.setAttribute('data-highlight-id', highlight.id);
            endMarker.style.display = 'none';
            
            // Clone the range to avoid modifying the original
            const range = this.selectedRange.cloneRange();
            
            // Insert markers at start and end of selection
            range.collapse(false); // Collapse to end
            range.insertNode(endMarker);
            
            range.setStart(this.selectedRange.startContainer, this.selectedRange.startOffset);
            range.collapse(true); // Collapse to start
            range.insertNode(startMarker);
            
            // Now apply highlighting between the markers
            this.highlightBetweenMarkers(highlight.id, highlight);
            
            console.log('Successfully applied marker-based highlight');
            
        } catch (error) {
            console.error('Marker-based highlighting failed:', error);
            // Final fallback to simple text search
            this.applySimpleTextHighlight(highlight);
        }
    }
    
    highlightBetweenMarkers(highlightId, highlight) {
        console.log('Highlighting content between markers for ID:', highlightId);
        
        const startMarker = document.querySelector(`.highlight-start-marker[data-highlight-id="${highlightId}"]`);
        const endMarker = document.querySelector(`.highlight-end-marker[data-highlight-id="${highlightId}"]`);
        
        if (!startMarker || !endMarker) {
            console.error('Could not find start or end markers');
            return;
        }
        
        // Create a range from start marker to end marker
        const range = document.createRange();
        range.setStartAfter(startMarker);
        range.setEndBefore(endMarker);
        
        // Walk through all text nodes between the markers
        const walker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            },
            false
        );
        
        const textNodesToHighlight = [];
        let node;
        while (node = walker.nextNode()) {
            // Only include text nodes that are actually between our markers
            const nodeRange = document.createRange();
            nodeRange.selectNodeContents(node);
            
            if (range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0 && 
                range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0) {
                textNodesToHighlight.push(node);
            }
        }
        
        console.log('Found', textNodesToHighlight.length, 'text nodes to highlight between markers');
        
        // Highlight each text node
        textNodesToHighlight.forEach((textNode, index) => {
            const parent = textNode.parentNode;
            const highlightSpan = document.createElement('span');
            highlightSpan.className = 'text-highlight';
            highlightSpan.setAttribute('data-highlight-id', highlightId);
            highlightSpan.setAttribute('data-highlight-part', index + 1);
            highlightSpan.setAttribute('title', `Highlighted on ${new Date(highlight.timestamp).toLocaleDateString()}`);
            
            // Clone the text node and wrap it
            highlightSpan.appendChild(textNode.cloneNode(true));
            parent.replaceChild(highlightSpan, textNode);
        });
        
        console.log('Applied highlighting to', textNodesToHighlight.length, 'text nodes');
    }
    
    applySimpleTextHighlight(highlight) {
        console.log('Applying simple text highlight fallback');
        
        const readingContainer = document.getElementById('readingContainer');
        if (!readingContainer) {
            console.error('Reading container not found');
            return;
        }
        
        // Simple approach: find the first occurrence of the text and highlight it
        const searchText = this.selectedText.trim();
        const walker = document.createTreeWalker(
            readingContainer,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            const nodeText = node.textContent;
            if (nodeText.includes(searchText)) {
                const index = nodeText.indexOf(searchText);
                const parent = node.parentNode;
                
                const before = nodeText.substring(0, index);
                const highlighted = nodeText.substring(index, index + searchText.length);
                const after = nodeText.substring(index + searchText.length);

                const fragment = document.createDocumentFragment();
                
                if (before) fragment.appendChild(document.createTextNode(before));
                
                const highlightSpan = document.createElement('span');
                highlightSpan.className = 'text-highlight';
                highlightSpan.setAttribute('data-highlight-id', highlight.id);
                highlightSpan.setAttribute('title', `Highlighted on ${new Date(highlight.timestamp).toLocaleDateString()}`);
                highlightSpan.textContent = highlighted;
                fragment.appendChild(highlightSpan);
                
                if (after) fragment.appendChild(document.createTextNode(after));

                parent.replaceChild(fragment, node);
                console.log('Applied simple text highlight');
                return;
            }
        }
        
        console.warn('Could not find text to highlight with simple approach');
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
        console.log('Removing highlight:', highlightId);
        
        // Find ALL elements related to this highlight (spans and markers)
        const highlightElements = document.querySelectorAll(`[data-highlight-id="${highlightId}"]`);
        console.log('Found', highlightElements.length, 'elements to remove (spans + markers)');
        
        if (highlightElements.length === 0) {
            console.warn('No highlight elements found for ID:', highlightId);
            return;
        }
        
        // Keep track of parents that need normalization
        const parentsToNormalize = new Set();
        
        // Remove each element (highlight spans and markers)
        highlightElements.forEach((element, index) => {
            console.log(`Removing element ${index + 1}/${highlightElements.length}: ${element.className}`);
            
            const parent = element.parentNode;
            if (parent) {
                // If it's a highlight span, replace with text content
                if (element.classList.contains('text-highlight')) {
                    const textNode = document.createTextNode(element.textContent);
                    parent.replaceChild(textNode, element);
                    parentsToNormalize.add(parent);
                } else {
                    // If it's a marker, just remove it
                    parent.removeChild(element);
                }
            }
        });
        
        // Normalize all affected parents to merge adjacent text nodes
        // This helps restore the original text structure
        parentsToNormalize.forEach(parent => {
            try {
                parent.normalize();
            } catch (error) {
                console.warn('Failed to normalize parent:', error);
            }
        });
        
        console.log('Successfully removed all elements for highlight ID:', highlightId);

        // Remove from storage
        const bookId = this.app.fileHandler.getCurrentBook()?.id;
        if (bookId) {
            const highlights = this.app.storage.getHighlights(bookId);
            const updatedHighlights = highlights.filter(h => h.id !== highlightId);
            this.app.storage.saveHighlights(bookId, updatedHighlights);
            
            // Update sidebar
            this.app.sidebar.displayHighlights(updatedHighlights);
            console.log('Updated storage and sidebar');
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
