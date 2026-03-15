// Theme Manager - Dark/Light Mode Toggle

export class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.init();
    }

    init() {
        this.applyTheme();
        this.bindEvents();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        this.updateIcon();
    }

    updateIcon() {
        const icon = document.querySelector('#themeToggle .theme-icon, #theme-toggle .material-symbols-outlined');
        if (icon) {
            icon.textContent = this.theme === 'dark' ? '🌞' : '🌙';
        }
    }

    toggle() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
    }

    bindEvents() {
        const themeToggle = document.getElementById('themeToggle') || document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggle());
        }
    }
}

// Initialize theme on page load
new ThemeManager();
