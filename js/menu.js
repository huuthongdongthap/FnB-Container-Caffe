// Menu Manager - Tab Navigation, Filter & Search

export class MenuManager {
    constructor() {
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.init();
    }

    init() {
        this.bindFilterEvents();
        this.bindSearchEvents();
        this.bindAddToCartEvents();
    }

    bindFilterEvents() {
        const filterChips = document.querySelectorAll('.m3-filter-chip');
        filterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const filter = chip.dataset.filter;
                this.switchFilter(filter);
            });
        });
    }

    bindSearchEvents() {
        const searchInput = document.getElementById('menuSearch');
        const searchClear = document.getElementById('searchClear');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.trim().toLowerCase();
                this.filterMenuItems();
                searchClear.style.opacity = this.searchQuery ? '1' : '0';
            });
        }

        if (searchClear) {
            searchClear.addEventListener('click', () => {
                searchInput.value = '';
                this.searchQuery = '';
                this.filterMenuItems();
                searchClear.style.opacity = '0';
            });
        }
    }

    bindAddToCartEvents() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.m3-add-cart-btn');
            if (btn) {
                const product = JSON.parse(btn.dataset.product);
                if (window.cartManager) {
                    window.cartManager.add(product);
                    this.showAddToast(product.name);
                }
            }
        });
    }

    switchFilter(filter) {
        // Update active chip
        document.querySelectorAll('.m3-filter-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.filter === filter);
        });

        // Show/hide categories
        document.querySelectorAll('.menu-category').forEach(category => {
            if (filter === 'all') {
                category.classList.add('active');
            } else {
                category.classList.toggle('active', category.dataset.category === filter);
            }
        });

        this.currentCategory = filter;
        this.filterMenuItems();
    }

    filterMenuItems() {
        const items = document.querySelectorAll('.m3-menu-card');

        items.forEach(item => {
            const category = item.dataset.category;
            const title = item.querySelector('.m3-card-title')?.textContent.toLowerCase() || '';
            const desc = item.querySelector('.m3-card-desc')?.textContent.toLowerCase() || '';

            const categoryMatch = this.currentCategory === 'all' || category === this.currentCategory;
            const searchMatch = !this.searchQuery ||
                               title.includes(this.searchQuery) ||
                               desc.includes(this.searchQuery);

            item.style.display = categoryMatch && searchMatch ? 'block' : 'none';
        });
    }

    showAddToast(productName) {
        const toast = document.createElement('div');
        toast.className = 'm3-toast';
        toast.innerHTML = `✓ Đã thêm <strong>${productName}</strong> vào giỏ hàng`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}

// Initialize menu on page load
new MenuManager();
