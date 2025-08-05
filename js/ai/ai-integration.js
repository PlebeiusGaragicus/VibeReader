// AI Integration for VibeReader

class AIIntegration {
    constructor(app) {
        this.app = app;
        this.settings = null;
        this.loadSettings();
    }

    loadSettings() {
        this.settings = this.app.storage.getSettings();
    }

    async askQuestion(question, bookData) {
        this.loadSettings(); // Refresh settings

        if (!this.settings.apiKey || !this.settings.apiEndpoint) {
            throw new Error('AI settings not configured. Please set up your API key and endpoint in settings.');
        }

        try {
            // Prepare context from the book
            const context = this.prepareBookContext(bookData);
            
            // Create the prompt
            const prompt = this.createPrompt(question, context, bookData.metadata);

            // Make API request
            const response = await this.makeAPIRequest(prompt);
            
            return response;
            
        } catch (error) {
            console.error('AI API error:', error);
            throw new Error('Failed to get AI response: ' + error.message);
        }
    }

    prepareBookContext(bookData) {
        // Extract relevant content for context
        // Limit context size to avoid token limits
        const maxContextLength = 3000;
        let context = '';

        // Add metadata
        context += `Title: ${bookData.metadata.title}\n`;
        context += `Author: ${bookData.metadata.creator}\n`;
        if (bookData.metadata.description) {
            context += `Description: ${bookData.metadata.description}\n`;
        }
        context += '\n';

        // Add table of contents
        if (bookData.toc && bookData.toc.length > 0) {
            context += 'Table of Contents:\n';
            bookData.toc.forEach((item, index) => {
                context += `${index + 1}. ${item.title}\n`;
            });
            context += '\n';
        }

        // Add content excerpts
        if (bookData.content && bookData.content.length > 0) {
            context += 'Content excerpts:\n';
            
            for (const chapter of bookData.content) {
                if (context.length > maxContextLength) break;
                
                // Extract text content from HTML
                const textContent = this.extractTextFromHTML(chapter.content);
                const excerpt = textContent.substring(0, 500);
                
                context += `Chapter: ${chapter.title}\n${excerpt}...\n\n`;
            }
        }

        return context.substring(0, maxContextLength);
    }

    createPrompt(question, context, metadata) {
        return `You are an AI assistant helping a user understand and analyze a book they are reading. 

Book Information:
${context}

User Question: ${question}

Please provide a helpful, accurate, and insightful response based on the book content. If the question cannot be answered from the provided context, please say so and offer general guidance if appropriate.`;
    }

    async makeAPIRequest(prompt) {
        const requestBody = {
            model: this.settings.aiModel || 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful AI assistant specialized in analyzing and discussing books. Provide clear, insightful responses based on the book content provided.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 500,
            temperature: 0.7
        };

        const response = await fetch(this.settings.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
        }

        const data = await response.json();
        
        if (!data.choices || data.choices.length === 0) {
            throw new Error('No response from AI API');
        }

        return data.choices[0].message.content.trim();
    }

    extractTextFromHTML(html) {
        // Create a temporary element to extract text content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remove script and style elements
        const scripts = tempDiv.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        return tempDiv.textContent || tempDiv.innerText || '';
    }

    async askAboutSelection(selectedText, bookData) {
        const question = `What does this passage mean and what is its significance in the context of the book: "${selectedText}"`;
        return await this.askQuestion(question, bookData);
    }

    async summarizeChapter(chapterContent, chapterTitle, bookData) {
        const textContent = this.extractTextFromHTML(chapterContent);
        const question = `Please provide a summary of this chapter titled "${chapterTitle}": ${textContent.substring(0, 2000)}`;
        return await this.askQuestion(question, bookData);
    }

    async explainConcept(concept, bookData) {
        const question = `Can you explain the concept or theme of "${concept}" as it relates to this book?`;
        return await this.askQuestion(question, bookData);
    }

    async getCharacterAnalysis(characterName, bookData) {
        const question = `Can you provide an analysis of the character "${characterName}" in this book?`;
        return await this.askQuestion(question, bookData);
    }

    async getThemeAnalysis(bookData) {
        const question = `What are the main themes in this book and how are they developed?`;
        return await this.askQuestion(question, bookData);
    }

    isConfigured() {
        this.loadSettings();
        return !!(this.settings.apiKey && this.settings.apiEndpoint);
    }

    getConfigurationStatus() {
        this.loadSettings();
        return {
            hasApiKey: !!this.settings.apiKey,
            hasEndpoint: !!this.settings.apiEndpoint,
            model: this.settings.aiModel || 'gpt-3.5-turbo'
        };
    }
}

// Export for use in other modules
window.AIIntegration = AIIntegration;
