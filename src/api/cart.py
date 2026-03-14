"""
Cart API - Quản lý giỏ hàng
"""
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import json
import os

CART_STORAGE = os.path.join(os.path.dirname(__file__), '../../data/carts.json')


class CartItem(BaseModel):
    """Sản phẩm trong giỏ hàng"""
    id: str
    name: str
    price: float
    quantity: int = 1
    image: Optional[str] = None
    options: Optional[Dict] = None  # size, sugar, ice, etc.


class Cart(BaseModel):
    """Giỏ hàng"""
    session_id: str
    items: List[CartItem] = []
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    def total(self) -> float:
        """Tính tổng tiền"""
        return sum(item.price * item.quantity for item in self.items)

    def add_item(self, item: CartItem):
        """Thêm sản phẩm vào giỏ"""
        existing = next((i for i in self.items if i.id == item.id), None)
        if existing:
            existing.quantity += item.quantity
        else:
            self.items.append(item)
        self.updated_at = datetime.now()

    def update_item(self, item_id: str, quantity: int):
        """Cập nhật số lượng"""
        item = next((i for i in self.items if i.id == item_id), None)
        if item:
            if quantity <= 0:
                self.items.remove(item)
            else:
                item.quantity = quantity
        self.updated_at = datetime.now()

    def remove_item(self, item_id: str):
        """Xóa sản phẩm khỏi giỏ"""
        self.items = [i for i in self.items if i.id != item_id]
        self.updated_at = datetime.now()

    def clear(self):
        """Xóa toàn bộ giỏ hàng"""
        self.items = []
        self.updated_at = datetime.now()


class CartManager:
    """Quản lý giỏ hàng"""

    def __init__(self):
        self._ensure_storage()

    def _ensure_storage(self):
        """Đảm bảo file storage tồn tại"""
        os.makedirs(os.path.dirname(CART_STORAGE), exist_ok=True)
        if not os.path.exists(CART_STORAGE):
            with open(CART_STORAGE, 'w') as f:
                json.dump({}, f)

    def _load_carts(self) -> Dict:
        """Đổi dữ liệu từ file"""
        with open(CART_STORAGE, 'r') as f:
            return json.load(f)

    def _save_carts(self, carts: Dict):
        """Lưu dữ liệu vào file"""
        with open(CART_STORAGE, 'w') as f:
            json.dump(carts, f, indent=2, default=str)

    def get_cart(self, session_id: str) -> Cart:
        """Lấy giỏ hàng theo session_id"""
        carts = self._load_carts()
        if session_id not in carts:
            return Cart(session_id=session_id)
        return Cart(**carts[session_id])

    def save_cart(self, cart: Cart):
        """Lưu giỏ hàng"""
        carts = self._load_carts()
        carts[cart.session_id] = cart.model_dump()
        self._save_carts(carts)

    def add_item(self, session_id: str, item: CartItem) -> Cart:
        """Thêm sản phẩm vào giỏ"""
        cart = self.get_cart(session_id)
        cart.add_item(item)
        self.save_cart(cart)
        return cart

    def update_item(self, session_id: str, item_id: str, quantity: int) -> Cart:
        """Cập nhật số lượng sản phẩm"""
        cart = self.get_cart(session_id)
        cart.update_item(item_id, quantity)
        self.save_cart(cart)
        return cart

    def remove_item(self, session_id: str, item_id: str) -> Cart:
        """Xóa sản phẩm khỏi giỏ"""
        cart = self.get_cart(session_id)
        cart.remove_item(item_id)
        self.save_cart(cart)
        return cart

    def clear_cart(self, session_id: str) -> Cart:
        """Xóa toàn bộ giỏ hàng"""
        cart = self.get_cart(session_id)
        cart.clear()
        self.save_cart(cart)
        return cart


# Singleton instance
cart_manager = CartManager()
