/**
 * @jest-environment jsdom
 */

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock CustomEvent
window.CustomEvent = jest.fn().mockImplementation((type, eventInit) => ({
  type,
  detail: eventInit?.detail
}));

// Mock dispatchEvent
window.dispatchEvent = jest.fn();

// Import cart manager
import('../js/cart-manager.js');

describe('CartManager', () => {
  let cartManager;
  let mockCart;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockCart = [
      { id: 1, name: 'Cà phê đen', price: 25000, quantity: 2 },
      { id: 2, name: 'Cà phê sữa', price: 30000, quantity: 1 }
    ];

    // Setup localStorage mock
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockCart));
    localStorageMock.setItem.mockClear();

    // Re-instantiate cart manager to pick up new localStorage
    delete window.cartManager;
    jest.isolateModules(() => {
      require('../js/cart-manager.js');
      cartManager = window.cartManager;
    });
  });

  describe('constructor', () => {
    test('khởi tạo với items từ localStorage', () => {
      expect(cartManager.items).toEqual(mockCart);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('fnb_cart');
    });

    test('khởi tạo với mảng rỗng khi localStorage không có dữ liệu', () => {
      localStorageMock.getItem.mockReturnValue(null);

      jest.isolateModules(() => {
        delete window.cartManager;
        require('../js/cart-manager.js');
        const freshCartManager = window.cartManager;
        expect(freshCartManager.items).toEqual([]);
      });
    });
  });

  describe('load', () => {
    test('trả về mảng rỗng khi parse lỗi', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');

      jest.isolateModules(() => {
        delete window.cartManager;
        require('../js/cart-manager.js');
        const freshCartManager = window.cartManager;
        expect(freshCartManager.items).toEqual([]);
      });
    });
  });

  describe('save', () => {
    test('lưu items vào localStorage', () => {
      cartManager.items = mockCart;
      cartManager.save();

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'fnb_cart',
        JSON.stringify(mockCart)
      );
    });

    test('phát sự kiện cartUpdate khi lưu', () => {
      cartManager.save();

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cartUpdate',
          detail: expect.objectContaining({
            items: cartManager.items
          })
        })
      );
    });
  });

  describe('add', () => {
    test('thêm sản phẩm mới vào giỏ', () => {
      const newProduct = { id: 3, name: 'Trà đào', price: 35000 };
      cartManager.items = [];

      cartManager.add(newProduct, 2);

      expect(cartManager.items).toHaveLength(1);
      expect(cartManager.items[0]).toEqual({
        ...newProduct,
        quantity: 2
      });
    });

    test('tăng số lượng khi sản phẩm đã có trong giỏ', () => {
      cartManager.items = [{ id: 1, name: 'Cà phê đen', price: 25000, quantity: 2 }];

      cartManager.add({ id: 1, name: 'Cà phê đen', price: 25000 }, 3);

      expect(cartManager.items[0].quantity).toBe(5);
    });

    test('lưu sau khi thêm', () => {
      const newProduct = { id: 3, name: 'Trà đào', price: 35000 };
      cartManager.add(newProduct);

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    test('xóa sản phẩm khỏi giỏ', () => {
      cartManager.items = mockCart;

      cartManager.remove(1);

      expect(cartManager.items).toHaveLength(1);
      expect(cartManager.items[0].id).toBe(2);
    });

    test('lưu sau khi xóa', () => {
      cartManager.remove(1);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('setQuantity', () => {
    test('cập nhật số lượng sản phẩm', () => {
      cartManager.items = mockCart;

      cartManager.setQuantity(1, 5);

      expect(cartManager.items[0].quantity).toBe(5);
    });

    test('đặt số lượng tối thiểu là 1 khi giá trị <= 0', () => {
      cartManager.items = mockCart;

      cartManager.setQuantity(1, 0);

      expect(cartManager.items[0].quantity).toBe(1);
    });

    test('không làm gì khi không tìm thấy sản phẩm', () => {
      cartManager.items = mockCart;

      cartManager.setQuantity(999, 5);

      expect(cartManager.items[0].quantity).toBe(2);
    });
  });

  describe('increase', () => {
    test('tăng số lượng sản phẩm', () => {
      cartManager.items = mockCart;

      cartManager.increase(1, 2);

      expect(cartManager.items[0].quantity).toBe(4);
    });

    test('tăng số lượng mặc định là 1', () => {
      cartManager.items = mockCart;

      cartManager.increase(1);

      expect(cartManager.items[0].quantity).toBe(3);
    });
  });

  describe('decrease', () => {
    test('giảm số lượng sản phẩm', () => {
      cartManager.items = [{ id: 1, name: 'Cà phê đen', price: 25000, quantity: 3 }];

      cartManager.decrease(1, 1);

      expect(cartManager.items[0].quantity).toBe(2);
    });

    test('xóa sản phẩm khi số lượng = 1 và giảm', () => {
      cartManager.items = [{ id: 1, name: 'Cà phê đen', price: 25000, quantity: 1 }];

      cartManager.decrease(1);

      expect(cartManager.items).toHaveLength(0);
    });

    test('không làm gì khi số lượng đã là 1', () => {
      cartManager.items = [{ id: 1, name: 'Cà phê đen', price: 25000, quantity: 1 }];

      cartManager.decrease(1, 2);

      expect(cartManager.items).toHaveLength(0);
    });
  });

  describe('getTotal', () => {
    test('tính tổng tiền đúng', () => {
      cartManager.items = [
        { id: 1, name: 'Cà phê đen', price: 25000, quantity: 2 },
        { id: 2, name: 'Cà phê sữa', price: 30000, quantity: 1 }
      ];

      const total = cartManager.getTotal();

      expect(total).toBe(80000); // 25000*2 + 30000
    });

    test('trả về 0 khi giỏ rỗng', () => {
      cartManager.items = [];

      const total = cartManager.getTotal();

      expect(total).toBe(0);
    });
  });

  describe('getTotalFormatted', () => {
    test('định dạng tiền tệ đúng', () => {
      cartManager.items = [
        { id: 1, name: 'Cà phê đen', price: 25000, quantity: 2 }
      ];

      const formatted = cartManager.getTotalFormatted();

      expect(formatted.replace(/\s/g, ' ')).toBe('50.000 ₫'); // Normalize whitespace
    });
  });

  describe('getCount', () => {
    test('tính tổng số lượng sản phẩm', () => {
      cartManager.items = [
        { id: 1, name: 'Cà phê đen', price: 25000, quantity: 2 },
        { id: 2, name: 'Cà phê sữa', price: 30000, quantity: 3 }
      ];

      const count = cartManager.getCount();

      expect(count).toBe(5);
    });

    test('trả về 0 khi giỏ rỗng', () => {
      cartManager.items = [];

      const count = cartManager.getCount();

      expect(count).toBe(0);
    });
  });

  describe('clear', () => {
    test('xóa tất cả items', () => {
      cartManager.items = mockCart;

      cartManager.clear();

      expect(cartManager.items).toEqual([]);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('getItems', () => {
    test('trả về bản sao của items', () => {
      cartManager.items = mockCart;

      const items = cartManager.getItems();

      expect(items).toEqual(mockCart);
      expect(items).not.toBe(cartManager.items);
    });
  });
});
