"""
Tests for Dashboard API - Kiểm tra thống kê, doanh thu, analytics
"""
import pytest
import os
import sys
import json
import tempfile
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from api.dashboard import (
    _load_orders,
    _calculate_revenue,
    _get_orders_by_status,
    _get_revenue_by_period,
    _get_top_products
)


class TestCalculateRevenue:
    """Tests for _calculate_revenue function"""

    def test_calculate_revenue_empty_orders(self):
        """Test tính doanh thu với danh sách rỗng"""
        result = _calculate_revenue([])

        assert result["total"] == 0
        assert result["paid"] == 0
        assert result["pending"] == 0

    def test_calculate_revenue_single_order(self):
        """Test tính doanh thu với 1 đơn hàng"""
        orders = [
            {"total": 100000, "payment_status": "pending"}
        ]

        result = _calculate_revenue(orders)

        assert result["total"] == 100000
        assert result["paid"] == 0
        assert result["pending"] == 100000

    def test_calculate_revenue_mixed_statuses(self):
        """Test tính doanh thu với nhiều trạng thái thanh toán"""
        orders = [
            {"total": 100000, "payment_status": "paid"},
            {"total": 50000, "payment_status": "pending"},
            {"total": 75000, "payment_status": "paid"}
        ]

        result = _calculate_revenue(orders)

        assert result["total"] == 225000
        assert result["paid"] == 175000
        assert result["pending"] == 50000

    def test_calculate_revenue_failed_payments(self):
        """Test tính doanh thu với payment failed"""
        orders = [
            {"total": 100000, "payment_status": "paid"},
            {"total": 50000, "payment_status": "failed"},
            {"total": 75000, "payment_status": "pending"}
        ]

        result = _calculate_revenue(orders)

        # Failed payments are not counted in paid or pending
        assert result["total"] == 225000
        assert result["paid"] == 100000

    def test_calculate_revenue_missing_payment_status(self):
        """Test tính doanh thu với order thiếu payment_status"""
        orders = [
            {"total": 100000},  # No payment_status
            {"total": 50000, "payment_status": "paid"}
        ]

        result = _calculate_revenue(orders)

        assert result["total"] == 150000
        assert result["paid"] == 50000


class TestGetOrdersByStatus:
    """Tests for _get_orders_by_status function"""

    def test_orders_by_status_empty(self):
        """Test đếm status với danh sách rỗng"""
        result = _get_orders_by_status([])
        assert result == {}

    def test_orders_by_status_single(self):
        """Test đếm status với 1 đơn hàng"""
        orders = [{"order_status": "pending"}]

        result = _get_orders_by_status(orders)

        assert result["pending"] == 1

    def test_orders_by_status_multiple(self):
        """Test đếm status với nhiều đơn hàng"""
        orders = [
            {"order_status": "pending"},
            {"order_status": "confirmed"},
            {"order_status": "pending"},
            {"order_status": "delivered"},
            {"order_status": "confirmed"}
        ]

        result = _get_orders_by_status(orders)

        assert result["pending"] == 2
        assert result["confirmed"] == 2
        assert result["delivered"] == 1

    def test_orders_by_status_unknown_status(self):
        """Test đếm status với status lạ"""
        orders = [
            {"order_status": "unknown_status"},
            {"order_status": "pending"}
        ]

        result = _get_orders_by_status(orders)

        assert result["unknown_status"] == 1
        assert result["pending"] == 1

    def test_orders_by_status_missing_status(self):
        """Test đếm status với order thiếu status"""
        orders = [
            {"order_status": "pending"},
            {}  # No order_status
        ]

        result = _get_orders_by_status(orders)

        assert result["pending"] == 1
        assert result.get("unknown", 0) == 1 or result.get("") == 1


class TestGetRevenueByPeriod:
    """Tests for _get_revenue_by_period function"""

    def test_revenue_by_period_empty_orders(self):
        """Test doanh theo ngày với danh sách rỗng"""
        result = _get_revenue_by_period([], days=7)

        assert len(result) == 7
        for day in result:
            assert day["revenue"] == 0
            assert day["orders"] == 0

    def test_revenue_by_period_single_day(self):
        """Test doanh thu theo 1 ngày"""
        today = datetime.now().date().isoformat()
        orders = [
            {"total": 100000, "created_at": f"{today}T10:00:00"}
        ]

        result = _get_revenue_by_period(orders, days=1)

        assert len(result) == 1
        assert result[0]["date"] == today
        assert result[0]["revenue"] == 100000
        assert result[0]["orders"] == 1

    def test_revenue_by_period_multiple_days(self):
        """Test doanh thu theo nhiều ngày"""
        today = datetime.now().date()
        yesterday = (today - timedelta(days=1)).isoformat()
        today_str = today.isoformat()

        orders = [
            {"total": 100000, "created_at": f"{today_str}T10:00:00"},
            {"total": 50000, "created_at": f"{yesterday}T10:00:00"},
            {"total": 75000, "created_at": f"{yesterday}T14:00:00"}
        ]

        result = _get_revenue_by_period(orders, days=2)

        assert len(result) == 2
        # Yesterday
        assert result[0]["date"] == yesterday
        assert result[0]["revenue"] == 125000
        assert result[0]["orders"] == 2
        # Today
        assert result[1]["date"] == today_str
        assert result[1]["revenue"] == 100000
        assert result[1]["orders"] == 1

    def test_revenue_by_period_days_with_no_orders(self):
        """Test doanh thu theo ngày không có đơn hàng"""
        today = datetime.now().date().isoformat()

        orders = [
            {"total": 100000, "created_at": f"{today}T10:00:00"}
        ]

        result = _get_revenue_by_period(orders, days=5)

        assert len(result) == 5
        # Today should have revenue
        today_data = next(d for d in result if d["date"] == today)
        assert today_data["revenue"] == 100000
        # Other days should have 0 revenue
        for day in result:
            if day["date"] != today:
                assert day["revenue"] == 0


class TestGetTopProducts:
    """Tests for _get_top_products function"""

    def test_top_products_empty_orders(self):
        """Test top products với danh sách rỗng"""
        result = _get_top_products([], limit=10)
        assert result == []

    def test_top_products_single_product(self):
        """Test top products với 1 sản phẩm"""
        orders = [
            {
                "items": [
                    {"id": "coffee-001", "name": "Cà Phê Sữa Đá", "price": 35000, "quantity": 2}
                ]
            }
        ]

        result = _get_top_products(orders, limit=10)

        assert len(result) == 1
        assert result[0]["id"] == "coffee-001"
        assert result[0]["name"] == "Cà Phê Sữa Đá"
        assert result[0]["quantity"] == 2
        assert result[0]["revenue"] == 70000

    def test_top_products_multiple_products(self):
        """Test top products với nhiều sản phẩm"""
        orders = [
            {
                "items": [
                    {"id": "coffee-001", "name": "Coffee", "price": 35000, "quantity": 5},
                    {"id": "tea-001", "name": "Tea", "price": 25000, "quantity": 3}
                ]
            },
            {
                "items": [
                    {"id": "coffee-001", "name": "Coffee", "price": 35000, "quantity": 2},
                    {"id": "cake-001", "name": "Cake", "price": 45000, "quantity": 1}
                ]
            }
        ]

        result = _get_top_products(orders, limit=10)

        # Should be sorted by quantity
        assert len(result) == 3
        assert result[0]["id"] == "coffee-001"
        assert result[0]["quantity"] == 7  # 5 + 2
        assert result[0]["revenue"] == 245000  # 35000 * 7
        assert result[1]["id"] == "tea-001"
        assert result[1]["quantity"] == 3
        assert result[2]["id"] == "cake-001"
        assert result[2]["quantity"] == 1

    def test_top_products_limit(self):
        """Test giới hạn số lượng top products"""
        orders = [
            {
                "items": [
                    {"id": f"product-{i}", "name": f"Product {i}", "price": 10000, "quantity": 10 - i}
                    for i in range(10)
                ]
            }
        ]

        result = _get_top_products(orders, limit=5)

        assert len(result) == 5
        # Should return top 5 by quantity
        assert result[0]["quantity"] == 10
        assert result[4]["quantity"] == 6

    def test_top_products_same_quantity(self):
        """Test top products với cùng số lượng"""
        orders = [
            {
                "items": [
                    {"id": "coffee-001", "name": "Coffee", "price": 35000, "quantity": 5},
                    {"id": "tea-001", "name": "Tea", "price": 25000, "quantity": 5}
                ]
            }
        ]

        result = _get_top_products(orders, limit=10)

        assert len(result) == 2
        assert result[0]["quantity"] == 5
        assert result[1]["quantity"] == 5

    def test_top_products_aggregation(self):
        """Test tổng hợp sản phẩm từ nhiều đơn hàng"""
        orders = [
            {"items": [{"id": "coffee-001", "name": "Coffee", "price": 35000, "quantity": 1}]},
            {"items": [{"id": "coffee-001", "name": "Coffee", "price": 35000, "quantity": 2}]},
            {"items": [{"id": "coffee-001", "name": "Coffee", "price": 35000, "quantity": 3}]}
        ]

        result = _get_top_products(orders, limit=10)

        assert len(result) == 1
        assert result[0]["quantity"] == 6  # 1 + 2 + 3
        assert result[0]["revenue"] == 210000  # 35000 * 6


class TestDashboardIntegration:
    """Integration tests for dashboard functions"""

    @pytest.fixture
    def sample_orders(self):
        """Fixture cung cấp sample orders"""
        today = datetime.now().date().isoformat()
        yesterday = (datetime.now().date() - timedelta(days=1)).isoformat()

        return [
            {
                "id": "order-001",
                "total": 100000,
                "payment_status": "paid",
                "order_status": "delivered",
                "created_at": f"{today}T10:00:00",
                "session_id": "customer-001",
                "items": [
                    {"id": "coffee-001", "name": "Coffee", "price": 35000, "quantity": 2},
                    {"id": "tea-001", "name": "Tea", "price": 25000, "quantity": 1}
                ]
            },
            {
                "id": "order-002",
                "total": 150000,
                "payment_status": "pending",
                "order_status": "pending",
                "created_at": f"{today}T14:00:00",
                "session_id": "customer-002",
                "items": [
                    {"id": "coffee-001", "name": "Coffee", "price": 35000, "quantity": 3},
                    {"id": "cake-001", "name": "Cake", "price": 45000, "quantity": 1}
                ]
            },
            {
                "id": "order-003",
                "total": 75000,
                "payment_status": "paid",
                "order_status": "confirmed",
                "created_at": f"{yesterday}T12:00:00",
                "session_id": "customer-001",
                "items": [
                    {"id": "tea-001", "name": "Tea", "price": 25000, "quantity": 3}
                ]
            }
        ]

    def test_full_revenue_calculation(self, sample_orders):
        """Test tính toán doanh thu đầy đủ"""
        revenue = _calculate_revenue(sample_orders)

        assert revenue["total"] == 325000
        assert revenue["paid"] == 175000
        assert revenue["pending"] == 150000

    def test_full_status_count(self, sample_orders):
        """Test đếm status đầy đủ"""
        status_count = _get_orders_by_status(sample_orders)

        assert status_count["delivered"] == 1
        assert status_count["pending"] == 1
        assert status_count["confirmed"] == 1

    def test_full_revenue_by_period(self, sample_orders):
        """Test doanh thu theo период"""
        revenue_by_day = _get_revenue_by_period(sample_orders, days=2)

        assert len(revenue_by_day) == 2

    def test_full_top_products(self, sample_orders):
        """Test top products đầy đủ"""
        top_products = _get_top_products(sample_orders, limit=5)

        assert len(top_products) == 3
        # Coffee should be top (2 + 3 = 5 quantity)
        coffee = next(p for p in top_products if p["id"] == "coffee-001")
        assert coffee["quantity"] == 5
        # Tea should be second (1 + 3 = 4 quantity)
        tea = next(p for p in top_products if p["id"] == "tea-001")
        assert tea["quantity"] == 4


class TestDashboardEdgeCases:
    """Tests for edge cases và error handling"""

    def test_revenue_with_missing_total(self):
        """Test doanh thu với order thiếu total"""
        orders = [
            {"total": 100000, "payment_status": "paid"},
            {"payment_status": "paid"},  # Missing total
        ]

        result = _calculate_revenue(orders)

        # Should handle missing total gracefully
        assert result["total"] >= 100000

    def test_revenue_with_zero_total(self):
        """Test doanh thu với total = 0"""
        orders = [
            {"total": 0, "payment_status": "paid"},
            {"total": 100000, "payment_status": "paid"}
        ]

        result = _calculate_revenue(orders)

        assert result["total"] == 100000
        assert result["paid"] == 100000

    def test_top_products_with_missing_item_fields(self):
        """Test top products với item thiếu fields"""
        orders = [
            {
                "items": [
                    {"id": "coffee-001", "name": "Coffee", "price": 35000, "quantity": 2},
                    {"id": "tea-001", "price": 25000},  # Missing name and quantity
                ]
            }
        ]

        result = _get_top_products(orders, limit=10)

        # Should handle missing fields gracefully
        assert len(result) >= 1

    def test_revenue_by_period_with_invalid_date(self):
        """Test doanh thu theo ngày với created_at không hợp lệ"""
        orders = [
            {"total": 100000, "created_at": "invalid-date"},
            {"total": 50000, "created_at": "2024-01-01T10:00:00"}
        ]

        result = _get_revenue_by_period(orders, days=7)

        # Should handle invalid dates gracefully
        assert len(result) == 7
