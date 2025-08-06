// Sidebar Manager for VibeReader

class SidebarManager {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Collapsible section toggles - only on toggle button and header text
        document.querySelectorAll('.section-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const header = toggle.closest('.section-header');
                this.toggleSection(header.dataset.section);
            });
        });
        
        document.querySelectorAll('.section-header h4').forEach(h4 => {
            h4.addEventListener('click', (e) => {
                e.stopPropagation();
                const header = h4.closest('.section-header');
                this.toggleSection(header.dataset.section);
            });
        });

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
        
        // Load saved section states
        this.loadSectionStates();
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
        const highlightsContainer = document.getElementById('highlightsContainer');
        
        if (!highlights || highlights.length === 0) {
            highlightsContainer.innerHTML = '<div class="no-content-message"><p>Select text and highlight to save important passages</p></div>';
            return;
        }

        const highlightsHTML = highlights.map(highlight => `
            <div class="highlight-item" data-highlight-id="${highlight.id}">
                <div class="highlight-text">${this.escapeHTML(highlight.text)}</div>
                <div class="item-meta">
                    <span>Chapter ${highlight.chapter + 1} • ${new Date(highlight.timestamp).toLocaleDateString()}</span>
                    <button class="delete-btn" onclick="app.sidebar.deleteHighlight('${highlight.id}')">🗑️</button>
                </div>
            </div>
        `).join('');

        highlightsContainer.innerHTML = highlightsHTML;
    }

    displayNotes(notes) {
        const notesContainer = document.getElementById('notesContainer');
        
        if (!notes || notes.length === 0) {
            notesContainer.innerHTML = '<div class="no-content-message"><p>Add personal notes and thoughts while reading</p></div>';
            return;
        }

        const notesHTML = notes.map(note => `
            <div class="note-item" data-note-id="${note.id}">
                ${note.selectedText ? `<div class="highlight-text">${this.escapeHTML(note.selectedText)}</div>` : ''}
                <div class="note-text">${this.escapeHTML(note.text)}</div>
                <div class="item-meta">
                    <span>Chapter ${note.chapter + 1} • ${new Date(note.timestamp).toLocaleDateString()}</span>
                    <button class="delete-btn" onclick="app.sidebar.deleteNote('${note.id}')">🗑️</button>
                </div>
            </div>
        `).join('');

        notesContainer.innerHTML = notesHTML;
    }

    displayAskAnswers(askAnswers) {
        const askAnswersContainer = document.getElementById('askAnswersList');
        
        if (!askAnswers || askAnswers.length === 0) {
            askAnswersContainer.innerHTML = `
                <div class="no-content-message">
                    <p>Select text and ask AI questions to see answers here!</p>
                </div>
            `;
            return;
        }

        const answersHTML = askAnswers.map(answer => {
            const truncatedResponse = answer.answer.length > 200 
                ? answer.answer.substring(0, 200) + '...' 
                : answer.answer;
            
            const truncatedSelectedText = answer.selectedText.length > 80 
                ? answer.selectedText.substring(0, 80) + '...' 
                : answer.selectedText;

            return `
                <div class="ask-answer-item" data-answer-id="${answer.id}">
                    <div class="ask-answer-question">${this.escapeHTML(answer.question)}</div>
                    <div class="ask-answer-selected-text">"${this.escapeHTML(truncatedSelectedText)}"</div>
                    <div class="ask-answer-response">${this.escapeHTML(truncatedResponse)}</div>
                    <div class="ask-answer-meta">
                        <span class="ask-answer-timestamp">${new Date(answer.timestamp).toLocaleDateString()}</span>
                        <div class="ask-answer-actions">
                            <button class="ask-answer-action" onclick="app.sidebar.expandAnswer('${answer.id}')" title="View full answer">📖 Expand</button>
                            <button class="ask-answer-action" onclick="app.sidebar.deleteAskAnswer('${answer.id}')" title="Delete answer">🗑️ Delete</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        askAnswersContainer.innerHTML = answersHTML;
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
        // Simple error display - could be enhanced with a proper notification system
        alert('Error: ' + message);
    }

    showSuccess(message) {
        // Simple success display - could be enhanced with a proper notification system
        alert(message);
    }
}

// Export for use in other modules
window.SidebarManager = SidebarManager;
