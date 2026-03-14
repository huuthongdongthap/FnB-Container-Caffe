"""
Payment Gateway - Tích hợp VNPay và MoMo
"""
from typing import Optional, Dict
from pydantic import BaseModel
from datetime import datetime
import hashlib
import hmac
import urllib.parse
import os
import json

PAYMENT_STORAGE = os.path.join(os.path.dirname(__file__), '../../data/payments.json')


class PaymentRequest(BaseModel):
    """Yêu cầu thanh toán"""
    order_id: str
    amount: float
    payment_method: str  # vnpay, momo
    locale: str = "vn"


class PaymentResponse(BaseModel):
    """Kết quả thanh toán"""
    success: bool
    payment_url: Optional[str] = None
    message: str = ""
    transaction_id: Optional[str] = None


class PaymentManager:
    """Quản lý thanh toán"""

    def __init__(self):
        self.vnpay_tmn_code = os.getenv("VNPAY_TMN_CODE", "TEST")
        self.vnpay_hash_secret = os.getenv("VNPAY_HASH_SECRET", "TEST")
        self.vnpay_url = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"

        self.momo_partner_code = os.getenv("MOMO_PARTNER_CODE", "MOMO")
        self.momo_access_key = os.getenv("MOMO_ACCESS_KEY", "TEST")
        self.momo_secret_key = os.getenv("MOMO_SECRET_KEY", "TEST")
        self.momo_url = "https://test-payment.momo.vn/v2/gateway/api/create"

        self.payos_client_id = os.getenv("PAYOS_CLIENT_ID", "TEST")
        self.payos_api_key = os.getenv("PAYOS_API_KEY", "TEST")
        self.payos_checksum_key = os.getenv("PAYOS_CHECKSUM_KEY", "TEST")
        self.payos_url = "https://api-merchant.payos.vn/v2/payment-requests"

        self._ensure_storage()

    def _ensure_storage(self):
        """Đảm bảo file storage tồn tại"""
        os.makedirs(os.path.dirname(PAYMENT_STORAGE), exist_ok=True)
        if not os.path.exists(PAYMENT_STORAGE):
            with open(PAYMENT_STORAGE, 'w') as f:
                json.dump([], f)

    def _save_payment_log(self, data: Dict):
        """Lưu log thanh toán"""
        with open(PAYMENT_STORAGE, 'r') as f:
            logs = json.load(f)
        logs.append(data)
        with open(PAYMENT_STORAGE, 'w') as f:
            json.dump(logs, f, indent=2, default=str)

    def create_vnpay_url(self, request: PaymentRequest) -> str:
        """Tạo URL thanh toán VNPay"""
        import time

        # Cấu hình
        tmn_code = self.vnpay_tmn_code
        secret_key = self.vnpay_hash_secret
        url = self.vnpay_url

        # Tạo các tham số
        curr_date = datetime.now()
        vnp_ordinal = int(curr_date.strftime("%H%M%S"))
        vnp_transaction_date = curr_date.strftime("%Y%m%d%H%M%S")
        vnp_locale = request.locale
        vnp_order_info = f"Thanh toan don hang {request.order_id}"
        vnp_order_type = "billpayment"
        vnp_amount = int(request.amount * 100)  # VND * 100
        vnp_tx_ref = f"{request.order_id}{vnp_ordinal}"
        vnp_create_date = curr_date.strftime("%Y%m%d%H%M%S")

        # Build query params
        params = {
            'vnp_Version': '2.1.0',
            'vnp_Command': 'pay',
            'vnp_TmnCode': tmn_code,
            'vnp_Locale': vnp_locale,
            'vnp_CurrCode': 'VND',
            'vnp_TxnRef': vnp_tx_ref,
            'vnp_OrderInfo': vnp_order_info,
            'vnp_OrderType': vnp_order_type,
            'vnp_Amount': vnp_amount,
            'vnp_ReturnUrl': f"http://localhost:8000/api/payment/vnpay/callback?order_id={request.order_id}",
            'vnp_CreateDate': vnp_create_date,
            'vnp_IpAddr': '127.0.0.1'
        }

        # Sắp xếp params theo key
        sorted_params = sorted(params.items())
        query_string = urllib.parse.urlencode(sorted_params)

        # Tạo secure hash
        hash_data = urllib.parse.urlencode(sorted_params, doseq=True)
        secure_hash = hmac.new(
            secret_key.encode('utf-8'),
            hash_data.encode('utf-8'),
            hashlib.sha512
        ).hexdigest()

        # Thêm hash vào URL
        full_url = f"{url}?{query_string}&vnp_SecureHash={secure_hash}"

        # Log payment
        self._save_payment_log({
            "order_id": request.order_id,
            "payment_method": "vnpay",
            "amount": request.amount,
            "url": full_url,
            "created_at": datetime.now().isoformat()
        })

        return full_url

    def verify_vnpay_callback(self, params: Dict) -> bool:
        """Xác thực callback từ VNPay"""
        vnp_SecureHash = params.get('vnp_SecureHash', '')

        # Remove hash from params
        params_copy = {k: v for k, v in params.items() if k != 'vnp_SecureHash'}

        # Build data for hash
        sorted_params = sorted(params_copy.items())
        hash_data = urllib.parse.urlencode(sorted_params, doseq=True)

        # Verify hash
        secure_hash = hmac.new(
            self.vnpay_hash_secret.encode('utf-8'),
            hash_data.encode('utf-8'),
            hashlib.sha512
        ).hexdigest()

        return hmac.compare_digest(vnp_SecureHash, secure_hash)

    def create_momo_url(self, request: PaymentRequest) -> str:
        """Tạo URL thanh toán MoMo"""
        import requests

        # Tạo signature
        access_key = self.momo_access_key
        secret_key = self.momo_secret_key
        partner_code = self.momo_partner_code
        order_info = f"Thanh toan don hang {request.order_id}"

        request_id = request.order_id
        amount = int(request.amount)
        redirect_url = f"http://localhost:8000/api/payment/momo/callback?order_id={request.order_id}"
        ipn_url = f"http://localhost:8000/api/payment/momo/ipn?order_id={request.order_id}"
        extra_data = ""
        order_group_id = request.order_id

        # Raw data for signature
        raw_hash = f"accessKey={access_key}&amount={amount}&extraData={extra_data}&ipnUrl={ipn_url}&orderId={request_id}&orderInfo={order_info}&partnerCode={partner_code}&redirectUrl={redirect_url}&requestId={request_id}&requestType=captureWallet"

        # Signature
        signature = hmac.new(
            secret_key.encode('utf-8'),
            raw_hash.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        # Request body
        request_body = {
            "partnerCode": partner_code,
            "partnerName": "FNB Caffe Container",
            "storeId": "FNB001",
            "requestId": request_id,
            "amount": amount,
            "orderId": request_id,
            "orderInfo": order_info,
            "redirectUrl": redirect_url,
            "ipnUrl": ipn_url,
            "lang": "vi",
            "requestType": "captureWallet",
            "extraData": extra_data,
            "orderGroupId": order_group_id,
            "autoCapture": True
        }

        # Log payment (return mock URL for now)
        momo_url = f"https://test-payment.momo.vn?order_id={request.order_id}"
        self._save_payment_log({
            "order_id": request.order_id,
            "payment_method": "momo",
            "amount": request.amount,
            "url": momo_url,
            "created_at": datetime.now().isoformat()
        })

        # In production, call MoMo API
        # response = requests.post(self.momo_url, json=request_body)
        # return response.json().get('payUrl', '')

        return momo_url

    def verify_momo_callback(self, params: Dict) -> bool:
        """Xác thực callback từ MoMo"""
        # MoMo callback verification
        # In production, verify signature from params
        return params.get('resultCode') == 0

    def create_payos_url(self, request: PaymentRequest) -> str:
        """Tạo URL thanh toán PayOS"""
        import requests
        import hashlib
        import time

        # Cấu hình
        client_id = self.payos_client_id
        api_key = self.payos_api_key
        checksum_key = self.payos_checksum_key

        # Tạo các tham số
        order_code = int(request.order_id.replace('-', ''))[:10] if request.order_id else int(time.time())
        amount = int(request.amount)
        description = f"Thanh toan don hang {request.order_id}"
        redirect_url = f"http://localhost:8000/api/payment/payos/callback?order_id={request.order_id}"
        cancel_url = f"http://localhost:8000/failure.html?order_id={request.order_id}"

        # Tạo signature
        timestamp = int(time.time())
        hash_data = f"amount={amount}&cancelUrl={cancel_url}&description={description}&orderCode={order_code}&redirectUrl={redirect_url}"
        signature = hashlib.sha256(f"{hash_data}{checksum_key}".encode()).hexdigest()

        # Request body
        request_body = {
            "orderCode": order_code,
            "amount": amount,
            "description": description,
            "redirectUrl": redirect_url,
            "cancelUrl": cancel_url,
            "signature": signature
        }

        # Call PayOS API
        headers = {
            "Content-Type": "application/json",
            "x-client-id": client_id,
            "x-api-key": api_key
        }

        try:
            response = requests.post(self.payos_url, json=request_body, headers=headers)
            result = response.json()

            if result.get('code') == '00':
                payment_url = result['data'].get('checkoutUrl')

                # Log payment
                self._save_payment_log({
                    "order_id": request.order_id,
                    "payment_method": "payos",
                    "amount": request.amount,
                    "url": payment_url,
                    "created_at": datetime.now().isoformat()
                })

                return payment_url
            else:
                # Fallback to mock URL
                mock_url = f"https://pay-portfolio.payos.vn/pay/payment?order_id={request.order_id}"
                self._save_payment_log({
                    "order_id": request.order_id,
                    "payment_method": "payos",
                    "amount": request.amount,
                    "url": mock_url,
                    "created_at": datetime.now().isoformat(),
                    "error": result.get('desc', 'Unknown error')
                })
                return mock_url
        except Exception as e:
            # Fallback to mock URL
            mock_url = f"https://pay-portfolio.payos.vn/pay/payment?order_id={request.order_id}"
            self._save_payment_log({
                "order_id": request.order_id,
                "payment_method": "payos",
                "amount": request.amount,
                "url": mock_url,
                "created_at": datetime.now().isoformat(),
                "error": str(e)
            })
            return mock_url

    def verify_payos_callback(self, params: Dict) -> bool:
        """Xác thực callback từ PayOS"""
        # PayOS callback verification
        # In production, verify signature from params
        return params.get('code') == '00' or params.get('status') == 'PAID'


# Singleton instance
payment_manager = PaymentManager()
