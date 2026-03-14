// Menu Manager - Tab Navigation & Item Display

export class MenuManager {
    constructor() {
        this.currentCategory = 'coffee';
        this.init();
    }

    init() {
        this.bindTabEvents();
    }

    bindTabEvents() {
        const tabs = document.querySelectorAll('.menu-tabs md-primary-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.dataset.category;
                this.switchCategory(category);
            });
        });
    }

    switchCategory(category) {
        // Update active tab
        document.querySelectorAll('.menu-tabs md-primary-tab').forEach(tab => {
            tab.selected = tab.dataset.category === category;
        });

        // Update active content
        document.querySelectorAll('.menu-category').forEach(content => {
            content.classList.remove('active');
            if (content.dataset.category === category) {
                content.classList.add('active');
            }
        });

        this.currentCategory = category;
    }
}

// Initialize menu on page load
new MenuManager();
