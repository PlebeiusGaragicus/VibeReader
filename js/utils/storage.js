// Local Storage Utilities for VibeReader

class StorageManager {
    constructor() {
        this.prefix = 'vibeReader_';
    }

    // Settings
    saveSettings(settings) {
        localStorage.setItem(this.prefix + 'settings', JSON.stringify(settings));
    }

    getSettings() {
        const settings = localStorage.getItem(this.prefix + 'settings');
        return settings ? JSON.parse(settings) : {
            apiEndpoint: 'https://api.openai.com/v1/chat/completions',
            apiKey: '',
            aiModel: 'gpt-3.5-turbo'
        };
    }

    // Book Data
    saveBookData(bookId, data) {
        localStorage.setItem(this.prefix + 'book_' + bookId, JSON.stringify(data));
    }

    getBookData(bookId) {
        const data = localStorage.getItem(this.prefix + 'book_' + bookId);
        return data ? JSON.parse(data) : null;
    }

    // Highlights
    saveHighlights(bookId, highlights) {
        localStorage.setItem(this.prefix + 'highlights_' + bookId, JSON.stringify(highlights));
    }

    getHighlights(bookId) {
        const highlights = localStorage.getItem(this.prefix + 'highlights_' + bookId);
        return highlights ? JSON.parse(highlights) : [];
    }

    // Notes
    saveNotes(bookId, notes) {
        localStorage.setItem(this.prefix + 'notes_' + bookId, JSON.stringify(notes));
    }

    getNotes(bookId) {
        const notes = localStorage.getItem(this.prefix + 'notes_' + bookId);
        return notes ? JSON.parse(notes) : [];
    }

    // Reading Progress
    saveProgress(bookId, progress) {
        localStorage.setItem(this.prefix + 'progress_' + bookId, JSON.stringify(progress));
    }

    getProgress(bookId) {
        const progress = localStorage.getItem(this.prefix + 'progress_' + bookId);
        return progress ? JSON.parse(progress) : { chapter: 0, position: 0, percentage: 0 };
    }

    // Q&A History
    saveQAHistory(bookId, history) {
        localStorage.setItem(this.prefix + 'qa_' + bookId, JSON.stringify(history));
    }

    getQAHistory(bookId) {
        const history = localStorage.getItem(this.prefix + 'qa_' + bookId);
        return history ? JSON.parse(history) : [];
    }

    // Clear book-specific data
    clearBookData(bookId) {
        const keys = ['book_', 'highlights_', 'notes_', 'progress_', 'qa_'];
        keys.forEach(key => {
            localStorage.removeItem(this.prefix + key + bookId);
        });
    }

    // Get all stored book IDs
    getStoredBooks() {
        const books = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.prefix + 'book_')) {
                const bookId = key.replace(this.prefix + 'book_', '');
                books.push(bookId);
            }
        }
        return books;
    }
}

// Export for use in other modules
window.StorageManager = StorageManager;
