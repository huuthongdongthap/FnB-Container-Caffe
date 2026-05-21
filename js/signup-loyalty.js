const _IS_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE = _IS_LOCAL
  ? 'http://127.0.0.1:8787/api/loyalty'
  : 'https://aura-space-worker.sadec-marketing-hub.workers.dev/api/loyalty';
const PHONE_RE = /^(0|\+84)[0-9]{9,10}$/;

async function loadCampaign() {
  try {
    const res = await fetch(API_BASE + '/active-campaign');
    if (!res.ok) {return;}
    const { campaign } = await res.json();
    if (!campaign || !campaign.signup_bonus_vnd) {return;}

    document.getElementById('bonus-amount').textContent =
      campaign.signup_bonus_vnd.toLocaleString('vi-VN') + 'đ';

    if (campaign.signup_slots_left != null) {
      document.getElementById('banner-meta').textContent =
        'Còn ' + campaign.signup_slots_left + ' suất — Khai trương ' +
        new Date(campaign.start_date).toLocaleDateString('vi-VN');
    }

    document.getElementById('campaign-banner').style.display = 'block';
  } catch (e) {
    // Non-fatal — banner stays hidden
  }
}

function setError(field, hasError) {
  document.getElementById('g-' + field).classList.toggle('has-error', hasError);
}

function validatePhone(val) {
  const clean = val.replace(/\s/g, '');
  return PHONE_RE.test(clean) ? clean : null;
}

function validateName(val) {
  return val.trim().length >= 2 ? val.trim() : null;
}

async function handleSubmit(e) {
  e.preventDefault();

  const phoneRaw = document.getElementById('phone').value;
  const nameRaw = document.getElementById('name').value;
  const dob = document.getElementById('dob').value || null;
  const zalo = document.getElementById('zalo').value.replace(/\s/g, '') || null;

  const phone = validatePhone(phoneRaw);
  const name = validateName(nameRaw);

  setError('phone', !phone);
  setError('name', !name);
  if (!phone || !name) {return;}

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.classList.add('loading');
  btn.textContent = 'Đang đăng ký…';

  try {
    const res = await fetch(API_BASE + '/phone-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name, dob, zalo, source: 'signup_page' }),
    });

    const data = await res.json();
    if (!res.ok) {throw new Error(data.error || 'Lỗi đăng ký');}

    showSuccess(data, name);

  } catch (err) {
    alert('Có lỗi: ' + err.message + '. Vui lòng thử lại.');
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.textContent = 'Đăng ký & nhận quà khai trương';
  }
}

function showSuccess(data, name) {
  document.getElementById('signup-form').style.display = 'none';
  document.getElementById('campaign-banner').style.display = 'none';

  const firstName = name.split(' ').pop();
  document.getElementById('success-name').textContent = firstName;
  document.getElementById('member-id').textContent =
    data.customer?.member_id || ('AC' + String(data.customer?.id || '').slice(-6).toUpperCase());

  const bonus = data.bonus_granted || 0;
  document.getElementById('success-balance').textContent =
    bonus.toLocaleString('vi-VN') + 'đ';

  if (bonus > 0) {
    document.getElementById('success-bonus-note').textContent =
      '🎁 Bao gồm ' + bonus.toLocaleString('vi-VN') + 'đ quà khai trương';
  }

  document.getElementById('success-card').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (window.gtag) {
    window.gtag('event', 'signup_loyalty', {
      event_category: 'loyalty',
      value: bonus,
      is_new: data.is_new,
    });
  }
}

document.addEventListener('DOMContentLoaded', function () {
  loadCampaign();

  document.getElementById('signup-form').addEventListener('submit', handleSubmit);

  document.getElementById('phone').addEventListener('blur', function () {
    if (this.value) {setError('phone', !validatePhone(this.value));}
  });
  document.getElementById('name').addEventListener('blur', function () {
    if (this.value) {setError('name', !validateName(this.value));}
  });
});
