/**
 * AURA SPACE — Dashboard API Module
 * All fetch and mock data methods
 */

import { API_CONFIG } from '../js/config.js';

const DashboardAPI = {
    async fetchStats(days = 7) {
        try {
            const response = await fetch(`${API_CONFIG.BASE}/dashboard/stats?days=${days}`);
            const data = await response.json();
            return data.success ? data.stats : null;
        } catch (error) {
            return this.getMockStats();
        }
    },

    async fetchRevenue(days = 7) {
        try {
            const response = await fetch(`${API_CONFIG.BASE}/dashboard/revenue?days=${days}`);
            const data = await response.json();
            return data.success ? data.data : [];
        } catch (error) {
            return this.getMockRevenue(days);
        }
    },

    async fetchOrders(status = null, limit = 20, page = 1, stateRef = null) {
        try {
            const params = new URLSearchParams({
                status: status || 'all',
                limit: limit.toString(),
                page: page.toString()
            });
            const response = await fetch(`${API_CONFIG.BASE}/dashboard/orders?${params}`);
            const data = await response.json();
            if (data.success) {
                if (stateRef) {
                    stateRef.totalPages = data.total_pages || 1;
                }
                return data.orders || [];
            }
            return [];
        } catch (error) {
            return this.getMockOrders(limit);
        }
    },

    async fetchOrderDetail(orderId) {
        try {
            const response = await fetch(`${API_CONFIG.BASE}/dashboard/orders/${orderId}`);
            const data = await response.json();
            return data.success ? data.order : null;
        } catch (error) {
            return this.getMockOrderDetail(orderId);
        }
    },

    async fetchTopProducts(limit = 10) {
        try {
            const response = await fetch(`${API_CONFIG.BASE}/dashboard/products/top?limit=${limit}`);
            const data = await response.json();
            return data.success ? data.products : [];
        } catch (error) {
            return this.getMockTopProducts(limit);
        }
    },

    async updateOrderStatus(orderId, action) {
        try {
            const response = await fetch(`${API_CONFIG.BASE}/dashboard/orders/${orderId}/status?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            return data.success ? data.order : null;
        } catch (error) {
            Toast.error('Không thể cập nhật trạng thái đơn hàng');
            return null;
        }
    },

    // Mock Data for Demo (remove when backend is ready)
    getMockStats() {
        return {
            revenue: { total: 24580000, growth: 12.5 },
            total_orders: 156,
            total_customers: 89,
            average_order_value: 157000
        };
    },

    getMockRevenue(days = 7) {
        const data = [];
        const now = new Date();
        const baseRevenue = 15000000;

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);

            const variance = Math.random() * 10000000;
            const weekendBoost = (date.getDay() === 6 || date.getDay() === 0) ? 5000000 : 0;

            data.push({
                date: date.toISOString().split('T')[0],
                revenue: baseRevenue + variance + weekendBoost
            });
        }

        return data;
    },

    getMockOrders(limit = 20) {
        const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
        const paymentStatuses = ['pending', 'paid'];
        const names = ['Nguyễn Thành', 'Trần Phương', 'Lê Văn', 'Phạm Huyền', 'Đặng Minh', 'Hoàng Anh', 'Phan Cường', 'Vũ Hạnh'];
        const items = ['Cà phê sữa đá', 'Trà sữa trân châu', 'Bánh mì ốp la', 'Cà phê đen', 'Nước ép cam', 'Latte', 'Americano', 'Sandwich'];

        return Array.from({ length: limit }, (_, i) => ({
            id: 1000 + i + 1,
            customer: {
                full_name: names[i % names.length],
                phone: '090' + Math.floor(Math.random() * 1000000),
                email: `customer${i}@example.com`
            },
            items: [
                { name: items[i % items.length], quantity: 1 + Math.floor(Math.random() * 3), price: 45000 + Math.floor(Math.random() * 30000) }
            ],
            total: 85000 + Math.floor(Math.random() * 200000),
            payment_status: paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)],
            order_status: statuses[Math.floor(Math.random() * statuses.length)],
            created_at: new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString()
        }));
    },

    getMockOrderDetail(orderId) {
        const names = ['Nguyễn Thành', 'Trần Phương', 'Lê Văn', 'Phạm Huyền'];
        return Promise.resolve({
            id: orderId,
            customer: {
                full_name: names[orderId % names.length],
                phone: '090' + Math.floor(Math.random() * 1000000),
                email: `customer${orderId}@example.com`
            },
            items: [
                { name: 'Cà phê sữa đá', quantity: 2, price: 45000 },
                { name: 'Bánh mì ốp la', quantity: 1, price: 55000 }
            ],
            total: 145000,
            payment_status: 'paid',
            payment_method: 'Tiền mặt',
            order_status: 'pending',
            created_at: new Date().toISOString()
        });
    },

    getMockTopProducts(limit = 10) {
        const products = [
            { name: 'Cà phê sữa đá', quantity: 245 },
            { name: 'Trà sữa trân châu', quantity: 198 },
            { name: 'Bánh mì ốp la', quantity: 167 },
            { name: 'Cà phê đen', quantity: 142 },
            { name: 'Nước ép cam', quantity: 128 },
            { name: 'Latte', quantity: 95 },
            { name: 'Americano', quantity: 87 },
            { name: 'Sandwich', quantity: 76 }
        ];
        return products.slice(0, limit);
    }
};

export default DashboardAPI;
