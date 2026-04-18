const IS_LOCAL =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const API_BASE = IS_LOCAL
    ? 'http://127.0.0.1:8787/api'
    : 'https://aura-space-worker.sadec-marketing-hub.workers.dev/api',
  // Auth helper — read JWT from localStorage, build Authorization header
  getAuthHeaders = (extra = {}) => {
    const t = localStorage.getItem('admin_token');
    const h = { ...extra };
    if (t) { h.Authorization = `Bearer ${t}`; }
    return h;
  },
  authFetch = (url, opts = {}) => fetch(url, {
    ...opts,
    headers: getAuthHeaders(opts.headers || {}),
  }),
  DashboardState = {
    currentPage: 1,
    totalPages: 1,
    currentFilter: 'all',
    dateRange: { start: null, end: null },
    searchQuery: '',
    orders: [],
    stats: null,
  },
  DashboardAPI = {
    async fetchStats() {
      try {
        const e = await authFetch(`${API_BASE}/stats`);
        const n = await e.json();
        return n.success ? n.stats : null;
      } catch (t) {
        return IS_LOCAL ? this.getMockStats() : null;
      }
    },
    async fetchRevenue(t = 7) {
      return IS_LOCAL ? this.getMockRevenue(t) : [];
    },
    async fetchOrders(t = null, limit = 20, page = 1) {
      try {
        const offset = (page - 1) * limit;
        const a = new URLSearchParams({
          limit: limit.toString(),
          offset: offset.toString(),
        });
        if (t && t !== 'all') {a.append('status', t);}

        const r = await authFetch(`${API_BASE}/admin/orders?${a}`);
        const o = await r.json();
        if (o.success) {
          DashboardState.totalPages = Math.ceil(
            (o.pagination?.total || 1) / limit,
          );
          // Map flat worker fields to dashboard expected shape
          return (o.orders || []).map(ord => ({
            id: ord.id,
            customer: {
              full_name: ord.customer_name || 'Khách lẻ',
              phone: ord.customer_phone || '',
              email: ord.customer_email || '',
            },
            items: Array.isArray(ord.items) ? ord.items : [],
            total: ord.total || 0,
            payment_status: ord.payment_status || 'pending',
            order_status: ord.status || 'pending',
            payment_method: ord.payment_method || 'cod',
            notes: ord.notes || '',
            created_at: ord.created_at || new Date().toISOString(),
          }));
        }
        return [];
      } catch (t) {
        console.error('[Dashboard] fetchOrders error:', t);
        return IS_LOCAL ? this.getMockOrders(limit) : [];
      }
    },
    async fetchOrderDetail(t) {
      try {
        const e = await authFetch(`${API_BASE}/orders/${t}`);
        const n = await e.json();
        if (n.success && n.order) {
          const ord = n.order;
          return {
            ...ord,
            customer: {
              full_name: ord.customer_name || 'Khách lẻ',
              phone: ord.customer_phone || '',
              email: ord.customer_email || '',
            },
            order_status: ord.status || 'pending',
          };
        }
        return null;
      } catch (e) {
        return IS_LOCAL ? this.getMockOrderDetail(t) : null;
      }
    },
    async fetchTopProducts(t = 10) {
      return IS_LOCAL ? this.getMockTopProducts(t) : [];
    },
    async updateOrderStatus(t, e) {
      try {
        const n = await authFetch(`${API_BASE}/orders/${t}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: e }),
        });
        const a = await n.json();
        return a.success ? a.order : null;
      } catch (t) {
        return (Toast.error('Không thể cập nhật trạng thái đơn hàng'), null);
      }
    },
    getMockStats: () => ({
      revenue: { total: 2458e4, growth: 12.5 },
      total_orders: 156,
      total_customers: 89,
      average_order_value: 157e3,
    }),
    getMockRevenue(t = 7) {
      const e = [],
        n = new Date();
      for (let a = t - 1; a >= 0; a--) {
        const t = new Date(n);
        t.setDate(t.getDate() - a);
        const r = 1e7 * Math.random(),
          o = 6 === t.getDay() || 0 === t.getDay() ? 5e6 : 0;
        e.push({ date: t.toISOString().split('T')[0], revenue: 15e6 + r + o });
      }
      return e;
    },
    getMockOrders(t = 20) {
      const e = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'],
        n = ['pending', 'paid'],
        a = [
          'Nguyễn Thành',
          'Trần Phương',
          'Lê Văn',
          'Phạm Huyền',
          'Đặng Minh',
          'Hoàng Anh',
          'Phan Cường',
          'Vũ Hạnh',
        ],
        r = [
          'Cà phê sữa đá',
          'Trà sữa trân châu',
          'Bánh mì ốp la',
          'Cà phê đen',
          'Nước ép cam',
          'Latte',
          'Americano',
          'Sandwich',
        ];
      return Array.from({ length: t }, (t, o) => ({
        id: 1e3 + o + 1,
        customer: {
          full_name: a[o % a.length],
          phone: '090' + Math.floor(1e6 * Math.random()),
          email: `customer${o}@example.com`,
        },
        items: [
          {
            name: r[o % r.length],
            quantity: 1 + Math.floor(3 * Math.random()),
            price: 45e3 + Math.floor(3e4 * Math.random()),
          },
        ],
        total: 85e3 + Math.floor(2e5 * Math.random()),
        payment_status: n[Math.floor(Math.random() * n.length)],
        order_status: e[Math.floor(Math.random() * e.length)],
        created_at: new Date(
          Date.now() - Math.floor(864e5 * Math.random()),
        ).toISOString(),
      }));
    },
    getMockOrderDetail(t) {
      const e = ['Nguyễn Thành', 'Trần Phương', 'Lê Văn', 'Phạm Huyền'];
      return Promise.resolve({
        id: t,
        customer: {
          full_name: e[t % e.length],
          phone: '090' + Math.floor(1e6 * Math.random()),
          email: `customer${t}@example.com`,
        },
        items: [
          { name: 'Cà phê sữa đá', quantity: 2, price: 45e3 },
          { name: 'Bánh mì ốp la', quantity: 1, price: 55e3 },
        ],
        total: 145e3,
        payment_status: 'paid',
        payment_method: 'Tiền mặt',
        order_status: 'pending',
        created_at: new Date().toISOString(),
      });
    },
    getMockTopProducts: (t = 10) =>
      [
        { name: 'Cà phê sữa đá', quantity: 245 },
        { name: 'Trà sữa trân châu', quantity: 198 },
        { name: 'Bánh mì ốp la', quantity: 167 },
        { name: 'Cà phê đen', quantity: 142 },
        { name: 'Nước ép cam', quantity: 128 },
        { name: 'Latte', quantity: 95 },
        { name: 'Americano', quantity: 87 },
        { name: 'Sandwich', quantity: 76 },
      ].slice(0, t),
  };
function initThemeToggle() {
  const t = document.getElementById('themeToggle'),
    e = t?.querySelector('.theme-icon') || t;
  if (!t) {return;}
  const n = localStorage.getItem('theme') || 'dark';
  (document.documentElement.setAttribute('data-theme', n),
  e && (e.textContent = 'dark' === n ? '🌙' : '☀️'),
  t.addEventListener('click', () => {
    const t =
        'light' === document.documentElement.getAttribute('data-theme')
          ? 'dark'
          : 'light';
    (document.documentElement.setAttribute('data-theme', t),
    localStorage.setItem('theme', t),
    e && (e.textContent = 'dark' === t ? '🌙' : '☀️'));
  }));
}
function initializeDashboard() {
  (loadDashboardData(),
  initializeSearch(),
  initializeFilters(),
  initializeExport(),
  initializeRealTimeRefresh());
  const t = document.getElementById('menuToggle'),
    e = document.getElementById('sidebar');
  (t &&
    t.addEventListener('click', () => {
      e.classList.toggle('open');
    }),
  document.addEventListener('click', (n) => {
    window.innerWidth <= 1024 &&
        (e.contains(n.target) ||
          t.contains(n.target) ||
          e.classList.remove('open'));
  }));
  const n = document.querySelectorAll('.nav-item');
  n.forEach((t) => {
    t.addEventListener('click', function (t) {
      if (
        this.getAttribute('href') &&
        this.getAttribute('href').startsWith('#')
      ) {
        t.preventDefault();
      }
      // Update nav active state
      n.forEach((t) => t.classList.remove('active'));
      this.classList.add('active');

      const targetHash = this.getAttribute('href');
      const pageTitle = document.querySelector('.page-title');
      const e = this.querySelector('.nav-label');
      if (e && pageTitle) {
        pageTitle.textContent = e.textContent;
      }

      // SPA View Switcher
      const views = document.querySelectorAll('.tab-view');
      views.forEach((v) => v.classList.remove('active'));
      const targetView = document.querySelector(
        targetHash.replace('#', '#view-'),
      );
      if (targetView) {targetView.classList.add('active');}
      else {
        const soonView = document.querySelector('#view-coming-soon');
        if (soonView) {soonView.classList.add('active');}
      }
    });
  });
  const a = document.querySelectorAll('.stat-card');
  a.forEach((t) => {
    (t.addEventListener('mouseenter', function () {
      a.forEach((e) => {
        e !== t && (e.style.opacity = '0.7');
      });
    }),
    t.addEventListener('mouseleave', function () {
      a.forEach((t) => {
        t.style.opacity = '1';
      });
    }));
  });
}
function initializeSearch() {
  const t = document.querySelector('.search-box input');
  if (!t) {return;}
  let e = null;
  (t.addEventListener('input', function (t) {
    const n = t.target.value.toLowerCase();
    (clearTimeout(e),
    (e = setTimeout(() => {
      ((DashboardState.searchQuery = n), filterOrders());
    }, 300)));
  }),
  document.addEventListener('keydown', (e) => {
    (e.metaKey || e.ctrlKey) &&
        'k' === e.key &&
        (e.preventDefault(), t.focus());
  }));
}
function initializeFilters() {
  const t = document.querySelectorAll('[data-filter]');
  t.forEach((e) => {
    e.addEventListener('click', function () {
      (t.forEach((t) => t.classList.remove('active')),
      this.classList.add('active'),
      (DashboardState.currentFilter = this.dataset.filter),
      loadOrders());
    });
  });
  const e = document.querySelectorAll('[data-date-range]');
  e.forEach((t) => {
    t.addEventListener('click', function () {
      (e.forEach((t) => t.classList.remove('active')),
      this.classList.add('active'));
      const t = calculateDateRange(this.dataset.dateRange);
      ((DashboardState.dateRange = t), loadDashboardData());
    });
  });
}
function initializeExport() {
  const t = document.querySelector('[data-export]');
  t &&
    t.addEventListener('click', function () {
      exportData(this.dataset.export);
    });
}
function initializeRealTimeRefresh() {
  setInterval(() => {
    refreshData();
  }, 6e4);
}
function calculateDateRange(t) {
  const e = new Date(),
    n = new Date(e),
    a = new Date(e);
  switch (t) {
  case 'today':
    break;
  case 'yesterday':
    (n.setDate(e.getDate() - 1), a.setDate(e.getDate() - 1));
    break;
  case '7d':
    n.setDate(e.getDate() - 6);
    break;
  case '30d':
    n.setDate(e.getDate() - 29);
    break;
  case 'month':
    n.setDate(1);
  }
  return { start: n, end: a };
}
async function loadDashboardData() {
  const t = document.querySelector('.stats-grid');
  t && Skeleton.show(t, 'card', 4);
  const e = await DashboardAPI.fetchStats();
  if (e) {
    DashboardState.stats = e;
    const mappedStats = {
      revenue: { total: e.revenue_today || 0 },
      total_orders: e.orders_today || 0,
      total_customers: 0,
      average_order_value: e.orders_today
        ? e.revenue_today / e.orders_today
        : 0,
    };
    renderStats(mappedStats);
    if (e.revenue_7days && e.revenue_7days.length > 0) {
      renderRevenueChart(e.revenue_7days.reverse());
    }
    if (e.top_products && e.top_products.length > 0) {
      renderTopProducts(e.top_products);
    }
  } else if (IS_LOCAL) {
    // Mock fallback renderer
    const ms = DashboardAPI.getMockStats();
    renderStats(ms);
    renderRevenueChart(DashboardAPI.getMockRevenue(7));
    renderTopProducts(DashboardAPI.getMockTopProducts(5));
  }
  await loadOrders();
  t && Skeleton.hide(t);
}
async function loadOrders() {
  const tables = document.querySelectorAll('.orders-table tbody');
  if (tables.length > 0) {
    tables.forEach((t) => Skeleton.show(t.parentElement, 'table', 5));
    try {
      const e = await DashboardAPI.fetchOrders(
        'all' === DashboardState.currentFilter
          ? null
          : DashboardState.currentFilter,
        20,
        DashboardState.currentPage,
      );
      ((DashboardState.orders = e),
      0 === e.length
        ? tables.forEach(
          (t) =>
            (t.innerHTML =
                  '\n                <tr>\n                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-dim);">\n                        Không có đơn hàng nào\n                    </td>\n                </tr>\n            '),
        )
        : renderOrdersTable(e),
      updatePagination());
    } catch (t) {
      Toast.error('Không thể tải danh sách đơn hàng');
    }
    tables.forEach((t) => Skeleton.hide(t.parentElement));
  }
}
function filterOrders() {
  const t = DashboardState.searchQuery.toLowerCase();
  renderOrdersTable(
    DashboardState.orders.filter((e) => {
      const n = e.customer?.full_name?.toLowerCase() || '',
        a = e.id?.toString() || '',
        r = e.items?.map((t) => t.name?.toLowerCase()).join(' ') || '';
      return n.includes(t) || a.includes(t) || r.includes(t);
    }),
  );
}
function updatePagination() {
  const t = document.querySelector('.pagination-container');
  if (!t) {return;}
  t.innerHTML = '';
  const e = Pagination.create({
    currentPage: DashboardState.currentPage,
    totalPages: DashboardState.totalPages,
    onPageChange: (t) => {
      ((DashboardState.currentPage = t), loadOrders());
    },
  });
  t.appendChild(e);
}
function exportData(t) {
  const { orders: e } = DashboardState;
  if (0 !== e.length)
  {switch (t) {
  case 'csv':
    (exportToCSV(e), Toast.success('Đã xuất file CSV'));
    break;
  case 'pdf':
    Toast.info('Tính năng xuất PDF đang phát triển');
    break;
  case 'xlsx':
    Toast.info('Tính năng xuất Excel đang phát triển');
  }}
  else {Toast.warning('Không có dữ liệu để xuất');}
}
function exportToCSV(t) {
  const e = t.map((t) => [
      `#${t.id}`,
      t.customer?.full_name || 'N/A',
      t.items?.map((t) => t.name).join(', ') || 'N/A',
      t.total?.toString() || '0',
      translatePaymentStatus(t.payment_status),
      translateOrderStatus(t.order_status),
      new Date(t.created_at).toLocaleString('vi-VN'),
    ]),
    n = [
      [
        'Mã đơn',
        'Khách hàng',
        'Sản phẩm',
        'Tổng tiền',
        'Trạng thái thanh toán',
        'Trạng thái đơn',
        'Thời gian',
      ].join(','),
      ...e.map((t) => t.map((t) => `"${t}"`).join(',')),
    ].join('\n'),
    a = new Blob([n], { type: 'text/csv;charset=utf-8;' }),
    r = document.createElement('a');
  ((r.href = URL.createObjectURL(a)),
  (r.download = `don-hang-${new Date().toISOString().split('T')[0]}.csv`),
  r.click());
}
function refreshData() {
  (document.querySelectorAll('.stat-value').forEach((t) => {
    ((t.style.transition = 'opacity 0.3s'),
    (t.style.opacity = '0.5'),
    setTimeout(() => {
      t.style.opacity = '1';
    }, 300));
  }),
  loadDashboardData(),
  Toast.info('Dữ liệu đã được làm mới', 2e3));
}
async function showOrderDetail(t) {
  try {
    const e = await DashboardAPI.fetchOrderDetail(t);
    if (!e) {return void Toast.error('Không thể tải chi tiết đơn hàng');}
    const n = `\n            <div class="order-detail-grid">\n                <div class="order-detail-section">\n                    <h4>Thông tin đơn hàng</h4>\n                    <div class="order-info-row">\n                        <span class="order-info-label">Mã đơn</span>\n                        <span class="order-info-value">#${e.id}</span>\n                    </div>\n                    <div class="order-info-row">\n                        <span class="order-info-label">Ngày đặt</span>\n                        <span class="order-info-value">${formatDate(new Date(e.created_at))}</span>\n                    </div>\n                    <div class="order-info-row">\n                        <span class="order-info-label">Tổng tiền</span>\n                        <span class="order-info-value">${formatCurrency(e.total)}</span>\n                    </div>\n                    <div class="order-info-row">\n                        <span class="order-info-label">Phương thức thanh toán</span>\n                        <span class="order-info-value">${e.payment_method || 'Tiền mặt'}</span>\n                    </div>\n                </div>\n\n                <div class="order-detail-section">\n                    <h4>Thông tin khách hàng</h4>\n                    <div class="order-info-row">\n                        <span class="order-info-label">Tên khách</span>\n                        <span class="order-info-value">${e.customer?.full_name || 'N/A'}</span>\n                    </div>\n                    <div class="order-info-row">\n                        <span class="order-info-label">Số điện thoại</span>\n                        <span class="order-info-value">${e.customer?.phone || 'N/A'}</span>\n                    </div>\n                    <div class="order-info-row">\n                        <span class="order-info-label">Email</span>\n                        <span class="order-info-value">${e.customer?.email || 'N/A'}</span>\n                    </div>\n                </div>\n            </div>\n\n            <div class="order-detail-section">\n                <h4>Sản phẩm</h4>\n                <div class="order-items-list">\n                    ${e.items?.map((t) => `\n                        <div class="order-item-row">\n                            <div class="order-item-qty">x${t.quantity}</div>\n                            <span class="order-item-name">${t.name}</span>\n                            <span class="order-item-price">${formatCurrency(t.price * t.quantity)}</span>\n                        </div>\n                    `).join('') || '<p style="color: var(--text-dim);">Không có sản phẩm</p>'}\n                </div>\n            </div>\n\n            <div class="status-actions">\n                ${'pending' === e.order_status ? `\n                    <button class="btn btn-primary" onclick="handleOrderAction(${e.id}, 'confirm')">Xác nhận</button>\n                    <button class="btn btn-danger" onclick="handleOrderAction(${e.id}, 'cancel')">Hủy đơn</button>\n                ` : ''}\n                ${'confirmed' === e.order_status ? `\n                    <button class="btn btn-primary" onclick="handleOrderAction(${e.id}, 'prepare')">Chuẩn bị</button>\n                ` : ''}\n                ${'preparing' === e.order_status ? `\n                    <button class="btn btn-primary" onclick="handleOrderAction(${e.id}, 'ready')">Sẵn sàng</button>\n                ` : ''}\n                ${'ready' === e.order_status ? `\n                    <button class="btn btn-primary" onclick="handleOrderAction(${e.id}, 'deliver')">Giao hàng</button>\n                ` : ''}\n            </div>\n        `;
    Modal.show({
      title: `Chi tiết đơn hàng #${e.id}`,
      content: n,
      size: 'large',
      actions: [
        {
          id: 'close',
          label: 'Đóng',
          variant: 'secondary',
          onClick: () => {},
          close: !1,
        },
      ],
    });
  } catch (t) {
    Toast.error('Không thể tải chi tiết đơn hàng');
  }
}
async function handleOrderAction(t, e) {
  const n = {
    view: () => showOrderDetail(t),
    confirm: { label: 'Xác nhận', apiAction: 'confirm' },
    cancel: { label: 'Hủy', apiAction: 'cancel', confirm: !0 },
    prepare: { label: 'Chuẩn bị', apiAction: 'prepare' },
    ready: { label: 'Sẵn sàng', apiAction: 'ready' },
    deliver: { label: 'Giao hàng', apiAction: 'deliver' },
  }[e];
  if (n) {
    if (n.confirm) {
      if (
        !(await Confirm.show({
          title: 'Xác nhận hủy đơn',
          message:
            'Bạn có chắc chắn muốn hủy đơn hàng này? Hành động này không thể hoàn tác.',
          confirmLabel: 'Hủy đơn',
          cancelLabel: 'Quay lại',
          type: 'danger',
        }))
      )
      {return;}
    }
    try {
      (await DashboardAPI.updateOrderStatus(t, n.apiAction))
        ? (Toast.success(`Đã ${n.label.toLowerCase()} đơn hàng #${t}`),
        loadOrders(),
        loadDashboardData())
        : Toast.error('Có lỗi xảy ra khi cập nhật đơn hàng');
    } catch (t) {
      Toast.error('Có lỗi xảy ra khi cập nhật đơn hàng');
    }
  }
}
function formatCurrency(t) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(t);
}
function formatDate(t) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(t);
}
function debounce(t, e) {
  let n;
  return function (...a) {
    (clearTimeout(n),
    (n = setTimeout(() => {
      (clearTimeout(n), t(...a));
    }, e)));
  };
}
function renderStats(t) {
  const e = document.querySelector('[data-stat="revenue"]');
  e && (e.textContent = formatCurrency(t.revenue.total));
  const n = document.querySelector('[data-stat="orders"]');
  n && (n.textContent = t.total_orders);
  const a = document.querySelector('[data-stat="customers"]');
  a && (a.textContent = t.total_customers);
  const r = document.querySelector('[data-stat="avg_order"]');
  r && (r.textContent = formatCurrency(t.average_order_value));
}
function renderRevenueChart(t) {
  const e = document.querySelector('.revenue-chart');
  if (!e) {return;}
  const n = Math.max(...t.map((t) => t.revenue));
  e.innerHTML = t
    .map((t, e) => {
      const a =
        ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][new Date(t.date).getDay()] ||
        t.date.slice(5);
      return `\n        <div class="bar-group" style="--chart-delay: ${100 * e}ms">\n            <div class="bar" style="height: ${(t.revenue / n) * 100}%">\n                <span class="bar-value">${(t.revenue / 1e6).toFixed(1)}tr</span>\n            </div>\n            <span class="bar-label">${a}</span>\n        </div>\n    `;
    })
    .join('');
}
function renderOrdersTable(t) {
  const tables = document.querySelectorAll('.orders-table tbody');
  tables.forEach((e) => {
    e.innerHTML = t
      .map(
        (t) =>
          `\n        <tr data-order-id="${t.id}">\n            <td class="order-id">#${t.id}</td>\n            <td>\n                <div class="customer-cell">\n                    <div class="customer-avatar">${getInitials(t.customer.full_name)}</div>\n                    <span>${t.customer.full_name}</span>\n                </div>\n            </td>\n            <td>${t.items.map((t) => t.name).join(', ')}</td>\n            <td class="amount">${formatCurrency(t.total)}</td>\n            <td>\n                <span class="status-badge ${t.payment_status}">\n                    ${translatePaymentStatus(t.payment_status)}\n                </span>\n            </td>\n            <td>\n                <span class="status-badge ${t.order_status}">\n                    ${translateOrderStatus(t.order_status)}\n                </span>\n            </td>\n            <td>${formatDate(new Date(t.created_at))}</td>\n        </tr>\n    `,
      )
      .join('');
  });
}
function getInitials(t) {
  return t
    .split(' ')
    .map((t) => t[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
function renderTopProducts(t) {
  const e = document.querySelector('.top-products');
  e &&
    (e.innerHTML = t
      .map(
        (e, n) =>
          `\n        <div class="product-item">\n            <div class="product-rank">${n + 1}</div>\n            <div class="product-info">\n                <span class="product-name">${e.name}</span>\n                <span class="product-category">Đồ uống</span>\n            </div>\n            <span class="product-sales">${e.quantity} đơn</span>\n            <div class="product-bar" style="width: ${(e.quantity / t[0].quantity) * 100}%"></div>\n        </div>\n    `,
      )
      .join(''));
}
function translatePaymentStatus(t) {
  return (
    { pending: 'Chưa thanh toán', paid: 'Đã thanh toán', failed: 'Thất bại' }[
      t
    ] || t
  );
}
function translateOrderStatus(t) {
  return (
    {
      pending: 'Chờ xử lý',
      confirmed: 'Đã xác nhận',
      preparing: 'Đang chuẩn bị',
      ready: 'Sẵn sàng',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy',
    }[t] || t
  );
}
function handleOrderActionLegacy(t, e) {}
(document.addEventListener('DOMContentLoaded', function () {
  // Auth guard — redirect to login if no token (skip on localhost for dev)
  if (!IS_LOCAL && !localStorage.getItem('admin_token')) {
    window.location.replace('login.html');
    return;
  }
  (initializeDashboard(), initThemeToggle());
}),
(window.DashboardUtils = {
  formatCurrency: formatCurrency,
  formatDate: formatDate,
  debounce: debounce,
}),
(window.showOrderDetail = showOrderDetail),
(window.handleOrderAction = handleOrderAction),
(window.DashboardState = DashboardState));
