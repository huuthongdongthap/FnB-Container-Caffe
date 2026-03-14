"""
Checkout API - Xử lý đặt hàng
"""
from typing import Optional, Dict, List
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
import json
import os
import uuid

from .cart import cart_manager, Cart

ORDER_STORAGE = os.path.join(os.path.dirname(__file__), '../../data/orders.json')


class ShippingAddress(BaseModel):
    """Địa chỉ giao hàng"""
    full_name: str
    phone: str
    email: Optional[str] = None
    address: str
    ward: Optional[str] = None
    city: str = "Đồng Tháp"
    district: str = "Sa Đéc"
    notes: Optional[str] = None


class OrderItem(BaseModel):
    """Sản phẩm trong đơn hàng"""
    id: str
    name: str
    price: float
    quantity: int
    image: Optional[str] = None
    options: Optional[Dict] = None


class Order(BaseModel):
    """Đơn hàng"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    session_id: str
    items: List[OrderItem]
    subtotal: float
    shipping_fee: float = 0
    discount: float = 0
    total: float
    customer: ShippingAddress
    payment_method: str = "cod"  # cod, momo, vnpay
    payment_status: str = "pending"  # pending, paid, failed
    order_status: str = "pending"  # pending, confirmed, preparing, ready, delivered, cancelled
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    def confirm(self):
        """Xác nhận đơn hàng"""
        self.order_status = "confirmed"
        self.updated_at = datetime.now()

    def cancel(self):
        """Hủy đơn hàng"""
        self.order_status = "cancelled"
        self.updated_at = datetime.now()

    def mark_paid(self):
        """Đánh dấu đã thanh toán"""
        self.payment_status = "paid"
        self.updated_at = datetime.now()


class CheckoutRequest(BaseModel):
    """Yêu cầu thanh toán"""
    session_id: str
    customer: ShippingAddress
    payment_method: str = "cod"


class OrderManager:
    """Quản lý đơn hàng"""

    def __init__(self):
        self._ensure_storage()

    def _ensure_storage(self):
        """Đảm bảo file storage tồn tại"""
        os.makedirs(os.path.dirname(ORDER_STORAGE), exist_ok=True)
        if not os.path.exists(ORDER_STORAGE):
            with open(ORDER_STORAGE, 'w') as f:
                json.dump([], f)

    def _load_orders(self) -> List:
        """Đổi dữ liệu từ file"""
        with open(ORDER_STORAGE, 'r') as f:
            return json.load(f)

    def _save_orders(self, orders: List):
        """Lưu dữ liệu vào file"""
        with open(ORDER_STORAGE, 'w') as f:
            json.dump(orders, f, indent=2, default=str)

    def create_order(self, request: CheckoutRequest) -> Order:
        """Tạo đơn hàng từ giỏ hàng"""
        # Lấy giỏ hàng
        cart = cart_manager.get_cart(request.session_id)

        if not cart.items:
            raise ValueError("Giỏ hàng trống")

        # Chuyển cart items sang order items
        order_items = [
            OrderItem(
                id=item.id,
                name=item.name,
                price=item.price,
                quantity=item.quantity,
                image=item.image,
                options=item.options
            )
            for item in cart.items
        ]

        # Tính tổng tiền
        subtotal = cart.total()
        shipping_fee = 15000 if subtotal < 100000 else 0  # Free ship > 100k
        total = subtotal + shipping_fee

        # Tạo đơn hàng
        order = Order(
            session_id=request.session_id,
            items=order_items,
            subtotal=subtotal,
            shipping_fee=shipping_fee,
            discount=0,
            total=total,
            customer=request.customer,
            payment_method=request.payment_method
        )

        # Lưu đơn hàng
        orders = self._load_orders()
        orders.append(order.model_dump())
        self._save_orders(orders)

        # Xóa giỏ hàng sau khi đặt
        cart_manager.clear_cart(request.session_id)

        return order

    def get_order(self, order_id: str) -> Optional[Order]:
        """Lấy thông tin đơn hàng"""
        orders = self._load_orders()
        for order_data in orders:
            if order_data['id'] == order_id:
                return Order(**order_data)
        return None

    def get_orders_by_session(self, session_id: str) -> List[Order]:
        """Lấy tất cả đơn hàng của session"""
        orders = self._load_orders()
        return [Order(**o) for o in orders if o['session_id'] == session_id]

    def update_order_status(self, order_id: str, status: str) -> Optional[Order]:
        """Cập nhật trạng thái đơn hàng"""
        orders = self._load_orders()
        for i, order_data in enumerate(orders):
            if order_data['id'] == order_id:
                orders[i]['order_status'] = status
                orders[i]['updated_at'] = datetime.now().isoformat()
                self._save_orders(orders)
                return Order(**orders[i])
        return None

    def update_payment_status(self, order_id: str, status: str) -> Optional[Order]:
        """Cập nhật trạng thái thanh toán"""
        orders = self._load_orders()
        for i, order_data in enumerate(orders):
            if order_data['id'] == order_id:
                orders[i]['payment_status'] = status
                orders[i]['updated_at'] = datetime.now().isoformat()
                self._save_orders(orders)
                return Order(**orders[i])
        return None


# Singleton instance
order_manager = OrderManager()
