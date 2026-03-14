/**
 * F&B Caffe Container — Dashboard UI Components
 * Reusable components for admin dashboard
 */

/**
 * Modal Component
 * Usage: Modal.show({ title, content, actions })
 */
const Modal = {
    overlay: null,
    modalEl: null,

    init() {
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });

        document.body.appendChild(this.overlay);
    },

    show({ title, content, actions = [], size = 'medium' }) {
        if (!this.overlay) this.init();

        const actionsHTML = actions.map(action =>
            `<button class="btn ${action.variant || 'secondary'}" data-action="${action.id}">${action.label}</button>`
        ).join('');

        this.overlay.innerHTML = `
            <div class="modal modal-${size}">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="Modal.hide()">×</button>
                </div>
                <div class="modal-body">${content}</div>
                ${actionsHTML ? `<div class="modal-footer">${actionsHTML}</div>` : ''}
            </div>
        `;

        this.overlay.style.display = 'flex';
        this.overlay.style.opacity = '1';

        // Handle action clicks
        actions.forEach(action => {
            const btn = this.overlay.querySelector(`[data-action="${action.id}"]`);
            if (btn) {
                btn.addEventListener('click', () => {
                    action.onClick();
                    if (action.close !== false) this.hide();
                });
            }
        });

        // Trap focus
        const focusable = this.overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length) focusable[0].focus();
    },

    hide() {
        if (!this.overlay) return;
        this.overlay.style.opacity = '0';
        setTimeout(() => {
            this.overlay.style.display = 'none';
            this.overlay.innerHTML = '';
        }, 200);
    }
};

/**
 * Toast Notification Component
 * Usage: Toast.show({ message, type, duration })
 */
const Toast = {
    container: null,

    init() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    },

    show({ message, type = 'info', duration = 3000, action = null }) {
        if (!this.container) this.init();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${this.getIcon(type)}</span>
            <span class="toast-message">${message}</span>
            ${action ? `<button class="toast-action">${action.label}</button>` : ''}
            <button class="toast-close">×</button>
        `;

        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => this.dismiss(toast));

        // Action button
        if (action) {
            toast.querySelector('.toast-action').addEventListener('click', () => {
                action.onClick();
                this.dismiss(toast);
            });
        }

        this.container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => this.dismiss(toast), duration);
        }

        return toast;
    },

    dismiss(toast) {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    },

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    },

    success(message, duration) { return this.show({ message, type: 'success', duration }); },
    error(message, duration) { return this.show({ message, type: 'error', duration }); },
    warning(message, duration) { return this.show({ message, type: 'warning', duration }); },
    info(message, duration) { return this.show({ message, type: 'info', duration }); }
};

/**
 * Date Range Picker Component
 * Usage: DateRangePicker.create({ onChange, presetRanges })
 */
const DateRangePicker = {
    create({ startDate, endDate, onChange, presetRanges = true } = {}) {
        const container = document.createElement('div');
        container.className = 'date-range-picker';

        const now = new Date();
        const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
        const end = endDate || now;

        container.innerHTML = `
            <div class="date-range-presets">
                <button class="preset-btn" data-range="today">Hôm nay</button>
                <button class="preset-btn" data-range="yesterday">Hôm qua</button>
                <button class="preset-btn active" data-range="7d">7 ngày</button>
                <button class="preset-btn" data-range="30d">30 ngày</button>
                <button class="preset-btn" data-range="month">Tháng này</button>
                <button class="preset-btn" data-range="custom">Tùy chọn</button>
            </div>
            <div class="date-range-inputs">
                <div class="date-input">
                    <label>Từ</label>
                    <input type="date" value="${this.formatDateInput(start)}">
                </div>
                <div class="date-input">
                    <label>Đến</label>
                    <input type="date" value="${this.formatDateInput(end)}">
                </div>
                <button class="btn btn-primary apply-btn">Áp dụng</button>
            </div>
        `;

        // Preset buttons
        const presetBtns = container.querySelectorAll('.preset-btn');
        const dateInputs = container.querySelectorAll('input[type="date"]');
        const applyBtn = container.querySelector('.apply-btn');

        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                presetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const range = btn.dataset.range;
                const dates = this.calculateRange(range);
                dateInputs[0].value = this.formatDateInput(dates.start);
                dateInputs[1].value = this.formatDateInput(dates.end);
            });
        });

        // Apply button
        applyBtn.addEventListener('click', () => {
            const start = new Date(dateInputs[0].value);
            const end = new Date(dateInputs[1].value);
            if (onChange) onChange({ start, end });
        });

        return container;
    },

    calculateRange(range) {
        const now = new Date();
        let start = new Date(now);
        let end = new Date(now);

        switch (range) {
            case 'today':
                break;
            case 'yesterday':
                start.setDate(now.getDate() - 1);
                end.setDate(now.getDate() - 1);
                break;
            case '7d':
                start.setDate(now.getDate() - 6);
                break;
            case '30d':
                start.setDate(now.getDate() - 29);
                break;
            case 'month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
        }

        return { start, end };
    },

    formatDateInput(date) {
        return date.toISOString().split('T')[0];
    }
};

/**
 * Pagination Component
 * Usage: Pagination.create({ currentPage, totalPages, onPageChange })
 */
const Pagination = {
    create({ currentPage, totalPages, onPageChange }) {
        const container = document.createElement('div');
        container.className = 'pagination';

        if (totalPages <= 1) {
            return container;
        }

        const pages = this.getVisiblePages(currentPage, totalPages);

        let html = `
            <button class="page-btn prev" ${currentPage === 1 ? 'disabled' : ''}>← Trước</button>
            ${pages.map(page =>
                page === '...'
                    ? `<span class="page-ellipsis">...</span>`
                    : `<button class="page-btn ${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`
            ).join('')}
            <button class="page-btn next" ${currentPage === totalPages ? 'disabled' : ''}>Sau →</button>
        `;

        container.innerHTML = html;

        // Page button clicks
        container.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;

                let page = currentPage;
                if (btn.classList.contains('prev')) page--;
                else if (btn.classList.contains('next')) page++;
                else page = parseInt(btn.dataset.page);

                if (onPageChange) onPageChange(page);
            });
        });

        return container;
    },

    getVisiblePages(current, total) {
        const delta = 2;
        const range = [];

        for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
            range.push(i);
        }

        if (current - delta > 2) range.unshift('...');
        if (current + delta < total - 1) range.push('...');

        range.unshift(1);
        if (total > 1) range.push(total);

        return [...new Set(range)];
    }
};

/**
 * Filter Dropdown Component
 * Usage: FilterDropdown.create({ options, value, onChange, placeholder })
 */
const FilterDropdown = {
    create({ options, value, onChange, placeholder = 'Chọn...' }) {
        const container = document.createElement('div');
        container.className = 'filter-dropdown';

        const selectedOption = options.find(opt => opt.value === value) || options[0];

        container.innerHTML = `
            <button class="dropdown-trigger">
                <span class="dropdown-value">${selectedOption?.label || placeholder}</span>
                <span class="dropdown-arrow">▼</span>
            </button>
            <div class="dropdown-menu">
                ${options.map(opt => `
                    <div class="dropdown-item" data-value="${opt.value}">${opt.label}</div>
                `).join('')}
            </div>
        `;

        const trigger = container.querySelector('.dropdown-trigger');
        const menu = container.querySelector('.dropdown-menu');
        const valueEl = container.querySelector('.dropdown-value');

        // Toggle dropdown
        trigger.addEventListener('click', () => {
            menu.classList.toggle('open');
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                menu.classList.remove('open');
            }
        });

        // Select option
        container.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const selectedValue = item.dataset.value;
                const selectedLabel = item.textContent;
                valueEl.textContent = selectedLabel;
                menu.classList.remove('open');
                if (onChange) onChange(selectedValue);
            });
        });

        return container;
    }
};

/**
 * Loading Skeleton Component
 * Usage: Skeleton.show(container, type)
 */
const Skeleton = {
    show(container, type = 'table', rows = 5) {
        const skeletons = {
            table: `
                <div class="skeleton-table">
                    ${Array(rows).fill(0).map((_, i) => `
                        <div class="skeleton-row">
                            <div class="skeleton-cell skeleton-text"></div>
                            <div class="skeleton-cell skeleton-text"></div>
                            <div class="skeleton-cell skeleton-text short"></div>
                            <div class="skeleton-cell skeleton-circle"></div>
                        </div>
                    `).join('')}
                </div>
            `,
            card: `
                <div class="skeleton-card">
                    <div class="skeleton-circle large"></div>
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                </div>
            `,
            chart: `
                <div class="skeleton-chart">
                    ${Array(7).fill(0).map(() => `
                        <div class="skeleton-bar"></div>
                    `).join('')}
                </div>
            `
        };

        container.innerHTML = skeletons[type] || skeletons.table;
        container.classList.add('skeleton-loading');
    },

    hide(container) {
        container.classList.remove('skeleton-loading');
    }
};

/**
 * Export Button Component
 * Usage: ExportButton.create({ formats, onExport })
 */
const ExportButton = {
    create({ formats = ['csv', 'pdf', 'xlsx'], onExport }) {
        const container = document.createElement('div');
        container.className = 'export-button';

        container.innerHTML = `
            <button class="export-trigger">
                <span>📥</span> Xuất dữ liệu
                <span class="export-arrow">▼</span>
            </button>
            <div class="export-menu">
                ${formats.map(format => `
                    <button class="export-item" data-format="${format}">
                        <span class="export-icon">${this.getFormatIcon(format)}</span>
                        ${this.getFormatLabel(format)}
                    </button>
                `).join('')}
            </div>
        `;

        const trigger = container.querySelector('.export-trigger');
        const menu = container.querySelector('.export-menu');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('open');
        });

        document.addEventListener('click', () => {
            menu.classList.remove('open');
        });

        container.querySelectorAll('.export-item').forEach(item => {
            item.addEventListener('click', () => {
                const format = item.dataset.format;
                if (onExport) onExport(format);
                menu.classList.remove('open');
            });
        });

        return container;
    },

    getFormatIcon(format) {
        const icons = { csv: '📊', pdf: '📄', xlsx: '📈' };
        return icons[format] || '📄';
    },

    getFormatLabel(format) {
        const labels = { csv: 'CSV', pdf: 'PDF', xlsx: 'Excel' };
        return labels[format] || format.toUpperCase();
    }
};

/**
 * Search Box with Debounce
 * Usage: SearchBox.create({ placeholder, onSearch })
 */
const SearchBox = {
    create({ placeholder = 'Tìm kiếm...', onSearch, debounceMs = 300 }) {
        const container = document.createElement('div');
        container.className = 'search-box-advanced';

        container.innerHTML = `
            <input type="text" placeholder="${placeholder}" class="search-input">
            <span class="search-icon">🔍</span>
            <button class="search-clear" style="display: none;">×</button>
        `;

        const input = container.querySelector('.search-input');
        const clearBtn = container.querySelector('.search-clear');
        let debounceTimer = null;

        input.addEventListener('input', (e) => {
            const value = e.target.value;
            clearBtn.style.display = value ? 'block' : 'none';

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (onSearch) onSearch(value);
            }, debounceMs);
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            if (onSearch) onSearch('');
            input.focus();
        });

        // Keyboard shortcut (Ctrl/Cmd + K)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                input.focus();
            }
        });

        return container;
    }
};

/**
 * Confirm Dialog
 * Usage: Confirm.show({ title, message, confirmLabel, cancelLabel })
 * Returns: Promise<boolean>
 */
const Confirm = {
    show({ title, message, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', type = 'warning' }) {
        return new Promise((resolve) => {
            const content = `
                <div class="confirm-message">
                    <span class="confirm-icon">${type === 'warning' ? '⚠️' : '❓'}</span>
                    <p>${message}</p>
                </div>
            `;

            Modal.show({
                title,
                content,
                actions: [
                    {
                        id: 'cancel',
                        label: cancelLabel,
                        variant: 'secondary',
                        onClick: () => resolve(false)
                    },
                    {
                        id: 'confirm',
                        label: confirmLabel,
                        variant: type === 'danger' ? 'danger' : 'primary',
                        onClick: () => resolve(true)
                    }
                ]
            });
        });
    }
};

// Export components
window.DashboardComponents = {
    Modal,
    Toast,
    DateRangePicker,
    Pagination,
    FilterDropdown,
    Skeleton,
    ExportButton,
    SearchBox,
    Confirm
};
