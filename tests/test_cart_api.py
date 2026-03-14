"""
Tests for Cart API - Kiểm tra giỏ hàng functionality
"""
import pytest
import os
import sys
import json
import tempfile
from datetime import datetime
from unittest.mock import patch, MagicMock

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from api.cart import CartItem, Cart, CartManager


class TestCartItem:
    """Tests for CartItem model"""

    def test_create_cart_item(self):
        """Test tạo cart item cơ bản"""
        item = CartItem(
            id="coffee-001",
            name="Cà Phê Sữa Đá",
            price=35000,
            quantity=2
        )
        assert item.id == "coffee-001"
        assert item.name == "Cà Phê Sữa Đá"
        assert item.price == 35000
        assert item.quantity == 2

    def test_cart_item_with_options(self):
        """Test cart item với options (size, sugar, ice)"""
        item = CartItem(
            id="latte-001",
            name="Latte",
            price=49000,
            quantity=1,
            options={"size": "L", "sugar": "50%", "ice": "less"}
        )
        assert item.options["size"] == "L"
        assert item.options["sugar"] == "50%"

    def test_cart_item_default_quantity(self):
        """Test quantity mặc định = 1"""
        item = CartItem(
            id="espresso-001",
            name="Espresso",
            price=29000
        )
        assert item.quantity == 1


class TestCart:
    """Tests for Cart model"""

    def test_create_empty_cart(self):
        """Test tạo giỏ hàng trống"""
        cart = Cart(session_id="test-session-123")
        assert cart.session_id == "test-session-123"
        assert len(cart.items) == 0
        assert cart.total() == 0

    def test_add_item_to_cart(self):
        """Test thêm item vào giỏ hàng"""
        cart = Cart(session_id="test-session-456")
        item = CartItem(id="coffee-001", name="Coffee", price=35000, quantity=1)

        cart.add_item(item)

        assert len(cart.items) == 1
        assert cart.items[0].id == "coffee-001"
        assert cart.total() == 35000

    def test_add_same_item_increases_quantity(self):
        """Test thêm cùng item tăng số lượng"""
        cart = Cart(session_id="test-session-789")
        item1 = CartItem(id="coffee-001", name="Coffee", price=35000, quantity=1)
        item2 = CartItem(id="coffee-001", name="Coffee", price=35000, quantity=2)

        cart.add_item(item1)
        cart.add_item(item2)

        assert len(cart.items) == 1
        assert cart.items[0].quantity == 3
        assert cart.total() == 105000

    def test_update_item_quantity(self):
        """Test cập nhật số lượng item"""
        cart = Cart(session_id="test-session-111")
        item = CartItem(id="coffee-001", name="Coffee", price=35000, quantity=2)
        cart.add_item(item)

        cart.update_item("coffee-001", 5)

        assert cart.items[0].quantity == 5
        assert cart.total() == 175000

    def test_update_item_quantity_zero_removes(self):
        """Test cập nhật số lượng = 0 xóa item"""
        cart = Cart(session_id="test-session-222")
        item = CartItem(id="coffee-001", name="Coffee", price=35000, quantity=2)
        cart.add_item(item)

        cart.update_item("coffee-001", 0)

        assert len(cart.items) == 0

    def test_remove_item(self):
        """Test xóa item khỏi giỏ"""
        cart = Cart(session_id="test-session-333")
        item1 = CartItem(id="coffee-001", name="Coffee", price=35000)
        item2 = CartItem(id="tea-001", name="Tea", price=25000)
        cart.add_item(item1)
        cart.add_item(item2)

        cart.remove_item("coffee-001")

        assert len(cart.items) == 1
        assert cart.items[0].id == "tea-001"

    def test_clear_cart(self):
        """Test xóa toàn bộ giỏ hàng"""
        cart = Cart(session_id="test-session-444")
        cart.add_item(CartItem(id="coffee-001", name="Coffee", price=35000))
        cart.add_item(CartItem(id="tea-001", name="Tea", price=25000))

        cart.clear()

        assert len(cart.items) == 0
        assert cart.total() == 0

    def test_cart_total_calculation(self):
        """Test tính tổng tiền chính xác"""
        cart = Cart(session_id="test-session-555")
        cart.add_item(CartItem(id="coffee-001", name="Coffee", price=35000, quantity=2))
        cart.add_item(CartItem(id="tea-001", name="Tea", price=25000, quantity=3))

        # 35000 * 2 + 25000 * 3 = 70000 + 75000 = 145000
        assert cart.total() == 145000

    def test_cart_updated_at_timestamp(self):
        """Test updated_at được cập nhật khi thay đổi"""
        cart = Cart(session_id="test-session-666")
        initial_updated = cart.updated_at

        cart.add_item(CartItem(id="coffee-001", name="Coffee", price=35000))

        assert cart.updated_at > initial_updated


class TestCartManager:
    """Tests for CartManager - persistent storage"""

    @pytest.fixture
    def temp_storage(self):
        """Fixture tạo temporary storage file"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({}, f)
            temp_path = f.name

        # Patch CART_STORAGE
        original_path = None
        import api.cart as cart_module
        original_path = cart_module.CART_STORAGE
        cart_module.CART_STORAGE = temp_path

        yield temp_path

        # Restore original path
        cart_module.CART_STORAGE = original_path
        os.unlink(temp_path)

    def test_get_empty_cart(self, temp_storage):
        """Test lấy giỏ hàng trống khi chưa có data"""
        manager = CartManager()
        cart = manager.get_cart("new-session-123")

        assert cart.session_id == "new-session-123"
        assert len(cart.items) == 0

    def test_save_and_load_cart(self, temp_storage):
        """Test lưu và tải giỏ hàng"""
        manager = CartManager()
        cart = Cart(session_id="save-test-123")
        cart.add_item(CartItem(id="coffee-001", name="Coffee", price=35000, quantity=2))

        manager.save_cart(cart)

        # Load lại từ storage
        loaded_cart = manager.get_cart("save-test-123")
        assert len(loaded_cart.items) == 1
        assert loaded_cart.items[0].quantity == 2

    def test_add_item_persistent(self, temp_storage):
        """Test thêm item lưu vào storage"""
        manager = CartManager()
        item = CartItem(id="coffee-001", name="Coffee", price=35000, quantity=1)

        cart = manager.add_item("session-add-test", item)

        assert len(cart.items) == 1

        # Verify persisted
        loaded_cart = manager.get_cart("session-add-test")
        assert len(loaded_cart.items) == 1

    def test_update_item_persistent(self, temp_storage):
        """Test cập nhật item lưu vào storage"""
        manager = CartManager()
        # Add item first
        manager.add_item("session-update", CartItem(id="coffee-001", name="Coffee", price=35000, quantity=1))

        # Update quantity
        cart = manager.update_item("session-update", "coffee-001", 5)

        assert cart.items[0].quantity == 5

        # Verify persisted
        loaded_cart = manager.get_cart("session-update")
        assert loaded_cart.items[0].quantity == 5

    def test_remove_item_persistent(self, temp_storage):
        """Test xóa item lưu vào storage"""
        manager = CartManager()
        # Add items
        manager.add_item("session-remove", CartItem(id="coffee-001", name="Coffee", price=35000))
        manager.add_item("session-remove", CartItem(id="tea-001", name="Tea", price=25000))

        # Remove one
        cart = manager.remove_item("session-remove", "coffee-001")

        assert len(cart.items) == 1
        assert cart.items[0].id == "tea-001"

    def test_clear_cart_persistent(self, temp_storage):
        """Test xóa giỏ hàng lưu vào storage"""
        manager = CartManager()
        # Add items
        manager.add_item("session-clear", CartItem(id="coffee-001", name="Coffee", price=35000))
        manager.add_item("session-clear", CartItem(id="tea-001", name="Tea", price=25000))

        # Clear
        cart = manager.clear_cart("session-clear")

        assert len(cart.items) == 0

        # Verify persisted
        loaded_cart = manager.get_cart("session-clear")
        assert len(loaded_cart.items) == 0


class TestCartEdgeCases:
    """Tests for edge cases và error handling"""

    def test_update_nonexistent_item(self):
        """Test cập nhật item không tồn tại"""
        cart = Cart(session_id="test-session-edge-1")

        # Should not raise error
        cart.update_item("nonexistent-id", 5)

        # Cart should remain empty
        assert len(cart.items) == 0

    def test_remove_nonexistent_item(self):
        """Test xóa item không tồn tại"""
        cart = Cart(session_id="test-session-edge-2")
        cart.add_item(CartItem(id="coffee-001", name="Coffee", price=35000))

        # Remove nonexistent
        cart.remove_item("nonexistent-id")

        # Original item should remain
        assert len(cart.items) == 1

    def test_cart_with_special_characters_in_name(self):
        """Test cart item với ký tự đặc biệt"""
        item = CartItem(
            id="coffee-001",
            name="Cà Phê Sữa Đá ☕",
            price=35000
        )
        assert item.name == "Cà Phê Sữa Đá ☕"

    def test_cart_with_large_quantity(self):
        """Test cart với số lượng lớn"""
        cart = Cart(session_id="test-session-edge-3")
        item = CartItem(id="coffee-001", name="Coffee", price=35000, quantity=999999)
        cart.add_item(item)

        assert cart.items[0].quantity == 999999
        assert cart.total() == 35000 * 999999

    def test_cart_with_decimal_price(self):
        """Test cart với giá lẻ"""
        item = CartItem(id="coffee-001", name="Coffee", price=35000.50, quantity=2)
        cart = Cart(session_id="test-session-edge-4")
        cart.add_item(item)

        assert cart.total() == 70001.00
