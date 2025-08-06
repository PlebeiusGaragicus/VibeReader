class ThemeManager {
    constructor() {
        this.themes = ['system', 'light', 'dark'];
        this.currentTheme = this.loadTheme();
        this.themeButton = null;
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        
        // Setup theme button after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupThemeButton());
        } else {
            this.setupThemeButton();
        }
    }

    setupThemeButton() {
        this.themeButton = document.getElementById('themeToggleBtn');
        if (this.themeButton) {
            this.themeButton.addEventListener('click', () => this.toggleTheme());
            this.updateThemeButtonIcon();
            console.log('Theme toggle button initialized');
        } else {
            console.warn('Theme toggle button not found');
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('vibeReaderTheme');
        return savedTheme && this.themes.includes(savedTheme) ? savedTheme : 'system';
    }

    saveTheme(theme) {
        localStorage.setItem('vibeReaderTheme', theme);
    }

    applyTheme(theme) {
        const body = document.body;
        
        // Remove all theme classes
        body.classList.remove('light-theme', 'dark-theme');
        
        if (theme === 'light') {
            body.classList.add('light-theme');
        } else if (theme === 'dark') {
            body.classList.add('dark-theme');
        }
        // For 'system', we rely on the CSS media query
        
        this.currentTheme = theme;
        this.saveTheme(theme);
        this.updateThemeButtonIcon();
    }

    toggleTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % this.themes.length;
        const nextTheme = this.themes[nextIndex];
        
        this.applyTheme(nextTheme);
    }

    updateThemeButtonIcon() {
        if (!this.themeButton) return;
        
        const icons = {
            system: '🌓', // Half moon for system
            light: '☀️',  // Sun for light
            dark: '🌙'    // Moon for dark
        };
        
        const titles = {
            system: 'System Theme',
            light: 'Light Theme', 
            dark: 'Dark Theme'
        };
        
        this.themeButton.textContent = icons[this.currentTheme];
        this.themeButton.title = `Current: ${titles[this.currentTheme]} (Click to cycle)`;
    }

    getCurrentTheme() {
        return this.currentTheme;
    }
}

window.ThemeManager = ThemeManager;
