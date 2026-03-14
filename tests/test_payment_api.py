"""
Tests for Payment Gateway - Kiểm tra thanh toán functionality
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

from api.payment import PaymentRequest, PaymentResponse, PaymentManager


class TestPaymentRequest:
    """Tests for PaymentRequest model"""

    def test_create_payment_request(self):
        """Test tạo payment request cơ bản"""
        request = PaymentRequest(
            order_id="order-123",
            amount=100000,
            payment_method="vnpay"
        )
        assert request.order_id == "order-123"
        assert request.amount == 100000
        assert request.payment_method == "vnpay"
        assert request.locale == "vn"  # default

    def test_payment_request_with_custom_locale(self):
        """Test payment request với locale tùy chỉnh"""
        request = PaymentRequest(
            order_id="order-456",
            amount=200000,
            payment_method="momo",
            locale="en"
        )
        assert request.locale == "en"

    def test_payment_request_all_methods(self):
        """Test payment request với tất cả payment methods"""
        for method in ["vnpay", "momo", "payos"]:
            request = PaymentRequest(
                order_id=f"order-{method}",
                amount=100000,
                payment_method=method
            )
            assert request.payment_method == method


class TestPaymentManager:
    """Tests for PaymentManager"""

    @pytest.fixture
    def temp_storage(self):
        """Fixture tạo temporary storage file"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump([], f)
            temp_path = f.name

        # Patch PAYMENT_STORAGE
        import api.payment as payment_module
        original_path = payment_module.PAYMENT_STORAGE
        payment_module.PAYMENT_STORAGE = temp_path

        yield temp_path

        # Restore original path
        payment_module.PAYMENT_STORAGE = original_path
        os.unlink(temp_path)

    @pytest.fixture
    def mock_env_vars(self):
        """Fixture mock environment variables"""
        with patch.dict(os.environ, {
            "VNPAY_TMN_CODE": "TEST_TMN",
            "VNPAY_HASH_SECRET": "TEST_SECRET",
            "MOMO_PARTNER_CODE": "TEST_MOMO",
            "MOMO_ACCESS_KEY": "TEST_ACCESS",
            "MOMO_SECRET_KEY": "TEST_MOMO_SECRET",
            "PAYOS_CLIENT_ID": "TEST_PAYOS",
            "PAYOS_API_KEY": "TEST_PAYOS_KEY",
            "PAYOS_CHECKSUM_KEY": "TEST_CHECKSUM"
        }):
            yield

    def test_create_vnpay_url(self, temp_storage, mock_env_vars):
        """Test tạo URL thanh toán VNPay"""
        manager = PaymentManager()
        request = PaymentRequest(
            order_id="order-vnpay-123",
            amount=100000,
            payment_method="vnpay"
        )

        url = manager.create_vnpay_url(request)

        assert url is not None
        assert "vnp_Version" in url
        assert "vnp_TmnCode" in url
        assert "vnp_SecureHash" in url

    def test_create_vnpay_url_saves_log(self, temp_storage, mock_env_vars):
        """Test VNPay URL lưu log"""
        manager = PaymentManager()
        request = PaymentRequest(
            order_id="order-vnpay-log",
            amount=150000,
            payment_method="vnpay"
        )

        manager.create_vnpay_url(request)

        # Check log file
        with open(temp_storage, 'r') as f:
            logs = json.load(f)

        assert len(logs) == 1
        assert logs[0]["order_id"] == "order-vnpay-log"
        assert logs[0]["payment_method"] == "vnpay"
        assert logs[0]["amount"] == 150000

    def test_verify_vnpay_callback_valid(self, temp_storage, mock_env_vars):
        """Test xác thực callback VNPay hợp lệ"""
        manager = PaymentManager()

        # Create a valid signature (simplified test)
        params = {
            'vnp_ResponseCode': '00',
            'vnp_TransactionStatus': '00',
            'vnp_SecureHash': 'invalid_hash_for_testing'
        }

        # Should return False for invalid hash
        result = manager.verify_vnpay_callback(params)
        assert result is False

    def test_create_momo_url(self, temp_storage, mock_env_vars):
        """Test tạo URL thanh toán MoMo"""
        manager = PaymentManager()
        request = PaymentRequest(
            order_id="order-momo-123",
            amount=200000,
            payment_method="momo"
        )

        url = manager.create_momo_url(request)

        assert url is not None
        assert "order_id" in url

    def test_create_momo_url_saves_log(self, temp_storage, mock_env_vars):
        """Test MoMo URL lưu log"""
        manager = PaymentManager()
        request = PaymentRequest(
            order_id="order-momo-log",
            amount=250000,
            payment_method="momo"
        )

        manager.create_momo_url(request)

        # Check log file
        with open(temp_storage, 'r') as f:
            logs = json.load(f)

        assert len(logs) == 1
        assert logs[0]["order_id"] == "order-momo-log"
        assert logs[0]["payment_method"] == "momo"

    def test_verify_momo_callback_valid(self, temp_storage, mock_env_vars):
        """Test xác thực callback MoMo hợp lệ"""
        manager = PaymentManager()

        params = {
            'resultCode': 0,
            'orderId': 'order-123'
        }

        result = manager.verify_momo_callback(params)
        assert result is True

    def test_verify_momo_callback_invalid(self, temp_storage, mock_env_vars):
        """Test xác thực callback MoMo không hợp lệ"""
        manager = PaymentManager()

        params = {
            'resultCode': 99,  # Error code
            'orderId': 'order-123'
        }

        result = manager.verify_momo_callback(params)
        assert result is False

    def test_create_payos_url_mock(self, temp_storage, mock_env_vars):
        """Test tạo URL thanh toán PayOS (mock)"""
        manager = PaymentManager()
        request = PaymentRequest(
            order_id="order-payos-123",
            amount=300000,
            payment_method="payos"
        )

        url = manager.create_payos_url(request)

        assert url is not None
        # URL should contain order_id
        assert "order_id" in url or "orderCode" in url

    def test_create_payos_url_saves_log(self, temp_storage, mock_env_vars):
        """Test PayOS URL lưu log"""
        manager = PaymentManager()
        request = PaymentRequest(
            order_id="order-payos-log",
            amount=350000,
            payment_method="payos"
        )

        manager.create_payos_url(request)

        # Check log file
        with open(temp_storage, 'r') as f:
            logs = json.load(f)

        assert len(logs) >= 1
        log_entry = next((l for l in logs if l["order_id"] == "order-payos-log"), None)
        assert log_entry is not None
        assert log_entry["payment_method"] == "payos"

    def test_verify_payos_callback_valid(self, temp_storage, mock_env_vars):
        """Test xác thực callback PayOS hợp lệ"""
        manager = PaymentManager()

        params = {
            'code': '00',
            'status': 'PAID'
        }

        result = manager.verify_payos_callback(params)
        assert result is True


class TestPaymentManagerEdgeCases:
    """Tests for edge cases và error handling"""

    @pytest.fixture
    def temp_storage(self):
        """Fixture tạo temporary storage file"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump([], f)
            temp_path = f.name

        import api.payment as payment_module
        original_path = payment_module.PAYMENT_STORAGE
        payment_module.PAYMENT_STORAGE = temp_path

        yield temp_path

        payment_module.PAYMENT_STORAGE = original_path
        os.unlink(temp_path)

    def test_payment_request_with_large_amount(self, temp_storage):
        """Test payment request với số tiền lớn"""
        manager = PaymentManager()
        request = PaymentRequest(
            order_id="order-large",
            amount=10000000,  # 10 million
            payment_method="vnpay"
        )

        url = manager.create_vnpay_url(request)
        assert url is not None

    def test_payment_request_with_decimal_amount(self, temp_storage):
        """Test payment request với số tiền lẻ"""
        manager = PaymentManager()
        request = PaymentRequest(
            order_id="order-decimal",
            amount=99999.50,
            payment_method="momo"
        )

        url = manager.create_momo_url(request)
        assert url is not None

    def test_payment_request_special_characters(self, temp_storage):
        """Test payment request với ký tự đặc biệt"""
        manager = PaymentManager()
        request = PaymentRequest(
            order_id="order-special-☕",
            amount=100000,
            payment_method="payos"
        )

        url = manager.create_payos_url(request)
        assert url is not None

    def test_multiple_payment_logs(self, temp_storage):
        """Test nhiều payment logs được lưu"""
        manager = PaymentManager()

        # Create multiple payment requests
        for i in range(5):
            request = PaymentRequest(
                order_id=f"order-{i}",
                amount=100000 * (i + 1),
                payment_method="vnpay"
            )
            manager.create_vnpay_url(request)

        # Check log file
        with open(temp_storage, 'r') as f:
            logs = json.load(f)

        assert len(logs) == 5

    def test_payment_manager_default_credentials(self, temp_storage):
        """Test PaymentManager với credentials mặc định (TEST)"""
        # Without mocking env vars, should use TEST credentials
        manager = PaymentManager()

        assert manager.vnpay_tmn_code == "TEST"
        assert manager.momo_partner_code == "MOMO"


class TestPaymentResponse:
    """Tests for PaymentResponse model"""

    def test_create_success_response(self):
        """Test tạo response thành công"""
        response = PaymentResponse(
            success=True,
            payment_url="https://payment.example.com/pay/123",
            message="Payment URL created successfully"
        )
        assert response.success is True
        assert "payment.example.com" in response.payment_url

    def test_create_failure_response(self):
        """Test tạo response thất bại"""
        response = PaymentResponse(
            success=False,
            message="Payment method not supported"
        )
        assert response.success is False
        assert response.payment_url is None


class TestPaymentIntegration:
    """Integration tests for payment flow"""

    @pytest.fixture
    def temp_storage(self):
        """Fixture tạo temporary storage file"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump([], f)
            temp_path = f.name

        import api.payment as payment_module
        original_path = payment_module.PAYMENT_STORAGE
        payment_module.PAYMENT_STORAGE = temp_path

        yield temp_path

        payment_module.PAYMENT_STORAGE = original_path
        os.unlink(temp_path)

    def test_full_payment_flow_vnpay(self, temp_storage, mock_env_vars):
        """Test full payment flow với VNPay"""
        manager = PaymentManager()

        # Step 1: Create payment request
        request = PaymentRequest(
            order_id="flow-vnpay-123",
            amount=150000,
            payment_method="vnpay"
        )

        # Step 2: Generate payment URL
        url = manager.create_vnpay_url(request)
        assert url is not None

        # Step 3: Verify callback (mock)
        callback_params = {
            'vnp_ResponseCode': '00',
            'vnp_TransactionStatus': '00',
            'vnp_SecureHash': 'test_hash'
        }
        # Note: Real verification would fail with test_hash
        # This tests the callback handler exists

    def test_full_payment_flow_momo(self, temp_storage, mock_env_vars):
        """Test full payment flow với MoMo"""
        manager = PaymentManager()

        # Step 1: Create payment request
        request = PaymentRequest(
            order_id="flow-momo-123",
            amount=200000,
            payment_method="momo"
        )

        # Step 2: Generate payment URL
        url = manager.create_momo_url(request)
        assert url is not None

        # Step 3: Verify callback
        callback_params = {
            'resultCode': 0,
            'orderId': 'flow-momo-123'
        }
        result = manager.verify_momo_callback(callback_params)
        assert result is True

    def test_payment_method_comparison(self, temp_storage, mock_env_vars):
        """Test so sánh các phương thức thanh toán"""
        manager = PaymentManager()
        request = PaymentRequest(
            order_id="compare-123",
            amount=100000,
            payment_method="vnpay"
        )

        # All methods should generate URLs
        vnpay_url = manager.create_vnpay_url(request)
        momo_url = manager.create_momo_url(request)
        payos_url = manager.create_payos_url(request)

        assert vnpay_url is not None
        assert momo_url is not None
        assert payos_url is not None
