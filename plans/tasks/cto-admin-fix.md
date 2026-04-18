# CTO Task: Admin Panel — Dashboard Live Data + Deploy

## Context
Files đã được sửa bởi Antigravity:
- `admin/orders.html` — API endpoint đã fix từ `/api/orders` → `/api/kds/orders`
- `js/kds-poll.js` — URL đã fix từ `/api/orders/latest` → `/api/kds/orders/latest`
- `admin/reservations.html` — NEW: trang quản lý đặt bàn, gọi `GET /api/reservations`
- `admin/dashboard.html` — Sidebar đã convert từ `<button>` sang `<a href>` links

## Remaining Tasks

### Task 1: Dashboard — Thêm Live API Data
File: `admin/dashboard.html`

Thêm đoạn JS sau vào CUỐI block `<script>`, ngay trước `})();` closing:

```javascript
// ── LIVE API DATA ──
var API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://127.0.0.1:8787/api' : 'https://aura-space-worker.sadec-marketing-hub.workers.dev/api';

var STATUS_BADGE = {
  'Bep tiep nhan':'badge-cook','Dang pha che':'badge-cook',
  'San sang':'badge-wait','Hoan thanh':'badge-done','Da huy':'badge-cancel',
  'pending':'badge-wait','confirmed':'badge-cook','preparing':'badge-cook',
  'ready':'badge-wait','completed':'badge-done','cancelled':'badge-cancel'
};
var STATUS_LABEL_MAP = {
  'Bep tiep nhan':'🍳 Bếp','Dang pha che':'⏳ Pha chế','San sang':'✓ Sẵn sàng',
  'Hoan thanh':'✓ Xong','Da huy':'✕ Huỷ',
  'pending':'⏳ Chờ','confirmed':'✓ Xác nhận','preparing':'🍳 Bếp',
  'ready':'✓ Sẵn sàng','completed':'✓ Xong','cancelled':'✕ Huỷ'
};

function fmtVND(n){return new Intl.NumberFormat('vi-VN').format(n||0)+'₫'}
function fmtTime(s){if(!s)return '—';var d=new Date(s);return d.getHours()+':'+String(d.getMinutes()).padStart(2,'0')}

async function loadLiveData(){
  try{
    var res = await fetch(API_BASE+'/kds/orders?limit=20');
    var json = await res.json();
    if(!json.success||!json.data) return;
    var orders = json.data;
    var today = new Date().toISOString().slice(0,10);
    var todayOrders = orders.filter(function(o){return o.created_at&&o.created_at.slice(0,10)===today});
    var revenue = todayOrders.reduce(function(s,o){return s+(parseInt(o.total_amount||o.total)||0)},0);
    var activeOrders = todayOrders.filter(function(o){return o.status!=='Hoan thanh'&&o.status!=='Da huy'&&o.status!=='completed'&&o.status!=='cancelled'});
    var kpis = document.querySelectorAll('.kpi-value');
    if(kpis[0]) kpis[0].innerHTML = fmtVND(revenue).replace('₫','<span class="unit">₫</span>');
    if(kpis[1]) kpis[1].textContent = activeOrders.length;
    if(kpis[3]) kpis[3].textContent = todayOrders.length;
    var tbody = document.getElementById('recentOrders');
    if(tbody&&orders.length>0){
      tbody.innerHTML = orders.slice(0,8).map(function(o){
        var badge = STATUS_BADGE[o.status]||'badge-wait';
        var label = STATUS_LABEL_MAP[o.status]||o.status;
        var total = parseInt(o.total_amount||o.total)||0;
        return '<tr><td class="code">#'+((o.id||'').slice(-6))+'</td><td>'+(o.customer_name||'Khách lẻ')+'</td><td class="price">'+fmtVND(total)+'</td><td><span class="badge '+badge+'">'+label+'</span></td><td>'+fmtTime(o.created_at)+'</td></tr>';
      }).join('');
    }
  }catch(e){console.warn('[Dashboard] API error:',e)}
}
loadLiveData();
setInterval(loadLiveData, 15000);
```

### Task 2: Deploy to Cloudflare Pages
```bash
cd ~/mekong-cli/FnB-Container-Caffe
rm -rf /tmp/fnb-deploy && mkdir -p /tmp/fnb-deploy
rsync -av --exclude='.git' --exclude='node_modules' --exclude='.claude' --exclude='export.pdf' --exclude='.wrangler' --exclude='_archive' . /tmp/fnb-deploy/
npx wrangler pages deploy /tmp/fnb-deploy/ --project-name=fnb-caffe-container --branch=main --commit-dirty=true
```

### Task 3: Verify
After deploy, open the admin URLs and verify:
1. `https://fnb-caffe-container.pages.dev/admin/dashboard.html` — KPI loads live data
2. `https://fnb-caffe-container.pages.dev/admin/orders.html` — Orders table loads without JSON error
3. `https://fnb-caffe-container.pages.dev/admin/reservations.html` — Reservations page renders

## Done When
- Dashboard shows live KPI data from API
- Orders page shows real orders without errors
- Reservations page loads reservation list
- All pages have working sidebar navigation
- Deployed to production
