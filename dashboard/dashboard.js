/**
 * F&B Caffe Container — Admin Dashboard
 * Interactive Dashboard JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized');

    // Sidebar Toggle (Mobile)
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Close sidebar when clicking outside (mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Navigation Active State
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Allow navigation
            if (this.getAttribute('href') === '#') {
                e.preventDefault();
            }

            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            // Update page title based on navigation
            const pageLabel = this.querySelector('.nav-label');
            if (pageLabel) {
                const pageTitle = document.querySelector('.page-title');
                if (pageTitle) {
                    pageTitle.textContent = pageLabel.textContent;
                }
            }
        });
    });

    // Search Functionality
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase();
            // Add search logic here
            console.log('Searching for:', query);
        });

        // Keyboard shortcut for search (Cmd/Ctrl + K)
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }
        });
    }

    // Notification Button
    const notificationBtn = document.querySelector('.notification-btn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', () => {
            const dot = notificationBtn.querySelector('.notification-dot');
            if (dot) {
                dot.style.display = 'none';
            }
            console.log('Notifications opened');
            // Add notification panel logic here
        });
    }

    // Stats Card Hover Animation Enhancement
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            statCards.forEach(c => {
                if (c !== card) {
                    c.style.opacity = '0.7';
                }
            });
        });

        card.addEventListener('mouseleave', function() {
            statCards.forEach(c => {
                c.style.opacity = '1';
            });
        });
    });

    // Bar Chart Animation on Scroll
    const barChart = document.querySelector('.bar-chart');
    if (barChart) {
        const bars = barChart.querySelectorAll('.bar');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    bars.forEach((bar, index) => {
                        setTimeout(() => {
                            bar.style.transform = 'scaleY(1)';
                        }, index * 100);
                    });
                }
            });
        }, { threshold: 0.5 });

        observer.observe(barChart);
    }

    // Status Badge Pulse Animation for Pending Orders
    const pendingBadges = document.querySelectorAll('.status-badge.pending');
    pendingBadges.forEach(badge => {
        badge.style.animation = 'pulse 2s infinite';

        // Add pulse keyframes dynamically
        if (!document.getElementById('pulse-keyframes')) {
            const style = document.createElement('style');
            style.id = 'pulse-keyframes';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                        box-shadow: 0 0 0 0 rgba(232, 159, 113, 0.4);
                    }
                    50% {
                        opacity: 0.8;
                        box-shadow: 0 0 0 8px rgba(232, 159, 113, 0);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    });

    // Product List Stagger Animation
    const productItems = document.querySelectorAll('.product-item');
    productItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';

        setTimeout(() => {
            item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        }, index * 100);
    });

    // Quick Actions Button Click Effects
    const actionBtns = document.querySelectorAll('.action-btn');
    actionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Add ripple effect
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute;
                background: rgba(212, 165, 116, 0.3);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;

            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';

            btn.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);

            // Log action
            const actionName = btn.querySelector('span:last-child')?.textContent;
            console.log('Action triggered:', actionName);
        });
    });

    // Add ripple keyframes
    if (!document.getElementById('ripple-keyframes')) {
        const style = document.createElement('style');
        style.id = 'ripple-keyframes';
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Table Row Hover Effect Enhancement
    const tableRows = document.querySelectorAll('.orders-table tbody tr');
    tableRows.forEach(row => {
        row.addEventListener('mouseenter', function() {
            tableRows.forEach(r => {
                if (r !== row) {
                    r.style.background = 'transparent';
                }
            });
        });
    });

    // Real-time Clock Update (Optional feature)
    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
        // Could display clock in header if needed
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Mock Data Refresh (Simulating real-time updates)
    function refreshData() {
        // This would connect to a real backend in production
        console.log('Data refreshed at', new Date().toLocaleTimeString());

        // Animate stat values
        const statValues = document.querySelectorAll('.stat-value');
        statValues.forEach(stat => {
            stat.style.transition = 'opacity 0.3s';
            stat.style.opacity = '0.5';
            setTimeout(() => {
                stat.style.opacity = '1';
            }, 300);
        });
    }

    // Auto-refresh every 30 seconds (for demo purposes)
    // setInterval(refreshData, 30000);

    // Keyboard Navigation (Accessibility)
    document.addEventListener('keydown', (e) => {
        // Escape to close mobile sidebar
        if (e.key === 'Escape') {
            sidebar.classList.remove('open');
        }

        // Alt + Number for quick navigation
        if (e.altKey && e.key >= '1' && e.key <= '9') {
            const index = parseInt(e.key) - 1;
            if (navItems[index]) {
                navItems[index].click();
            }
        }
    });

    // Tooltip Initialization (for icons without labels)
    const iconBtns = document.querySelectorAll('.icon-btn');
    iconBtns.forEach(btn => {
        const tooltipText = btn.getAttribute('title') || 'Click để xem';
        btn.setAttribute('data-tooltip', tooltipText);
    });

    console.log('Dashboard fully loaded with all interactions');
});

/**
 * Utility Functions
 */

// Format currency in Vietnamese Dong
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

// Format date in Vietnamese
function formatDate(date) {
    return new Intl.DateTimeFormat('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Debounce function for search inputs
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export for use in other modules
window.DashboardUtils = {
    formatCurrency,
    formatDate,
    debounce
};
