// MOBI Parser for VibeReader
// Note: This is a simplified MOBI parser for basic functionality
// Full MOBI parsing is complex and may require additional libraries

class MOBIParser {
    constructor() {
        this.header = null;
        this.records = [];
        this.textRecords = [];
        this.metadata = {};
        this.toc = [];
    }

    async parseFile(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const dataView = new DataView(arrayBuffer);
            
            // Parse PDB header
            await this.parsePDBHeader(dataView);
            
            // Parse MOBI header
            await this.parseMOBIHeader(dataView);
            
            // Extract text content
            const content = await this.extractContent(dataView);
            
            // Generate basic table of contents
            this.generateTOC(content);
            
            return {
                metadata: this.metadata,
                toc: this.toc,
                content: content,
                type: 'mobi'
            };
        } catch (error) {
            console.error('Error parsing MOBI:', error);
            throw new Error('Failed to parse MOBI file: ' + error.message);
        }
    }

    async parsePDBHeader(dataView) {
        // PDB Header is 78 bytes
        const name = this.readString(dataView, 0, 32);
        const type = this.readString(dataView, 60, 4);
        const creator = this.readString(dataView, 64, 4);
        
        if (type !== 'BOOK' && creator !== 'MOBI') {
            throw new Error('Not a valid MOBI file');
        }

        const recordCount = dataView.getUint16(76, false);
        
        // Read record info entries
        let offset = 78;
        for (let i = 0; i < recordCount; i++) {
            const recordOffset = dataView.getUint32(offset, false);
            const recordAttributes = dataView.getUint8(offset + 4);
            const recordId = dataView.getUint32(offset + 5, false) & 0xFFFFFF;
            
            this.records.push({
                offset: recordOffset,
                attributes: recordAttributes,
                id: recordId
            });
            
            offset += 8;
        }
    }

    async parseMOBIHeader(dataView) {
        if (this.records.length === 0) {
            throw new Error('No records found in MOBI file');
        }

        const firstRecord = this.records[0];
        let offset = firstRecord.offset;

        // Read PalmDOC header
        const compression = dataView.getUint16(offset, false);
        const textLength = dataView.getUint32(offset + 4, false);
        const recordCount = dataView.getUint16(offset + 8, false);
        const recordSize = dataView.getUint16(offset + 10, false);
        
        offset += 16;

        // Check for MOBI header
        const mobiIdentifier = this.readString(dataView, offset, 4);
        if (mobiIdentifier !== 'MOBI') {
            throw new Error('MOBI header not found');
        }

        // Read MOBI header
        const headerLength = dataView.getUint32(offset + 4, false);
        const mobiType = dataView.getUint32(offset + 8, false);
        const textEncoding = dataView.getUint32(offset + 12, false);
        
        // Extract metadata
        this.metadata = {
            title: this.extractTitle(dataView, offset, headerLength),
            creator: 'Unknown Author',
            language: this.getLanguage(dataView.getUint32(offset + 92, false)),
            compression: compression,
            textLength: textLength,
            recordCount: recordCount,
            type: 'mobi'
        };

        // Store text record information
        for (let i = 1; i <= recordCount; i++) {
            if (i < this.records.length) {
                this.textRecords.push(this.records[i]);
            }
        }
    }

    async extractContent(dataView) {
        const content = [];
        let fullText = '';

        // Extract and decompress text from records
        for (let i = 0; i < this.textRecords.length; i++) {
            const record = this.textRecords[i];
            const nextRecord = this.textRecords[i + 1] || { offset: dataView.byteLength };
            const recordLength = nextRecord.offset - record.offset;
            
            try {
                const recordData = new Uint8Array(dataView.buffer, record.offset, recordLength);
                const decompressedText = this.decompressText(recordData);
                fullText += decompressedText;
            } catch (error) {
                console.warn(`Failed to extract text from record ${i}:`, error);
            }
        }

        // Clean up the text
        fullText = this.cleanupText(fullText);

        // Split into chapters (basic approach)
        const chapters = this.splitIntoChapters(fullText);
        
        chapters.forEach((chapter, index) => {
            content.push({
                id: `chapter-${index}`,
                href: `#chapter-${index}`,
                title: chapter.title || `Chapter ${index + 1}`,
                content: this.formatHTML(chapter.content)
            });
        });

        return content;
    }

    decompressText(data) {
        // Simple PalmDOC decompression
        const result = [];
        let i = 0;

        while (i < data.length) {
            const byte = data[i];
            
            if (byte === 0) {
                // Null byte - just add it
                result.push(0);
                i++;
            } else if (byte >= 1 && byte <= 8) {
                // Copy next byte literally
                i++;
                if (i < data.length) {
                    result.push(data[i]);
                }
                i++;
            } else if (byte >= 0x80 && byte <= 0xBF) {
                // Two-byte compression
                if (i + 1 < data.length) {
                    const byte2 = data[i + 1];
                    const distance = ((byte & 0x3F) << 3) | (byte2 >> 5);
                    const length = (byte2 & 0x1F) + 3;
                    
                    // Copy from earlier in the result
                    const startPos = result.length - distance;
                    for (let j = 0; j < length; j++) {
                        if (startPos + j >= 0 && startPos + j < result.length) {
                            result.push(result[startPos + j]);
                        }
                    }
                }
                i += 2;
            } else if (byte >= 0xC0) {
                // Single space + character
                result.push(32); // space
                result.push(byte ^ 0x80);
                i++;
            } else {
                // Regular character
                result.push(byte);
                i++;
            }
        }

        // Convert to string
        return new TextDecoder('utf-8', { ignoreBOM: true, fatal: false })
            .decode(new Uint8Array(result));
    }

    cleanupText(text) {
        // Remove control characters and clean up formatting
        return text
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .trim();
    }

    splitIntoChapters(text) {
        const chapters = [];
        
        // Try to split by common chapter markers
        const chapterMarkers = [
            /Chapter\s+\d+/gi,
            /CHAPTER\s+\d+/g,
            /\n\s*\d+\s*\n/g,
            /\n\s*[IVX]+\s*\n/g
        ];

        let splits = [text];
        
        for (const marker of chapterMarkers) {
            const newSplits = [];
            for (const split of splits) {
                const parts = split.split(marker);
                if (parts.length > 1) {
                    newSplits.push(...parts);
                } else {
                    newSplits.push(split);
                }
            }
            if (newSplits.length > splits.length) {
                splits = newSplits;
                break;
            }
        }

        // If no clear chapters found, split by length
        if (splits.length === 1) {
            const chapterLength = Math.max(2000, Math.floor(text.length / 10));
            splits = [];
            for (let i = 0; i < text.length; i += chapterLength) {
                splits.push(text.substring(i, i + chapterLength));
            }
        }

        splits.forEach((content, index) => {
            if (content.trim().length > 0) {
                const title = this.extractChapterTitle(content) || `Chapter ${index + 1}`;
                chapters.push({
                    title: title,
                    content: content.trim()
                });
            }
        });

        return chapters;
    }

    extractChapterTitle(content) {
        const lines = content.split('\n');
        for (const line of lines.slice(0, 5)) {
            const trimmed = line.trim();
            if (trimmed.length > 0 && trimmed.length < 100) {
                // Check if it looks like a title
                if (/^(Chapter|CHAPTER|\d+|[IVX]+)/.test(trimmed)) {
                    return trimmed;
                }
            }
        }
        return null;
    }

    formatHTML(text) {
        // Convert plain text to basic HTML
        return text
            .split('\n\n')
            .map(paragraph => paragraph.trim())
            .filter(paragraph => paragraph.length > 0)
            .map(paragraph => `<p>${this.escapeHTML(paragraph)}</p>`)
            .join('\n');
    }

    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    generateTOC(content) {
        this.toc = content.map((chapter, index) => ({
            id: `toc-${index}`,
            title: chapter.title,
            href: `#chapter-${index}`,
            level: 1
        }));
    }

    extractTitle(dataView, offset, headerLength) {
        // Try to extract title from MOBI header
        // This is a simplified approach
        try {
            const titleOffset = offset + 84; // Approximate title offset
            const titleLength = Math.min(32, headerLength - 84);
            return this.readString(dataView, titleOffset, titleLength).trim() || 'Unknown Title';
        } catch (error) {
            return 'Unknown Title';
        }
    }

    getLanguage(languageCode) {
        const languages = {
            1: 'en', // English
            2: 'fr', // French
            3: 'de', // German
            4: 'es', // Spanish
            5: 'it', // Italian
            // Add more as needed
        };
        return languages[languageCode] || 'en';
    }

    readString(dataView, offset, length) {
        const bytes = [];
        for (let i = 0; i < length; i++) {
            const byte = dataView.getUint8(offset + i);
            if (byte === 0) break;
            bytes.push(byte);
        }
        return new TextDecoder('utf-8', { ignoreBOM: true, fatal: false })
            .decode(new Uint8Array(bytes));
    }
}

// Export for use in other modules
window.MOBIParser = MOBIParser;
