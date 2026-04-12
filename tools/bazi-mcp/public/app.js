/**
 * Bát Tự F&B — App Logic
 * Collects form data, calls Bazi MCP API, renders results
 */

const API_BASE = window.location.port === '5002'
  ? `${window.location.origin}`
  : 'http://127.0.0.1:5002';

// ── State ──────────────────────────────────────────
let partnerCount = 0;
let staffCount = 0;

// ── DOM Refs ───────────────────────────────────────
const form = document.getElementById('baziForm');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const exportArea = document.getElementById('exportArea');
const submitBtn = document.getElementById('submitBtn');

// ── Partner / Staff Builders ───────────────────────
function createPersonEntry(type, index) {
  const roles = type === 'partner'
    ? ['Đồng sáng lập', 'Nhà đầu tư', 'Cổ đông']
    : ['Quản lý', 'Barista', 'Bếp trưởng', 'Thu ngân', 'Phục vụ', 'Khác'];
  
  const labelPrefix = type === 'partner' ? 'Đối tác' : 'Nhân sự';

  const div = document.createElement('div');
  div.className = 'person-entry';
  div.dataset.type = type;
  div.dataset.index = index;
  div.innerHTML = `
    <div class="entry-header">
      <span class="entry-label">${labelPrefix} #${index + 1}</span>
      <button type="button" class="btn-remove" onclick="this.closest('.person-entry').remove()">✕ Xóa</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Họ và tên</label>
        <input type="text" name="${type}_name_${index}" placeholder="Nguyễn Văn B">
      </div>
      <div class="form-group">
        <label>Vai trò</label>
        <select name="${type}_role_${index}">
          ${roles.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Giới tính</label>
        <select name="${type}_gender_${index}">
          <option value="1">Nam</option>
          <option value="0">Nữ</option>
        </select>
      </div>
      <div class="form-group">
        <label>Ngày sinh dương lịch</label>
        <input type="date" name="${type}_birth_date_${index}">
      </div>
      <div class="form-group">
        <label>Giờ sinh</label>
        <input type="time" name="${type}_birth_time_${index}">
        <span class="hint">Không biết → để trống</span>
      </div>
    </div>
  `;
  return div;
}

document.getElementById('addPartnerBtn').addEventListener('click', () => {
  document.getElementById('partnersContainer').appendChild(
    createPersonEntry('partner', partnerCount++)
  );
});

document.getElementById('addStaffBtn').addEventListener('click', () => {
  document.getElementById('staffContainer').appendChild(
    createPersonEntry('staff', staffCount++)
  );
});

// ── Helpers ────────────────────────────────────────
function buildDatetime(dateStr, timeStr, tz = '+07:00') {
  if (!dateStr) return null;
  const time = timeStr || '12:00';
  return `${dateStr}T${time}:00${tz}`;
}

function collectPersons(type) {
  const entries = document.querySelectorAll(`.person-entry[data-type="${type}"]`);
  const persons = [];
  entries.forEach(el => {
    const idx = el.dataset.index;
    const name = el.querySelector(`[name="${type}_name_${idx}"]`)?.value?.trim();
    const role = el.querySelector(`[name="${type}_role_${idx}"]`)?.value;
    const gender = parseInt(el.querySelector(`[name="${type}_gender_${idx}"]`)?.value || '1');
    const birthDate = el.querySelector(`[name="${type}_birth_date_${idx}"]`)?.value;
    const birthTime = el.querySelector(`[name="${type}_birth_time_${idx}"]`)?.value;
    if (name && birthDate) {
      persons.push({ name, role, gender, birthDate, birthTime });
    }
  });
  return persons;
}

// Ngũ hành labels
const WU_XING = { '木': 'Mộc 🌳', '火': 'Hỏa 🔥', '土': 'Thổ ⛰️', '水': 'Thủy 💧', '金': 'Kim ⚔️' };
const SHENG_XIAO = { '鼠':'🐀','牛':'🐂','虎':'🐅','兔':'🐇','龙':'🐉','蛇':'🐍','马':'🐴','羊':'🐑','猴':'🐵','鸡':'🐔','狗':'🐕','猪':'🐷' };

// ── API Calls ──────────────────────────────────────
async function callBazi(solarDatetime, gender = 1) {
  const res = await fetch(`${API_BASE}/bazi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ solarDatetime, gender }),
  });
  if (!res.ok) throw new Error(`Bazi API error: ${res.status}`);
  return res.json();
}

async function callCalendar(solarDatetime) {
  const res = await fetch(`${API_BASE}/bazi/calendar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ solarDatetime }),
  });
  if (!res.ok) throw new Error(`Calendar API error: ${res.status}`);
  return res.json();
}

// ── Render Bazi Chart ──────────────────────────────
function renderBaziChart(data) {
  const d = data;
  const bazi = d['八字'] || '';
  const pillars = bazi.split(' ');
  const labels = ['Năm 年柱', 'Tháng 月柱', 'Ngày 日柱', 'Giờ 時柱'];
  const pillarKeys = ['年柱', '月柱', '日柱', '时柱'];

  let chartHtml = '<div class="bazi-chart">';
  pillars.forEach((p, i) => {
    const stem = p[0] || '';
    const branch = p[1] || '';
    const pillarData = d[pillarKeys[i]] || {};
    const stemData = pillarData['天干'] || {};
    const branchData = pillarData['地支'] || {};
    
    chartHtml += `
      <div class="pillar">
        <div class="pillar-label">${labels[i]}</div>
        <div class="pillar-stem">${stem}</div>
        <div class="pillar-branch">${branch}</div>
        <div class="pillar-element">${stemData['五行'] || ''} ${stemData['阴阳'] || ''}</div>
      </div>`;
  });
  chartHtml += '</div>';

  // Main info
  const zodiac = d['生肖'] || '';
  const zodiacEmoji = SHENG_XIAO[zodiac] || '';
  const dayMaster = d['日主'] || '';
  const dmElement = d['日柱']?.['天干']?.['五行'] || '';

  chartHtml += `
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Dương lịch</div>
        <div class="info-value">${d['阳历'] || ''}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Âm lịch</div>
        <div class="info-value">${d['农历'] || ''}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Nhật chủ 日主</div>
        <div class="info-value" style="font-size:1.2rem">${dayMaster} (${WU_XING[dmElement] || dmElement})</div>
      </div>
      <div class="info-item">
        <div class="info-label">Con giáp 生肖</div>
        <div class="info-value">${zodiacEmoji} ${zodiac}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Thai nguyên 胎元</div>
        <div class="info-value">${d['胎元'] || ''}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Mệnh cung 命宮</div>
        <div class="info-value">${d['命宫'] || ''}</div>
      </div>
    </div>`;

  return chartHtml;
}

// ── Render Calendar Table ──────────────────────────
function renderCalendarResults(calendarData) {
  let html = '<table class="calendar-table"><thead><tr>';
  html += '<th>Ngày</th><th>Can Chi</th><th>NÊN 宜</th><th>KỴ 忌</th><th>Hướng Tài Thần</th>';
  html += '</tr></thead><tbody>';
  
  calendarData.forEach(item => {
    const d = item.data;
    const good = (d['宜'] || '').split(',').slice(0, 4).join(', ');
    const bad = (d['忌'] || '').split(',').slice(0, 3).join(', ');
    
    html += `<tr>
      <td><strong>${d['公历'] || ''}</strong><br><small>${d['农历'] || ''}</small></td>
      <td>${d['干支'] || ''}</td>
      <td class="day-good">${good || '—'}</td>
      <td class="day-bad">${bad || '—'}</td>
      <td>${d['财神方位'] || ''}</td>
    </tr>`;
  });
  
  html += '</tbody></table>';
  return html;
}

// ── F&B Business Insights ──────────────────────────
function renderBusinessInsights(baziData) {
  const dayMasterElement = baziData['日柱']?.['天干']?.['五行'] || '';
  
  const elementColors = {
    '木': { colors: 'Xanh lá, xanh dương', avoid: 'Trắng, vàng kim', material: 'Gỗ, tre, mây', style: 'Tropical, Botanical, Eco-friendly' },
    '火': { colors: 'Đỏ, cam, hồng', avoid: 'Đen, xanh đậm', material: 'Nến, đèn warm, gạch đỏ', style: 'Industrial, Warm Rustic' },
    '土': { colors: 'Vàng đất, be, nâu', avoid: 'Xanh lá đậm', material: 'Gốm, đá, terrazzo', style: 'Minimalist Earth-tone, Wabi-sabi' },
    '金': { colors: 'Trắng, bạc, vàng nhạt', avoid: 'Đỏ, cam', material: 'Kim loại, inox, kính', style: 'Modern Luxury, Scandinavian' },
    '水': { colors: 'Đen, xanh navy, xám đậm', avoid: 'Vàng đất, nâu', material: 'Kính, gương, nước', style: 'Dark Mode Café, Noir, Lounge' },
  };

  const insight = elementColors[dayMasterElement] || {};

  // Đại vận analysis
  const dayun = baziData['大运']?.['大运'] || [];
  const currentYear = new Date().getFullYear();
  let currentDayun = null;
  for (const dy of dayun) {
    if (currentYear >= dy['开始年份'] && currentYear <= dy['结束']) {
      currentDayun = dy;
      break;
    }
  }

  let dayunAdvice = '';
  if (currentDayun) {
    const shenStr = currentDayun['天干十神'] || '';
    const adviceMap = {
      '食神': '💡 Giai đoạn sáng tạo — Thích hợp phát triển menu độc đáo, marketing viral',
      '伤官': '⚡ Năng lượng đổi mới mạnh — Dám làm khác biệt, nhưng cẩn thận đốt cháy giai đoạn',
      '正财': '💰 Giai đoạn tích lũy — Thời điểm vàng để mở quán, thu nhập ổn định',
      '偏财': '🎰 Cơ hội bất ngờ — Có thể gặp may trong đầu tư, nhưng cần kiểm soát rủi ro',
      '正官': '🏢 Ổn định và kỷ luật — Nên chú trọng quản lý, hệ thống hóa quy trình',
      '七杀': '⚔️ Áp lực cạnh tranh — Cần chiến lược mạnh, không nên thụ động',
      '正印': '📚 Giai đoạn học hỏi — Tốt cho franchise, mentorship, nhận hỗ trợ',
      '偏印': '🔮 Tư duy độc đáo — Concept quán lạ có thể thành công, nhưng cần thực tế',
      '比肩': '🤝 Hợp tác — Nên tìm đối tác, mở rộng nhóm, tránh làm một mình',
      '劫财': '⚠️ Cạnh tranh nội bộ — Cẩn thận trong chọn đối tác, giữ tài chính chặt',
    };
    dayunAdvice = adviceMap[shenStr] || `Đại vận ${currentDayun['干支']} — ${shenStr}`;
  }

  return `
    <div class="info-grid" style="margin-bottom:20px">
      <div class="info-item" style="grid-column:1/-1;border-left:3px solid var(--accent-gold);padding-left:20px">
        <div class="info-label">🎯 Đại vận hiện tại (${currentDayun?.['干支'] || '?'}, ${currentDayun?.['开始年份'] || ''}—${currentDayun?.['结束'] || ''})</div>
        <div class="info-value" style="font-size:1rem;line-height:1.6">${dayunAdvice}</div>
      </div>
    </div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">🎨 Màu sắc NÊN dùng</div>
        <div class="info-value">${insight.colors || '—'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">🚫 Màu NÊN TRÁNH</div>
        <div class="info-value" style="color:var(--accent-red)">${insight.avoid || '—'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">🪵 Chất liệu phù hợp</div>
        <div class="info-value">${insight.material || '—'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">✨ Phong cách thiết kế</div>
        <div class="info-value">${insight.style || '—'}</div>
      </div>
    </div>`;
}

// ── Main Submit Handler ────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Collect form data
  const fd = new FormData(form);
  const ownerDatetime = buildDatetime(
    fd.get('ownerBirthDate'),
    fd.get('ownerBirthTime'),
    fd.get('ownerBirthTimezone')
  );
  const ownerGender = parseInt(fd.get('ownerGender'));
  const ownerName = fd.get('ownerName');
  const businessType = fd.get('businessType');
  const businessName = fd.get('businessName');
  const openFrom = fd.get('openDateFrom');
  const openTo = fd.get('openDateTo');
  const contractDate = fd.get('contractDate');
  const renovationDate = fd.get('renovationDate');
  const notes = fd.get('notes');

  const partners = collectPersons('partner');
  const staff = collectPersons('staff');

  // UI
  form.classList.add('hidden');
  loading.classList.remove('hidden');
  results.classList.add('hidden');
  exportArea.classList.add('hidden');

  try {
    let resultsHtml = '';

    // ── 1. Owner Bazi ──────────────────────────────
    const ownerBazi = await callBazi(ownerDatetime, ownerGender);
    const ownerData = ownerBazi.data;

    resultsHtml += `
      <div class="result-card" style="animation-delay:0s">
        <h3><span class="card-emoji">👤</span> Bát Tự Chủ Quán — ${ownerName}</h3>
        ${renderBaziChart(ownerData)}
      </div>`;

    // ── 2. F&B Insights ────────────────────────────
    resultsHtml += `
      <div class="result-card" style="animation-delay:0.1s">
        <h3><span class="card-emoji">☕</span> Phân Tích F&B — Khuyến Nghị Kinh Doanh</h3>
        ${renderBusinessInsights(ownerData)}
      </div>`;

    // ── 3. Opening Date Calendar ───────────────────
    if (openFrom && openTo) {
      const dates = [];
      const from = new Date(openFrom);
      const to = new Date(openTo);
      const maxDays = Math.min(Math.ceil((to - from) / 86400000) + 1, 30);
      
      for (let i = 0; i < maxDays; i++) {
        const d = new Date(from);
        d.setDate(d.getDate() + i);
        const dt = d.toISOString().slice(0, 10) + 'T09:00:00+07:00';
        try {
          const cal = await callCalendar(dt);
          dates.push(cal);
        } catch (err) {
          console.warn(`Calendar error for ${dt}:`, err);
        }
      }

      if (dates.length > 0) {
        resultsHtml += `
          <div class="result-card" style="animation-delay:0.2s">
            <h3><span class="card-emoji">📅</span> Hoàng Lịch — Chọn Ngày Khai Trương</h3>
            <p style="color:var(--text-muted);margin-bottom:16px;font-size:0.85rem">
              Từ ${openFrom} đến ${openTo} — Tìm ngày có 開業/開市/嫁娶 trong mục NÊN
            </p>
            ${renderCalendarResults(dates)}
          </div>`;
      }
    }

    // ── 4. Special Dates ───────────────────────────
    const specialDates = [];
    if (contractDate) specialDates.push({ label: '📝 Ký hợp đồng thuê', date: contractDate });
    if (renovationDate) specialDates.push({ label: '🔨 Bắt đầu sửa chữa', date: renovationDate });

    if (specialDates.length > 0) {
      let specialHtml = '<div class="info-grid">';
      for (const sd of specialDates) {
        try {
          const cal = await callCalendar(sd.date + 'T09:00:00+07:00');
          const d = cal.data;
          specialHtml += `
            <div class="info-item" style="grid-column:1/-1">
              <div class="info-label">${sd.label} — ${d['公历'] || sd.date}</div>
              <div class="info-value">
                ${d['干支'] || ''} · ${d['农历'] || ''}<br>
                <span class="day-good">NÊN: ${d['宜'] || '—'}</span><br>
                <span class="day-bad">KỴ: ${d['忌'] || '—'}</span><br>
                <span style="color:var(--accent-gold)">Hướng Tài Thần: ${d['财神方位'] || '—'}</span>
              </div>
            </div>`;
        } catch (err) {
          console.warn(`Calendar error for ${sd.date}:`, err);
        }
      }
      specialHtml += '</div>';

      resultsHtml += `
        <div class="result-card" style="animation-delay:0.3s">
          <h3><span class="card-emoji">📋</span> Phân Tích Ngày Đặc Biệt</h3>
          ${specialHtml}
        </div>`;
    }

    // ── 5. Partners & Staff ────────────────────────
    const allPersons = [
      ...partners.map(p => ({ ...p, type: 'Đối tác' })),
      ...staff.map(p => ({ ...p, type: 'Nhân sự' })),
    ];

    if (allPersons.length > 0) {
      let personHtml = '';
      for (const person of allPersons) {
        const dt = buildDatetime(person.birthDate, person.birthTime || '12:00');
        try {
          const pBazi = await callBazi(dt, person.gender);
          const pd = pBazi.data;
          const pElement = pd['日柱']?.['天干']?.['五行'] || '';
          const ownerElement = ownerData['日柱']?.['天干']?.['五行'] || '';
          
          // Simple wu xing compatibility
          const SHENG = { '木':'火', '火':'土', '土':'金', '金':'水', '水':'木' };
          const KE = { '木':'土', '土':'水', '水':'火', '火':'金', '金':'木' };
          
          let compat = 'medium';
          let compatText = '普通 — Bình thường';
          let compatPct = 50;
          
          if (SHENG[ownerElement] === pElement || SHENG[pElement] === ownerElement) {
            compat = 'high';
            compatText = '相生 — Tương sinh, hỗ trợ tốt!';
            compatPct = 85;
          } else if (ownerElement === pElement) {
            compat = 'high';
            compatText = '同五行 — Cùng ngũ hành, đồng lòng';
            compatPct = 75;
          } else if (KE[ownerElement] === pElement || KE[pElement] === ownerElement) {
            compat = 'low';
            compatText = '相克 — Tương khắc, cần lưu ý';
            compatPct = 30;
          }

          personHtml += `
            <div class="info-item" style="grid-column:1/-1">
              <div class="info-label">${person.type} · ${person.role}</div>
              <div class="info-value">
                ${person.name} — ${pd['八字'] || ''}<br>
                <small>Nhật chủ: ${pd['日主']} (${WU_XING[pElement] || pElement}) · 
                Con giáp: ${SHENG_XIAO[pd['生肖']] || ''} ${pd['生肖'] || ''}</small>
              </div>
              <div style="margin-top:8px;font-size:0.85rem;color:var(--text-secondary)">
                Tương hợp với chủ: <strong>${compatText}</strong>
              </div>
              <div class="compat-meter">
                <div class="compat-fill compat-${compat}" style="width:${compatPct}%"></div>
              </div>
            </div>`;
        } catch (err) {
          personHtml += `<div class="info-item"><div class="info-value">⚠️ Lỗi phân tích ${person.name}: ${err.message}</div></div>`;
        }
      }

      resultsHtml += `
        <div class="result-card" style="animation-delay:0.4s">
          <h3><span class="card-emoji">🤝</span> Tương Hợp Đối Tác & Nhân Sự</h3>
          <div class="info-grid">${personHtml}</div>
        </div>`;
    }

    // ── Render ──────────────────────────────────────
    results.innerHTML = resultsHtml;
    results.classList.remove('hidden');
    exportArea.classList.remove('hidden');
    loading.classList.add('hidden');

    // Scroll to results
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Store for export
    window.__baziResults = {
      owner: { name: ownerName, gender: ownerGender, datetime: ownerDatetime, bazi: ownerData },
      business: { type: businessType, name: businessName, openFrom, openTo, contractDate, renovationDate },
      partners, staff, notes,
    };

  } catch (err) {
    loading.classList.add('hidden');
    form.classList.remove('hidden');
    alert(`Lỗi: ${err.message}\n\nHãy chắc chắn Bazi MCP server đang chạy trên ${API_BASE}`);
    console.error(err);
  }
});

// ── Show form again on clicking results header ─────
results.addEventListener('click', (e) => {
  if (e.target.closest('.btn-back-to-form')) {
    form.classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth' });
  }
});

// ── Export ──────────────────────────────────────────
document.getElementById('exportJsonBtn').addEventListener('click', () => {
  if (window.__baziResults) {
    navigator.clipboard.writeText(JSON.stringify(window.__baziResults, null, 2))
      .then(() => {
        const btn = document.getElementById('exportJsonBtn');
        btn.textContent = '✅ Đã copy!';
        setTimeout(() => btn.textContent = '📋 Copy JSON', 2000);
      });
  }
});

document.getElementById('exportPrintBtn').addEventListener('click', () => {
  window.print();
});
