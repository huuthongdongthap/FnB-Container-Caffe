"""
Main API Server - FastAPI
"""
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import uuid
import os

from .api.cart import cart_manager, CartItem
from .api.checkout import order_manager, CheckoutRequest, Order
from .api.payment import payment_manager, PaymentRequest
from .api.dashboard import router as dashboard_router
from .api.dashboard import kds_router
from .api.loyalty import router as loyalty_router

app = FastAPI(title="FNB Caffe Container API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
STATIC_DIR = os.path.join(os.path.dirname(__file__), '../../public')
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ============= CART API =============

class AddToCartRequest(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int = 1
    image: Optional[str] = None
    options: Optional[dict] = None


class UpdateCartRequest(BaseModel):
    item_id: str
    quantity: int


@app.post("/api/cart/add")
async def add_to_cart(request: AddToCartRequest, session_id: Optional[str] = None):
    """Thêm sản phẩm vào giỏ hàng"""
    if not session_id:
        session_id = str(uuid.uuid4())

    item = CartItem(
        id=request.product_id,
        name=request.name,
        price=request.price,
        quantity=request.quantity,
        image=request.image,
        options=request.options
    )

    cart = cart_manager.add_item(session_id, item)
    return {
        "success": True,
        "session_id": session_id,
        "cart": {
            "items": cart.items,
            "total": cart.total(),
            "count": len(cart.items)
        }
    }


@app.post("/api/cart/update")
async def update_cart(request: UpdateCartRequest, session_id: str):
    """Cập nhật số lượng sản phẩm"""
    cart = cart_manager.update_item(session_id, request.item_id, request.quantity)
    return {
        "success": True,
        "cart": {
            "items": cart.items,
            "total": cart.total(),
            "count": len(cart.items)
        }
    }


@app.post("/api/cart/remove")
async def remove_from_cart(item_id: str, session_id: str):
    """Xóa sản phẩm khỏi giỏ"""
    cart = cart_manager.remove_item(session_id, item_id)
    return {
        "success": True,
        "cart": {
            "items": cart.items,
            "total": cart.total(),
            "count": len(cart.items)
        }
    }


@app.get("/api/cart")
async def get_cart(session_id: str):
    """Lấy giỏ hàng"""
    cart = cart_manager.get_cart(session_id)
    return {
        "success": True,
        "cart": {
            "items": cart.items,
            "total": cart.total(),
            "count": len(cart.items)
        }
    }


@app.post("/api/cart/clear")
async def clear_cart(session_id: str):
    """Xóa toàn bộ giỏ hàng"""
    cart_manager.clear_cart(session_id)
    return {"success": True}


# ============= CHECKOUT API =============

class CustomerInfo(BaseModel):
    full_name: str
    phone: str
    email: Optional[str] = None
    address: str
    ward: Optional[str] = None
    city: str = "Đồng Tháp"
    district: str = "Sa Đéc"
    notes: Optional[str] = None


class CheckoutRequestModel(BaseModel):
    session_id: str
    customer: CustomerInfo
    payment_method: str = "cod"


@app.post("/api/checkout")
async def checkout(request: CheckoutRequestModel):
    """Thanh toán - tạo đơn hàng"""
    try:
        checkout_req = CheckoutRequest(
            session_id=request.session_id,
            customer=request.customer,
            payment_method=request.payment_method
        )

        order = order_manager.create_order(checkout_req)

        return {
            "success": True,
            "order": order.model_dump()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/orders/{order_id}")
async def get_order(order_id: str):
    """Lấy thông tin đơn hàng"""
    order = order_manager.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return {
        "success": True,
        "order": order.model_dump()
    }


@app.get("/api/orders")
async def get_orders(session_id: str):
    """Lấy danh sách đơn hàng"""
    orders = order_manager.get_orders_by_session(session_id)
    return {
        "success": True,
        "orders": [o.model_dump() for o in orders]
    }


# ============= PAYMENT API =============

@app.post("/api/payment/create-url")
async def create_payment_url(order_id: str, payment_method: str, amount: float):
    """Tạo URL thanh toán"""
    req = PaymentRequest(
        order_id=order_id,
        amount=amount,
        payment_method=payment_method
    )

    if payment_method == "vnpay":
        url = payment_manager.create_vnpay_url(req)
    elif payment_method == "momo":
        url = payment_manager.create_momo_url(req)
    else:
        raise HTTPException(status_code=400, detail="Unsupported payment method")

    return {
        "success": True,
        "payment_url": url
    }


@app.get("/api/payment/vnpay/callback")
async def vnpay_callback(request: Request, order_id: str = Query(...)):
    """VNPay callback"""
    params = dict(request.query_params)

    if payment_manager.verify_vnpay_callback(params):
        if params.get('vnp_ResponseCode') == '00':
            order_manager.update_payment_status(order_id, "paid")
            order_manager.update_order_status(order_id, "confirmed")
            return RedirectResponse(url="/success.html?order_id=" + order_id)
        else:
            order_manager.update_payment_status(order_id, "failed")
            return RedirectResponse(url="/failure.html?order_id=" + order_id)
    else:
        raise HTTPException(status_code=400, detail="Invalid signature")


@app.get("/api/payment/momo/callback")
async def momo_callback(request: Request, order_id: str = Query(...)):
    """MoMo callback"""
    params = dict(request.query_params)

    if payment_manager.verify_momo_callback(params):
        order_manager.update_payment_status(order_id, "paid")
        order_manager.update_order_status(order_id, "confirmed")
        return RedirectResponse(url="/success.html?order_id=" + order_id)
    else:
        return RedirectResponse(url="/failure.html?order_id=" + order_id)


@app.post("/api/payment/momo/ipn")
async def momo_ipn(request: Request, order_id: str = Query(...)):
    """MoMo IPN (Instant Payment Notification)"""
    # Handle server-to-server notification
    return {"success": True}


# ============= HEALTH CHECK =============

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "fnb-caffe-api"}


# Include Dashboard Router
app.include_router(dashboard_router)

# Include KDS Router
app.include_router(kds_router)

# Include Loyalty Router
app.include_router(loyalty_router)


# ============= SERVE FRONTEND =============

@app.get("/")
async def serve_index():
    """Serve index.html"""
    index_path = os.path.join(os.path.dirname(__file__), '../../index.html')
    if os.path.exists(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="index.html not found")
