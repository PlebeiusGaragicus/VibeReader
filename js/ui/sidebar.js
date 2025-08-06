// Smart Bar Manager for VibeReader

class SidebarManager {
    constructor(app) {
        this.app = app;
        this.modalManager = null;
        this.activityItems = [];
        this.isCollapsed = false;
        this.setupEventListeners();
        this.initializeModalManager();
    }

    initializeModalManager() {
        this.modalManager = new ModalManager();
    }

    setupEventListeners() {
        // Smart bar toggle functionality
        const smartBarToggle = document.getElementById('smartBarToggle');
        if (smartBarToggle) {
            smartBarToggle.addEventListener('click', () => {
                this.toggleSmartBar();
            });
        }

        // Note: Old Ask AI button and question input removed - now handled by bubble interface

        // Note modal events
        document.getElementById('saveNote').addEventListener('click', () => {
            this.saveNote();
        });

        document.getElementById('cancelNote').addEventListener('click', () => {
            this.closeNoteModal();
        });

        document.getElementById('closeNoteModal').addEventListener('click', () => {
            this.closeNoteModal();
        });

        // Settings modal events
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettingsModal();
        });

        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('cancelSettings').addEventListener('click', () => {
            this.closeSettingsModal();
        });

        document.getElementById('closeSettingsModal').addEventListener('click', () => {
            this.closeSettingsModal();
        });
        
        // Fix focus persistence for note textarea in modal
        const noteTextarea = document.getElementById('noteTextarea');
        
        // Prevent all event bubbling for the textarea
        ['mousedown', 'mouseup', 'click', 'focus', 'blur', 'keydown', 'keyup', 'keypress'].forEach(eventType => {
            noteTextarea.addEventListener(eventType, (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            });
        });
        
        // Ensure textarea stays focusable
        noteTextarea.addEventListener('mousedown', (e) => {
            e.preventDefault();
            noteTextarea.focus();
        });
        
        // Fix focus persistence for API key input in settings modal
        const apiKeyInput = document.getElementById('apiKey');
        
        // Prevent all event bubbling for the API key input
        ['mousedown', 'mouseup', 'click', 'focus', 'blur', 'keydown', 'keyup', 'keypress'].forEach(eventType => {
            apiKeyInput.addEventListener(eventType, (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            });
        });
        
        // Ensure API key input stays focusable
        apiKeyInput.addEventListener('mousedown', (e) => {
            e.preventDefault();
            apiKeyInput.focus();
        });
        
        // Load saved smart bar state
        this.loadSmartBarState();
    }

    toggleSmartBar() {
        const rightPanel = document.getElementById('rightPanel');
        const smartBarToggle = document.getElementById('smartBarToggle');
        
        this.isCollapsed = !this.isCollapsed;
        
        if (this.isCollapsed) {
            rightPanel.classList.add('collapsed');
            smartBarToggle.textContent = '📖';
            smartBarToggle.title = 'Show Smart Bar';
        } else {
            rightPanel.classList.remove('collapsed');
            smartBarToggle.textContent = '📋';
            smartBarToggle.title = 'Hide Smart Bar';
        }
        
        // Save state
        localStorage.setItem('vibeReader_smartBarCollapsed', this.isCollapsed);
    }

    loadSmartBarState() {
        const saved = localStorage.getItem('vibeReader_smartBarCollapsed');
        if (saved === 'true') {
            this.toggleSmartBar();
        }
    }

    addActivityItem(type, content, metadata = {}) {
        const item = {
            id: this.generateActivityId(),
            type, // 'highlight', 'note', 'ai-chat', 'thinking'
            content,
            metadata,
            timestamp: new Date()
        };
        
        this.activityItems.push(item); // Add to end (bottom)
        this.renderActivityFeed();
        
        // Auto-scroll to the bottom to show the new item
        this.scrollToBottom();
        
        return item;
    }

    clearActivityItemsByType(type) {
        // Remove all activity items of the specified type
        this.activityItems = this.activityItems.filter(item => item.type !== type);
        this.renderActivityFeed();
    }

    deleteActivityItem(activityId) {
        // Find the activity item
        const item = this.activityItems.find(item => item.id === activityId);
        if (!item) return;

        // Delete from the underlying data based on type
        if (item.type === 'highlight' && item.metadata.highlightId) {
            this.deleteHighlight(item.metadata.highlightId);
        } else if (item.type === 'note' && item.metadata.noteId) {
            this.deleteNote(item.metadata.noteId);
        } else if (item.type === 'ai-chat' && item.metadata.answerId) {
            this.deleteAskAnswer(item.metadata.answerId);
        } else {
            // For items without underlying data (like thinking placeholders), just remove from activity feed
            this.activityItems = this.activityItems.filter(activityItem => activityItem.id !== activityId);
            this.renderActivityFeed();
        }
    }

    scrollToActivityItem(activityId) {
        // Find the activity item
        const item = this.activityItems.find(item => item.id === activityId);
        if (!item) return;

        // Get the reading container
        const readingContainer = document.getElementById('readingContainer');
        if (!readingContainer) return;

        let targetElement = null;

        // Find the target element based on item type
        if (item.type === 'highlight' && item.metadata.highlightId) {
            // Find the highlighted text in the DOM
            targetElement = document.querySelector(`[data-highlight-id="${item.metadata.highlightId}"]`);
        } else if (item.type === 'note' && item.metadata.noteId) {
            // For notes, first try to find the note highlight element
            targetElement = document.querySelector(`[data-note-id="${item.metadata.noteId}"]`);
            // If not found, fall back to text search
            if (!targetElement && item.metadata.selectedText) {
                targetElement = this.findTextInContent(item.metadata.selectedText, readingContainer);
            }
        } else if (item.type === 'ai-chat') {
            // For AI chats, search for the selected text
            const textToFind = item.metadata.selectedText || item.metadata.originalText;
            if (textToFind) {
                targetElement = this.findTextInContent(textToFind, readingContainer);
            }
        }

        // Scroll to the target element
        if (targetElement) {
            // Smooth scroll to the element
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });

            // Add a temporary highlight effect
            this.addTemporaryHighlight(targetElement);
        } else {
            // If we can't find the exact element, show a message
            if (this.app.modalManager) {
                this.app.modalManager.showAlert('Unable to locate this item in the current book.');
            } else {
                alert('Unable to locate this item in the current book.');
            }
        }
    }

    findTextInContent(text, container) {
        // More sophisticated text search that looks for exact matches
        if (!text || text.length < 3) return null;
        
        // First try to find exact match
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let bestMatch = null;
        let bestMatchScore = 0;
        let node;
        
        while (node = walker.nextNode()) {
            const nodeText = node.textContent;
            
            // Check for exact match first
            if (nodeText.includes(text)) {
                return node.parentElement;
            }
            
            // Check for partial match (for longer text that might be split)
            const searchText = text.substring(0, Math.min(text.length, 100));
            if (nodeText.includes(searchText)) {
                const score = searchText.length;
                if (score > bestMatchScore) {
                    bestMatch = node.parentElement;
                    bestMatchScore = score;
                }
            }
        }
        
        return bestMatch;
    }

    addTemporaryHighlight(element) {
        // Add a temporary visual highlight to show what was clicked
        const originalBackground = element.style.backgroundColor;
        const originalTransition = element.style.transition;
        
        element.style.transition = 'background-color 0.3s ease';
        element.style.backgroundColor = 'rgba(59, 130, 246, 0.3)'; // Blue highlight
        
        setTimeout(() => {
            element.style.backgroundColor = originalBackground;
            setTimeout(() => {
                element.style.transition = originalTransition;
            }, 300);
        }, 1500);
    }

    scrollToBottom() {
        // Auto-scroll the sidebar to the bottom to show new items
        const smartBarContent = document.querySelector('.smart-bar-content');
        if (smartBarContent) {
            // Use setTimeout to ensure the DOM has been updated after renderActivityFeed
            setTimeout(() => {
                smartBarContent.scrollTo({
                    top: smartBarContent.scrollHeight,
                    behavior: 'smooth'
                });
            }, 100);
        }
    }

    applyNoteHighlight(note) {
        // Apply visual highlighting to text with notes (similar to highlights but different style)
        try {
            const range = this.preservedSelectedRange;
            if (!range) {
                console.warn('No preserved range available, using fallback method');
                this.applyNoteHighlightFallback(note);
                return;
            }

            // Create note highlight span
            const noteSpan = document.createElement('span');
            noteSpan.className = 'text-note-highlight';
            noteSpan.setAttribute('data-note-id', note.id);
            noteSpan.setAttribute('title', `Note: ${note.text.substring(0, 100)}${note.text.length > 100 ? '...' : ''}`);

            // Wrap the selected text
            range.surroundContents(noteSpan);
            
            // Clear the preserved range after use
            this.preservedSelectedRange = null;
            this.preservedSelectedText = null;
        } catch (error) {
            // Fallback: try to highlight by replacing text
            console.warn('Failed to apply note highlight with surroundContents, trying fallback:', error);
            this.applyNoteHighlightFallback(note);
        }
    }

    applyNoteHighlightFallback(note) {
        // Fallback method for applying note highlights
        const readingContainer = document.getElementById('readingContainer');
        if (!readingContainer || !note.selectedText) return;

        // Find text nodes containing the selected text
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
                
                if (afterText) {
                    fragment.appendChild(document.createTextNode(afterText));
                }
                
                parent.replaceChild(fragment, node);
                break; // Only highlight the first occurrence
            }
        }
    }

    updateActivityItem(id, updates) {
        const itemIndex = this.activityItems.findIndex(item => item.id === id);
        if (itemIndex !== -1) {
            Object.assign(this.activityItems[itemIndex], updates);
            this.renderActivityFeed();
        }
    }

    removeActivityItem(id) {
        this.activityItems = this.activityItems.filter(item => item.id !== id);
        this.renderActivityFeed();
    }

    renderActivityFeed() {
        const feed = document.getElementById('activityFeed');
        if (!feed) return;
        
        if (this.activityItems.length === 0) {
            feed.innerHTML = `
                <div class="no-content-message">
                    <p>📖 Your highlights, notes, and AI conversations will appear here as you read</p>
                </div>
            `;
            return;
        }
        
        const itemsHTML = this.activityItems.map(item => this.renderActivityItem(item)).join('');
        feed.innerHTML = itemsHTML;
    }

    renderActivityItem(item) {
        const timeStr = this.formatTime(item.timestamp);
        const icons = {
            highlight: '🎨',
            note: '📝',
            'ai-chat': '🤖',
            thinking: '🤔'
        };
        
        let contentHTML = '';
        let actionsHTML = '';
        
        if (item.type === 'thinking') {
            contentHTML = `
                <div class="activity-content">
                    <div class="thinking-spinner"></div>
                    ${item.content}
                </div>
            `;
        } else {
            const isLong = item.content.length > 150;
            contentHTML = `
                <div class="activity-content ${isLong ? 'preview' : ''}" id="content-${item.id}">
                    ${this.escapeHTML(isLong ? item.content.substring(0, 150) + '...' : item.content)}
                </div>
            `;
            
            actionsHTML = `
                <div class="activity-actions">
                    ${isLong ? `<button class="activity-btn" onclick="event.stopPropagation(); window.app.sidebar.expandItem('${item.id}')">Expand</button>` : ''}
                    <button class="activity-btn" onclick="event.stopPropagation(); window.app.sidebar.deleteActivityItem('${item.id}')">Delete</button>
                </div>
            `;
        }
        
        return `
            <div class="activity-item ${item.type}" data-id="${item.id}" onclick="window.app.sidebar.scrollToActivityItem('${item.id}')" style="cursor: pointer;">
                <div class="activity-header">
                    <div class="activity-type">
                        <span>${icons[item.type] || '📄'}</span>
                        <span>${item.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    </div>
                    <div class="activity-time">${timeStr}</div>
                </div>
                ${contentHTML}
                ${actionsHTML}
            </div>
        `;
    }

    expandItem(id) {
        const item = this.activityItems.find(i => i.id === id);
        if (!item) return;
        
        this.modalManager.showModal({
            id: `expand-${id}`,
            title: `${item.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} - ${this.formatTime(item.timestamp)}`,
            content: `<div class="expanded-content">${this.escapeHTML(item.content)}</div>`,
            buttons: [
                { text: 'Close', action: 'close', primary: true }
            ],
            className: 'expand-modal'
        });
    }

    generateActivityId() {
        return 'activity_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Method to immediately show AI chat with thinking placeholder
    addThinkingAIChat(question, selectedText) {
        const thinkingItem = this.addActivityItem('thinking', 'Thinking about your question...', {
            question,
            selectedText,
            isThinking: true
        });
        
        return thinkingItem.id;
    }

    // Method to update thinking item with actual AI response
    updateAIChat(thinkingId, answer) {
        const item = this.activityItems.find(i => i.id === thinkingId);
        if (item && item.metadata.isThinking) {
            const content = `Q: ${item.metadata.question}\n\nSelected: "${item.metadata.selectedText}"\n\nA: ${answer}`;
            
            this.updateActivityItem(thinkingId, {
                type: 'ai-chat',
                content: content,
                metadata: {
                    ...item.metadata,
                    answer: answer,
                    isThinking: false
                }
            });
        }
    }

    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
        if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
        return date.toLocaleDateString();
    }

    toggleSection(sectionName) {
        const header = document.querySelector(`[data-section="${sectionName}"]`);
        const content = document.getElementById(`${sectionName}Content`);
        const sidebarSection = header.closest('.sidebar-section');
        const toggle = header.querySelector('.section-toggle');
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        
        if (isExpanded) {
            // Collapse
            content.classList.add('collapsed');
            sidebarSection.classList.add('collapsed');
            toggle.setAttribute('aria-expanded', 'false');
        } else {
            // Expand
            content.classList.remove('collapsed');
            sidebarSection.classList.remove('collapsed');
            toggle.setAttribute('aria-expanded', 'true');
        }
        
        // Save state to localStorage
        this.saveSectionState(sectionName, !isExpanded);
    }
    
    saveSectionState(sectionName, isExpanded) {
        const sectionStates = JSON.parse(localStorage.getItem('vibeReader_sectionStates') || '{}');
        sectionStates[sectionName] = isExpanded;
        localStorage.setItem('vibeReader_sectionStates', JSON.stringify(sectionStates));
    }
    
    loadSectionStates() {
        const sectionStates = JSON.parse(localStorage.getItem('vibeReader_sectionStates') || '{}');
        const sections = ['askAI', 'highlights', 'notes'];
        
        sections.forEach(sectionName => {
            const isExpanded = sectionStates[sectionName] !== false; // Default to expanded
            const header = document.querySelector(`[data-section="${sectionName}"]`);
            const content = document.getElementById(`${sectionName}Content`);
            const sidebarSection = header?.closest('.sidebar-section');
            const toggle = header?.querySelector('.section-toggle');
            
            if (header && content && toggle && sidebarSection) {
                if (isExpanded) {
                    content.classList.remove('collapsed');
                    sidebarSection.classList.remove('collapsed');
                    toggle.setAttribute('aria-expanded', 'true');
                } else {
                    content.classList.add('collapsed');
                    sidebarSection.classList.add('collapsed');
                    toggle.setAttribute('aria-expanded', 'false');
                }
            }
        });
    }

    // Note: handleAIQuestion method removed - AI questions now handled via bubble interface in text-selection.js

    displayQAHistory(qaHistory) {
        // Note: QA History display removed - functionality replaced by Ask Answers section
        // This method is kept for compatibility but does nothing since the DOM element no longer exists
        console.log('QA History display called but element removed - functionality replaced by Ask Answers');
    }

    displayHighlights(highlights) {
        // Clear existing highlights from activity feed first
        this.clearActivityItemsByType('highlight');
        
        // Convert highlights to activity feed items
        if (highlights && highlights.length > 0) {
            highlights.forEach(highlight => {
                this.addActivityItem('highlight', highlight.text, {
                    highlightId: highlight.id,
                    originalText: highlight.text,
                    chapter: highlight.chapter,
                    timestamp: highlight.timestamp
                });
            });
        }
    }

    displayNotes(notes) {
        // Clear existing notes from activity feed first
        this.clearActivityItemsByType('note');
        
        // Convert notes to activity feed items
        if (notes && notes.length > 0) {
            notes.forEach(note => {
                const content = note.selectedText 
                    ? `Selected: "${note.selectedText}"\n\nNote: ${note.text}`
                    : note.text;
                    
                this.addActivityItem('note', content, {
                    noteId: note.id,
                    originalText: note.text,
                    selectedText: note.selectedText,
                    chapter: note.chapter,
                    timestamp: note.timestamp
                });
            });
        }
    }

    displayAskAnswers(askAnswers) {
        // Convert AI answers to activity feed items
        if (askAnswers && askAnswers.length > 0) {
            askAnswers.forEach(answer => {
                const content = `Q: ${answer.question}\n\nSelected: "${answer.selectedText}"\n\nA: ${answer.answer}`;
                
                this.addActivityItem('ai-chat', content, {
                    answerId: answer.id,
                    question: answer.question,
                    answer: answer.answer,
                    selectedText: answer.selectedText,
                    timestamp: answer.timestamp
                });
            });
        }
    }

    expandAnswer(answerId) {
        const currentBook = this.app.fileHandler.getCurrentBook();
        if (!currentBook) return;

        const askAnswers = this.app.storage.getAskAnswers(currentBook.id);
        const answer = askAnswers.find(a => a.id === answerId);
        
        if (answer) {
            // Show full answer in a simple alert for now - could be enhanced with a modal
            const fullText = `Question: ${answer.question}\n\nSelected Text: "${answer.selectedText}"\n\nAnswer: ${answer.answer}`;
            alert(fullText);
        }
    }

    deleteAskAnswer(answerId) {
        if (!confirm('Delete this AI answer?')) return;

        const currentBook = this.app.fileHandler.getCurrentBook();
        if (!currentBook) return;

        const askAnswers = this.app.storage.getAskAnswers(currentBook.id);
        const updatedAnswers = askAnswers.filter(a => a.id !== answerId);
        
        this.app.storage.saveAskAnswers(currentBook.id, updatedAnswers);
        this.displayAskAnswers(updatedAnswers);
    }

    saveNote() {
        const selectedTextPreview = document.getElementById('selectedTextPreview');
        const noteTextarea = document.getElementById('noteTextarea');
        const noteText = noteTextarea.value.trim();

        if (!noteText) {
            this.showError('Please enter a note');
            return;
        }

        const currentBook = this.app.fileHandler.getCurrentBook();
        if (!currentBook) {
            this.showError('No book loaded');
            return;
        }

        try {
            const note = {
                id: this.generateNoteId(),
                text: noteText,
                selectedText: selectedTextPreview.textContent || '',
                timestamp: new Date().toISOString(),
                chapter: this.getCurrentChapter()
            };

            // Apply visual highlighting to the selected text (like highlights do)
            if (note.selectedText && this.preservedSelectedRange) {
                this.applyNoteHighlight(note);
            }

            // Save to storage
            const notes = this.app.storage.getNotes(currentBook.id);
            notes.unshift(note); // Add to beginning
            this.app.storage.saveNotes(currentBook.id, notes);

            // Update display
            this.displayNotes(notes);

            // Close modal
            this.closeNoteModal();

        } catch (error) {
            console.error('Failed to save note:', error);
            this.showError('Failed to save note');
        }
    }

    deleteQA(qaId) {
        const currentBook = this.app.fileHandler.getCurrentBook();
        if (!currentBook) return;

        const qaHistory = this.app.storage.getQAHistory(currentBook.id);
        const updatedHistory = qaHistory.filter(qa => qa.id !== qaId);
        this.app.storage.saveQAHistory(currentBook.id, updatedHistory);
        
        this.displayQAHistory(updatedHistory);
    }

    deleteHighlight(highlightId) {
        const currentBook = this.app.fileHandler.getCurrentBook();
        if (!currentBook) return;

        // Remove from DOM and storage via text selection handler
        this.app.textSelection.removeHighlight(highlightId);
    }

    deleteNote(noteId) {
        const currentBook = this.app.fileHandler.getCurrentBook();
        if (!currentBook) return;

        const notes = this.app.storage.getNotes(currentBook.id);
        const updatedNotes = notes.filter(note => note.id !== noteId);
        this.app.storage.saveNotes(currentBook.id, updatedNotes);
        
        this.displayNotes(updatedNotes);
    }

    openSettingsModal() {
        const settingsModal = document.getElementById('settingsModal');
        const settings = this.app.storage.getSettings();
        
        // Try to load API key from cookies if not in localStorage
        let apiKey = settings.apiKey;
        if (!apiKey) {
            apiKey = this.getApiKeyFromCookie();
        }

        // Populate form with defaults
        document.getElementById('apiEndpoint').value = 'https://webui.plebchat.me/ollama/v1';
        document.getElementById('apiKey').value = apiKey || '';
        document.getElementById('aiModel').value = settings.aiModel || 'gemma3:27b-it-q8_0';

        settingsModal.classList.remove('hidden');
    }
    
    getApiKeyFromCookie() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'vibeReader_apiKey') {
                return decodeURIComponent(value);
            }
        }
        return null;
    }

    saveSettings() {
        const settings = {
            apiEndpoint: 'https://webui.plebchat.me/ollama/v1', // Hardcoded endpoint
            apiKey: document.getElementById('apiKey').value.trim(),
            aiModel: document.getElementById('aiModel').value
        };

        if (!settings.apiKey) {
            this.showError('Please enter an API key');
            return;
        }

        try {
            this.app.storage.saveSettings(settings);
            this.closeSettingsModal();
            this.showSuccess('Settings saved successfully');
            
            // Also save API key to cookies as backup
            document.cookie = `vibeReader_apiKey=${settings.apiKey}; expires=${new Date(Date.now() + 365*24*60*60*1000).toUTCString()}; path=/; SameSite=Strict`;
            
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showError('Failed to save settings');
        }
    }

    closeNoteModal() {
        const noteModal = document.getElementById('noteModal');
        const noteTextarea = document.getElementById('noteTextarea');
        
        noteModal.classList.add('hidden');
        noteTextarea.value = '';
    }

    closeSettingsModal() {
        const settingsModal = document.getElementById('settingsModal');
        settingsModal.classList.add('hidden');
    }

    getCurrentChapter() {
        // Find current chapter based on scroll position
        const readingContainer = document.getElementById('readingContainer');
        const chapters = readingContainer.querySelectorAll('.chapter');
        
        if (chapters.length === 0) return 0;

        const containerRect = readingContainer.getBoundingClientRect();
        const containerCenter = containerRect.top + containerRect.height / 2;

        for (let i = 0; i < chapters.length; i++) {
            const chapterRect = chapters[i].getBoundingClientRect();
            if (chapterRect.top <= containerCenter && chapterRect.bottom >= containerCenter) {
                return i;
            }
        }
        
        return 0;
    }

    formatAIResponse(response) {
        // Basic formatting for AI responses
        return response
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    generateQAId() {
        return 'qa_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateNoteId() {
        return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        if (this.modalManager) {
            this.modalManager.showAlert(message, 'error');
        } else {
            alert('Error: ' + message);
        }
    }

    showSuccess(message) {
        if (this.modalManager) {
            this.modalManager.showAlert(message, 'success');
        } else {
            alert(message);
        }
    }
}

// Export for use in other modules
window.SidebarManager = SidebarManager;
