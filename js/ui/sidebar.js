// Sidebar Manager for VibeReader

class SidebarManager {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Ask AI button
        document.getElementById('askBtn').addEventListener('click', () => {
            this.handleAIQuestion();
        });

        // Question input enter key
        document.getElementById('questionInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleAIQuestion();
            }
        });

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
    }

    // togglePanel method removed - collapse functionality no longer needed

    async handleAIQuestion() {
        const questionInput = document.getElementById('questionInput');
        const askBtn = document.getElementById('askBtn');
        const question = questionInput.value.trim();

        if (!question) return;

        const currentBook = this.app.fileHandler.getCurrentBook();
        if (!currentBook) {
            this.showError('Please upload a book first');
            return;
        }

        try {
            askBtn.disabled = true;
            askBtn.textContent = 'Asking...';

            // Get AI response
            const response = await this.app.aiIntegration.askQuestion(question, currentBook);

            // Add to Q&A history
            const qaItem = {
                id: this.generateQAId(),
                question: question,
                answer: response,
                timestamp: new Date().toISOString()
            };

            // Save to storage
            const qaHistory = this.app.storage.getQAHistory(currentBook.id);
            qaHistory.unshift(qaItem); // Add to beginning
            this.app.storage.saveQAHistory(currentBook.id, qaHistory);

            // Update display
            this.displayQAHistory(qaHistory);

            // Clear input
            questionInput.value = '';

        } catch (error) {
            console.error('AI question error:', error);
            this.showError('Failed to get AI response: ' + error.message);
        } finally {
            askBtn.disabled = false;
            askBtn.textContent = 'Ask';
        }
    }

    displayQAHistory(qaHistory) {
        const qaHistoryContainer = document.getElementById('qaHistory');
        
        if (!qaHistory || qaHistory.length === 0) {
            qaHistoryContainer.innerHTML = '<div class="no-content-message"><p>Ask questions to get AI insights!</p></div>';
            return;
        }

        const qaHTML = qaHistory.map(qa => `
            <div class="qa-item" data-qa-id="${qa.id}">
                <div class="qa-question">${this.escapeHTML(qa.question)}</div>
                <div class="qa-answer">${this.formatAIResponse(qa.answer)}</div>
                <div class="item-meta">
                    <span>${new Date(qa.timestamp).toLocaleDateString()}</span>
                    <button class="delete-btn" onclick="app.sidebar.deleteQA('${qa.id}')">🗑️</button>
                </div>
            </div>
        `).join('');

        qaHistoryContainer.innerHTML = qaHTML;
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

        // Populate form
        document.getElementById('apiEndpoint').value = settings.apiEndpoint || '';
        document.getElementById('apiKey').value = settings.apiKey || '';
        document.getElementById('aiModel').value = settings.aiModel || 'gpt-3.5-turbo';

        settingsModal.classList.remove('hidden');
    }

    saveSettings() {
        const settings = {
            apiEndpoint: document.getElementById('apiEndpoint').value.trim(),
            apiKey: document.getElementById('apiKey').value.trim(),
            aiModel: document.getElementById('aiModel').value
        };

        if (!settings.apiEndpoint) {
            this.showError('Please enter an API endpoint');
            return;
        }

        if (!settings.apiKey) {
            this.showError('Please enter an API key');
            return;
        }

        try {
            this.app.storage.saveSettings(settings);
            this.closeSettingsModal();
            this.showSuccess('Settings saved successfully');
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
