# VibeReader

A modern web-based ebook reader that transforms your EPUB and MOBI files into an interactive reading experience with AI-powered features.

## Features

### 📚 File Support
- **EPUB** and **MOBI** file ingestion
- Client-side file processing (no server required)
- Automatic chapter and content extraction

### 🎨 Three-Panel Interface

#### Left Panel: Navigation
- **Chapter Outline**: Hierarchical table of contents
- Quick navigation between chapters and sections
- Progress tracking through the book

#### Middle Panel: Reading Experience
- **Scrolling Content Area**: Main reading pane
- Clean, distraction-free typography
- Text selection capabilities
- Responsive design for various screen sizes

#### Right Panel: Smart Sidebar
- **AI Q&A Interface**: Query OpenAI-compatible APIs about the content
- **Highlights**: Collection of highlighted text passages
- **Notes**: Personal annotations and thoughts
- **Context-Aware Features**: Smart suggestions based on selected text

### ✨ Interactive Features

#### Text Selection Menu
When you select text, a contextual menu appears with options to:
- 🎨 **Highlight**: Mark important passages with color coding
- 🤖 **Ask AI**: Query the AI about selected content
- 📝 **Add Note**: Create personal annotations

## Technology Stack

- **Frontend**: Pure HTML5, CSS3, and JavaScript
- **File Processing**: JavaScript-based EPUB/MOBI parsers
- **AI Integration**: OpenAI-compatible API support
- **Storage**: Local browser storage for highlights and notes

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No server installation required - runs entirely in the browser

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/VibeReader.git
   cd VibeReader
   ```

2. Open `index.html` in your web browser:
   ```bash
   open index.html
   ```
   Or simply double-click the `index.html` file.

### Usage

1. **Upload Your Book**:
   - Click the upload button or drag & drop an EPUB/MOBI file
   - Wait for the file to be processed and parsed

2. **Navigate**:
   - Use the left panel to jump between chapters
   - Scroll through content in the middle panel

3. **Interact with Text**:
   - Select any text to reveal the action menu
   - Highlight important passages
   - Add personal notes
   - Ask AI questions about the content

4. **AI Features**:
   - Configure your OpenAI-compatible API endpoint in settings
   - Use the Q&A interface to ask questions about the book
   - Get AI insights on selected passages

## Project Structure

```
VibeReader/
├── index.html          # Main application entry point
├── css/
│   ├── main.css        # Core styling
│   └── themes/         # Color themes and typography
├── js/
│   ├── app.js          # Main application logic
│   ├── parsers/        # EPUB/MOBI file parsers
│   ├── ui/             # UI components and interactions
│   └── ai/             # AI integration modules
├── assets/
│   ├── icons/          # UI icons and graphics
│   └── fonts/          # Custom fonts
└── README.md           # This file
```

## Configuration

### AI Integration
To enable AI features, configure your API settings:

```javascript
// In js/config.js
const AI_CONFIG = {
  apiEndpoint: 'https://webui.plebchat.me/ollama/v1', // Base URL - /chat/completions is appended automatically
  apiKey: 'your-api-key-here', // Store securely!
  model: 'gemma3:27b-it-q8_0'
};
```

**Security Note**: Never commit API keys to version control. Use environment variables or secure configuration methods.

## Development Roadmap

### Phase 1: Core Reader ✅
- [x] Basic HTML structure
- [ ] EPUB/MOBI file parsing
- [ ] Three-panel layout implementation
- [ ] Chapter navigation

### Phase 2: Interactive Features
- [ ] Text selection menu
- [ ] Highlighting system
- [ ] Note-taking functionality
- [ ] Local storage integration

### Phase 3: AI Integration
- [ ] OpenAI API integration
- [ ] Q&A interface
- [ ] Context-aware AI queries
- [ ] Smart content suggestions

### Phase 4: Enhanced Experience
- [ ] Multiple theme support
- [ ] Reading progress tracking
- [ ] Export highlights and notes
- [ ] Bookmarking system
- [ ] Search functionality

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Browser Compatibility

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- EPUB parsing libraries and specifications
- OpenAI for AI integration capabilities
- The open-source community for inspiration and tools

---

**Happy Reading!** 📖✨