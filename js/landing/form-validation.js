/**
 * AURA SPACE — Contact Form Validation Module
 */

function isValidVietnamesePhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return /^(\+?84|0)[3579]\d{8}$/.test(cleaned);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(field, message) {
  const group = field.closest('.form-group');
  if (group) {
    const existingError = group.querySelector('.field-error');
    if (existingError) {existingError.remove();}

    const errorEl = document.createElement('span');
    errorEl.className = 'field-error';
    errorEl.textContent = message;
    errorEl.style.cssText = `
      display: block;
      margin-top: 6px;
      font-size: 0.75rem;
      color: #ef4444;
      animation: slideInDown 0.3s ease;
    `;
    group.appendChild(errorEl);
  }
}

function removeFieldError(field) {
  const group = field.closest('.form-group');
  if (group) {
    const existingError = group.querySelector('.field-error');
    if (existingError) {existingError.remove();}
  }
}

function clearFormErrors() {
  document.querySelectorAll('.form-group.error').forEach(group => {
    group.classList.remove('error');
  });
  document.querySelectorAll('.form-group .field-error').forEach(error => {
    error.remove();
  });
}

function showFormErrors(errors, showToast) {
  clearFormErrors();

  errors.forEach(error => {
    const field = document.getElementById(error.field);
    if (field) {
      field.classList.add('error');
      showFieldError(field, error.message);
    }
  });

  const firstError = document.querySelector('.form-group.error');
  if (firstError) {
    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  showToast('❌ Vui lòng kiểm tra lại thông tin!', 'error');
}

export function validateForm(form) {
  const errors = [];

  const name = form.querySelector('#name');
  if (name && name.value.trim().length < 2) {
    errors.push({ field: 'name', message: 'Họ tên phải có ít nhất 2 ký tự' });
  }

  const phone = form.querySelector('#phone');
  if (phone && !isValidVietnamesePhone(phone.value)) {
    errors.push({
      field: 'phone',
      message: 'Số điện thoại không hợp lệ. Ví dụ: 0901234567 hoặc 84901234567'
    });
  }

  const email = form.querySelector('#email');
  if (email && email.value.trim() && !isValidEmail(email.value)) {
    errors.push({ field: 'email', message: 'Email không hợp lệ. Ví dụ: example@email.com' });
  }

  const subject = form.querySelector('#subject');
  if (subject && !subject.value) {
    errors.push({ field: 'subject', message: 'Vui lòng chọn chủ đề liên hệ' });
  }

  const message = form.querySelector('#message');
  if (message && message.value.trim().length < 10) {
    errors.push({ field: 'message', message: 'Tin nhắn phải có ít nhất 10 ký tự' });
  }

  return errors;
}

export function validateField(field) {
  const value = field.value.trim();
  let isValid = true;
  let errorMessage = '';

  switch (field.id) {
  case 'name':
    isValid = value.length >= 2;
    errorMessage = 'Họ tên phải có ít nhất 2 ký tự';
    break;
  case 'phone':
    isValid = isValidVietnamesePhone(value);
    errorMessage = 'Số điện thoại không hợp lệ';
    break;
  case 'email':
    isValid = !value || isValidEmail(value);
    errorMessage = 'Email không hợp lệ';
    break;
  case 'subject':
    isValid = value !== '';
    errorMessage = 'Vui lòng chọn chủ đề';
    break;
  case 'message':
    isValid = value.length >= 10;
    errorMessage = 'Tin nhắn quá ngắn';
    break;
  }

  if (isValid) {
    field.classList.remove('error');
    field.classList.add('valid');
    removeFieldError(field);
  } else if (value && field.id !== 'email') {
    field.classList.remove('valid');
    field.classList.add('error');
    showFieldError(field, errorMessage);
  }

  return isValid;
}

export function initContactForm(showToast) {
  const form = document.getElementById('contactForm');
  if (!form) {return;}

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const errors = validateForm(form);

    if (errors.length > 0) {
      showFormErrors(errors, showToast);
      return;
    }

    clearFormErrors();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Đang gửi...';
    submitBtn.disabled = true;
    form.classList.add('submitting');

    await new Promise(resolve => setTimeout(resolve, 800));

    form.classList.remove('submitting');
    form.classList.add('success');
    submitBtn.textContent = '✅ Đã gửi thành công!';

    showToast('✅ Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi trong 24h.', 'success');

    setTimeout(() => {
      form.reset();
      form.classList.remove('success');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }, 2000);
  });

  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      if (input.classList.contains('error')) {
        validateField(input);
      }
    });
  });
}
