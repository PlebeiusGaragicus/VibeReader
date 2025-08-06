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
            apiEndpoint: 'https://webui.plebchat.me/ollama/v1',
            apiKey: '',
            aiModel: 'gemma3:27b-it-q8_0'
        };
    }

    // Book Data
    saveBookData(bookId, bookData) {
        try {
            const dataString = JSON.stringify(bookData);
            
            // Compress the data using LZ-string
            const compressedData = LZString.compressToUTF16(dataString);
            console.log(`Compression: ${dataString.length} -> ${compressedData.length} (${Math.round((1 - compressedData.length / dataString.length) * 100)}% reduction)`);
            
            // Try to store compressed data normally first
            try {
                localStorage.setItem(`vibeReader_book_${bookId}`, compressedData);
                // Clean up any existing chunks since we stored it normally
                this.cleanupChunks(bookId);
                return;
            } catch (quotaError) {
                console.log('Normal storage failed even with compression, using chunking strategy...');
                // Remove the failed attempt
                localStorage.removeItem(`vibeReader_book_${bookId}`);
            }
            
            // Chunking strategy with compressed data and smaller chunks
            const chunkSize = 500 * 1024; // 500KB chunks (smaller for Safari)
            
            // Clean up existing chunks first to free space
            this.cleanupChunks(bookId);
            
            // Try to free up space by cleaning old data
            this.cleanupOldData();
            
            // More aggressive cleanup - remove other books' data if needed
            this.emergencyCleanup(bookId);
            
            // Split compressed data into chunks
            const chunks = [];
            for (let i = 0; i < compressedData.length; i += chunkSize) {
                chunks.push(compressedData.slice(i, i + chunkSize));
            }
            
            // Store chunks one by one with error handling
            for (let i = 0; i < chunks.length; i++) {
                try {
                    localStorage.setItem(`vibeReader_book_${bookId}_chunk_${i}`, chunks[i]);
                } catch (chunkError) {
                    // If we can't store a chunk, clean up and throw
                    this.cleanupChunks(bookId);
                    throw new Error('Storage quota exceeded even with compression and chunking. Please try a smaller book or clear browser data.');
                }
            }
            
            // Store chunk count and compression flag
            localStorage.setItem(`vibeReader_book_${bookId}_chunks`, chunks.length.toString());
            localStorage.setItem(`vibeReader_book_${bookId}_compressed`, 'true');
            
        } catch (error) {
            console.error('Failed to save book data:', error);
            throw error;
        }
    }

    getBookData(bookId) {
        // Try to get data using the new format first
        const data = localStorage.getItem(`vibeReader_book_${bookId}`);
        if (data) {
            // Check if data is compressed
            try {
                // Try to decompress first
                const decompressed = LZString.decompressFromUTF16(data);
                if (decompressed) {
                    return JSON.parse(decompressed);
                }
                // If decompression fails, try parsing directly (backward compatibility)
                return JSON.parse(data);
            } catch (error) {
                console.warn('Failed to parse book data:', error);
                return null;
            }
        }

        // Check for chunked data
        const chunkCount = localStorage.getItem(`vibeReader_book_${bookId}_chunks`);
        if (chunkCount) {
            const chunks = [];
            for (let i = 0; i < parseInt(chunkCount); i++) {
                const chunk = localStorage.getItem(`vibeReader_book_${bookId}_chunk_${i}`);
                if (chunk) {
                    chunks.push(chunk);
                }
            }
            if (chunks.length === parseInt(chunkCount)) {
                const combinedData = chunks.join('');
                const isCompressed = localStorage.getItem(`vibeReader_book_${bookId}_compressed`) === 'true';
                
                try {
                    if (isCompressed) {
                        const decompressed = LZString.decompressFromUTF16(combinedData);
                        return JSON.parse(decompressed);
                    } else {
                        return JSON.parse(combinedData);
                    }
                } catch (error) {
                    console.warn('Failed to parse chunked book data:', error);
                    return null;
                }
            }
        }

        // Fallback to old format for backward compatibility
        const oldData = localStorage.getItem(this.prefix + 'book_' + bookId);
        return oldData ? JSON.parse(oldData) : null;
    }

    cleanupChunks(bookId) {
        const chunkCount = localStorage.getItem(`vibeReader_book_${bookId}_chunks`);
        if (chunkCount) {
            for (let i = 0; i < parseInt(chunkCount); i++) {
                localStorage.removeItem(`vibeReader_book_${bookId}_chunk_${i}`);
            }
            localStorage.removeItem(`vibeReader_book_${bookId}_chunks`);
            localStorage.removeItem(`vibeReader_book_${bookId}_compressed`);
        }
    }

    cleanupOldData() {
        // Remove any orphaned chunks or old data to free up space
        const keys = Object.keys(localStorage);
        const currentTime = Date.now();
        
        keys.forEach(key => {
            // Remove old temporary data or corrupted entries
            if (key.startsWith('vibeReader_temp_') || 
                key.startsWith('vibeReader_book_') && !localStorage.getItem(key)) {
                localStorage.removeItem(key);
            }
        });
        
        console.log('Cleaned up old localStorage data');
    }

    emergencyCleanup(currentBookId) {
        console.log('Emergency cleanup: freeing space for new book');
        
        // Remove all other book data except the current one
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('vibeReader_book_') || key.startsWith(this.prefix + 'book_')) {
                const bookId = key.replace('vibeReader_book_', '').replace(this.prefix + 'book_', '').split('_')[0];
                if (bookId !== currentBookId) {
                    localStorage.removeItem(key);
                }
            }
            
            // Remove chunked data for other books
            if ((key.includes('_chunk_') || key.includes('_chunks')) && !key.includes(currentBookId)) {
                localStorage.removeItem(key);
            }
        });
        
        console.log('Emergency cleanup completed');
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

    // Ask Answers (Text Selection AI Responses)
    saveAskAnswers(bookId, answers) {
        localStorage.setItem(this.prefix + 'ask_answers_' + bookId, JSON.stringify(answers));
    }

    getAskAnswers(bookId) {
        const answers = localStorage.getItem(this.prefix + 'ask_answers_' + bookId);
        return answers ? JSON.parse(answers) : [];
    }

    // Last book management
    saveLastBook(bookId) {
        localStorage.setItem(this.prefix + 'lastBook', bookId);
    }

    getLastBook() {
        return localStorage.getItem(this.prefix + 'lastBook');
    }

    // Clear all books except the current one, but preserve user data (notes, highlights, ask answers)
    clearOtherBooks(currentBookId) {
        const keys = Object.keys(localStorage);
        const prefix = this.prefix;
        
        keys.forEach(key => {
            // Handle old format book data
            if (key.startsWith(prefix + 'book_')) {
                const bookId = key.replace(prefix + 'book_', '');
                if (bookId !== currentBookId) {
                    // Remove book data but keep user annotations
                    localStorage.removeItem(key);
                    localStorage.removeItem(prefix + 'progress_' + bookId);
                    localStorage.removeItem(prefix + 'qa_' + bookId);
                    // Keep: highlights_, notes_, ask_answers_
                }
            }
            
            // Handle new format book data and chunks
            if (key.startsWith('vibeReader_book_')) {
                const bookId = key.replace('vibeReader_book_', '').split('_')[0];
                if (bookId !== currentBookId) {
                    // Remove main book data
                    if (key === `vibeReader_book_${bookId}`) {
                        localStorage.removeItem(key);
                    }
                    // Remove chunked data
                    if (key.includes('_chunk_') || key.includes('_chunks')) {
                        localStorage.removeItem(key);
                    }
                    // Remove other book-specific data
                    localStorage.removeItem(prefix + 'progress_' + bookId);
                    localStorage.removeItem(prefix + 'qa_' + bookId);
                    // Keep: highlights_, notes_, ask_answers_
                }
            }
        });
    }

    // Clear book-specific data
    clearBookData(bookId) {
        const keys = ['book_', 'highlights_', 'notes_', 'progress_', 'qa_', 'ask_answers_'];
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
