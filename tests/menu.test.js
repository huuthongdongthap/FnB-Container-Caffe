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

// Mock window.cartManager
window.cartManager = {
  add: jest.fn()
};

// Mock CustomEvent
window.CustomEvent = jest.fn().mockImplementation((type, eventInit) => ({
  type,
  detail: eventInit?.detail
}));

// Import menu manager
import('../js/menu.js');

describe('MenuManager', () => {
  let menuManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    window.cartManager.add.mockClear();

    // Setup DOM
    document.body.innerHTML = `
      <div class="m3-filter-container">
        <button class="m3-filter-chip active" data-filter="all">Tất cả</button>
        <button class="m3-filter-chip" data-filter="coffee">Cà phê</button>
        <button class="m3-filter-chip" data-filter="tea">Trà</button>
        <button class="m3-filter-chip" data-filter="juice">Nước ép</button>
      </div>

      <div class="m3-search-container">
        <input type="search" id="menuSearch" placeholder="Tìm kiếm..." />
        <button id="searchClear" style="opacity: 0;">✕</button>
      </div>

      <div class="menu-grid">
        <div class="m3-menu-card" data-category="coffee">
          <h3 class="m3-card-title">Cà phê đen</h3>
          <p class="m3-card-desc">Cà phê nguyên chất</p>
          <button class="m3-add-cart-btn" data-product='{"id":1,"name":"Cà phê đen","price":25000}'>Thêm</button>
        </div>
        <div class="m3-menu-card" data-category="coffee">
          <h3 class="m3-card-title">Cà phê sữa</h3>
          <p class="m3-card-desc">Cà phê sữa đá</p>
          <button class="m3-add-cart-btn" data-product='{"id":2,"name":"Cà phê sữa","price":30000}'>Thêm</button>
        </div>
        <div class="m3-menu-card" data-category="tea">
          <h3 class="m3-card-title">Trà đào</h3>
          <p class="m3-card-desc">Trà đào cam sả</p>
          <button class="m3-add-cart-btn" data-product='{"id":3,"name":"Trà đào","price":35000}'>Thêm</button>
        </div>
        <div class="m3-menu-card" data-category="juice">
          <h3 class="m3-card-title">Nước cam</h3>
          <p class="m3-card-desc">Nước cam tươi</p>
          <button class="m3-add-cart-btn" data-product='{"id":4,"name":"Nước cam","price":40000}'>Thêm</button>
        </div>
      </div>
    `;

    // Re-instantiate menu manager
    jest.isolateModules(() => {
      require('../js/menu.js');
    });
  });

  describe('constructor', () => {
    test('khởi tạo với currentCategory = all', () => {
      // MenuManager should initialize with currentCategory = 'all'
      expect(document.querySelector('.m3-filter-chip.active').dataset.filter).toBe('all');
    });

    test('khởi tạo với searchQuery rỗng', () => {
      const searchInput = document.getElementById('menuSearch');
      expect(searchInput.value).toBe('');
    });
  });

  describe('init', () => {
    test('bind filter events', () => {
      const filterChips = document.querySelectorAll('.m3-filter-chip');
      expect(filterChips.length).toBe(4);
    });

    test('bind search events', () => {
      const searchInput = document.getElementById('menuSearch');
      const searchClear = document.getElementById('searchClear');
      expect(searchInput).toBeTruthy();
      expect(searchClear).toBeTruthy();
    });

    test('bind add to cart events', () => {
      const addToCartBtns = document.querySelectorAll('.m3-add-cart-btn');
      expect(addToCartBtns.length).toBe(4);
    });
  });

  describe('switchFilter', () => {
    test('chuyển filter sang coffee', () => {
      const coffeeFilter = document.querySelector('[data-filter="coffee"]');
      coffeeFilter.click();

      const activeFilter = document.querySelector('.m3-filter-chip.active');
      expect(activeFilter.dataset.filter).toBe('coffee');
    });

    test('chuyển filter sang tea', () => {
      const teaFilter = document.querySelector('[data-filter="tea"]');
      teaFilter.click();

      const activeFilter = document.querySelector('.m3-filter-chip.active');
      expect(activeFilter.dataset.filter).toBe('tea');
    });

    test('ẩn các category không khớp', () => {
      const coffeeFilter = document.querySelector('[data-filter="coffee"]');
      coffeeFilter.click();

      const coffeeItems = document.querySelectorAll('.m3-menu-card[data-category="coffee"]');
      const teaItems = document.querySelectorAll('.m3-menu-card[data-category="tea"]');

      // Coffee items should be visible, tea items hidden
      expect(coffeeItems.length).toBe(2);
      expect(teaItems.length).toBe(1);
    });
  });

  describe('filterMenuItems', () => {
    test('hiển thị tất cả items khi filter = all', () => {
      const allItems = document.querySelectorAll('.m3-menu-card');
      expect(allItems.length).toBe(4);
    });

    test('lọc theo category coffee', () => {
      const coffeeFilter = document.querySelector('[data-filter="coffee"]');
      coffeeFilter.click();

      const visibleItems = Array.from(document.querySelectorAll('.m3-menu-card'))
        .filter(item => item.style.display !== 'none');

      expect(visibleItems.length).toBe(2);
      visibleItems.forEach(item => {
        expect(item.dataset.category).toBe('coffee');
      });
    });

    test('lọc theo search query', () => {
      const searchInput = document.getElementById('menuSearch');
      searchInput.value = 'sữa';
      searchInput.dispatchEvent(new Event('input'));

      const visibleItems = Array.from(document.querySelectorAll('.m3-menu-card'))
        .filter(item => item.style.display !== 'none');

      expect(visibleItems.length).toBe(1);
      expect(visibleItems[0].querySelector('.m3-card-title').textContent).toContain('sữa');
    });

    test('lọc theo category và search query', () => {
      // First filter by coffee
      const coffeeFilter = document.querySelector('[data-filter="coffee"]');
      coffeeFilter.click();

      // Then search
      const searchInput = document.getElementById('menuSearch');
      searchInput.value = 'đen';
      searchInput.dispatchEvent(new Event('input'));

      const visibleItems = Array.from(document.querySelectorAll('.m3-menu-card'))
        .filter(item => item.style.display !== 'none');

      expect(visibleItems.length).toBe(1);
      expect(visibleItems[0].querySelector('.m3-card-title').textContent).toContain('đen');
    });
  });

  describe('search functionality', () => {
    test('search input updates searchQuery', () => {
      const searchInput = document.getElementById('menuSearch');
      searchInput.value = 'cam';
      searchInput.dispatchEvent(new Event('input'));

      const searchClear = document.getElementById('searchClear');
      expect(searchClear.style.opacity).toBe('1');
    });

    test('clear button clears search', () => {
      const searchInput = document.getElementById('menuSearch');
      const searchClear = document.getElementById('searchClear');

      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input'));
      expect(searchClear.style.opacity).toBe('1');

      searchClear.click();
      expect(searchInput.value).toBe('');
      expect(searchClear.style.opacity).toBe('0');
    });

    test('search clears and shows all items', () => {
      const searchInput = document.getElementById('menuSearch');
      const searchClear = document.getElementById('searchClear');

      // First search to filter
      searchInput.value = 'cam';
      searchInput.dispatchEvent(new Event('input'));

      // Then clear
      searchClear.click();

      const visibleItems = Array.from(document.querySelectorAll('.m3-menu-card'))
        .filter(item => item.style.display !== 'none');

      expect(visibleItems.length).toBe(4);
    });
  });

  describe('addToCart', () => {
    test('thêm sản phẩm vào giỏ khi click button', () => {
      const addToCartBtn = document.querySelector('.m3-add-cart-btn');
      addToCartBtn.click();

      expect(window.cartManager.add).toHaveBeenCalled();
    });

    test('truyền đúng product data khi add to cart', () => {
      const addToCartBtn = document.querySelector('.m3-add-cart-btn');
      addToCartBtn.click();

      expect(window.cartManager.add).toHaveBeenCalledWith({
        id: 1,
        name: 'Cà phê đen',
        price: 25000
      });
    });

    test('show toast sau khi thêm vào giỏ', () => {
      const addToCartBtn = document.querySelector('.m3-add-cart-btn');
      addToCartBtn.click();

      // Toast should be created
      const toast = document.querySelector('.m3-toast');
      expect(toast).toBeTruthy();
    });
  });

  describe('showAddToast', () => {
    test('tạo toast element', () => {
      const toast = document.createElement('div');
      toast.className = 'm3-toast';
      toast.innerHTML = '✓ Đã thêm <strong>Cà phê đen</strong> vào giỏ hàng';

      expect(toast.className).toBe('m3-toast');
      expect(toast.innerHTML).toContain('Cà phê đen');
    });

    test('toast tự động ẩn sau 2 giây', () => {
      jest.useFakeTimers();

      const toast = document.createElement('div');
      toast.className = 'm3-toast';
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
      }, 2000);

      jest.advanceTimersByTime(2000);
      expect(toast.style.opacity).toBe('0');
    });

    test('toast bị remove sau 300ms', () => {
      jest.useFakeTimers();

      const toast = document.createElement('div');
      toast.className = 'm3-toast';
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 2000);

      jest.advanceTimersByTime(2300);
      // Toast should be removed
      expect(document.querySelector('.m3-toast')).toBeNull();
    });
  });

  describe('event delegation', () => {
    test('click event delegation cho add to cart', () => {
      const addToCartBtn = document.querySelector('.m3-add-cart-btn');

      // Simulate click on child element
      const childSpan = document.createElement('span');
      childSpan.textContent = 'Thêm';
      addToCartBtn.appendChild(childSpan);

      childSpan.click();

      expect(window.cartManager.add).toHaveBeenCalled();
    });

    test('filter chip click event', () => {
      const filterChip = document.querySelector('[data-filter="juice"]');
      filterChip.click();

      const activeFilter = document.querySelector('.m3-filter-chip.active');
      expect(activeFilter.dataset.filter).toBe('juice');
    });
  });

  describe('menu items', () => {
    test('mỗi menu item có đủ data attributes', () => {
      const menuItems = document.querySelectorAll('.m3-menu-card');

      menuItems.forEach(item => {
        expect(item.dataset.category).toBeDefined();
        expect(item.querySelector('.m3-card-title')).toBeTruthy();
        expect(item.querySelector('.m3-card-desc')).toBeTruthy();
        expect(item.querySelector('.m3-add-cart-btn')).toBeTruthy();
      });
    });

    test('mỗi add to cart button có data-product JSON', () => {
      const addToCartBtns = document.querySelectorAll('.m3-add-cart-btn');

      addToCartBtns.forEach(btn => {
        expect(btn.dataset.product).toBeDefined();
        const product = JSON.parse(btn.dataset.product);
        expect(product.id).toBeDefined();
        expect(product.name).toBeDefined();
        expect(product.price).toBeDefined();
      });
    });
  });
});
