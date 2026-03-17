/**
 * ═══════════════════════════════════════════════
 *  F&B CAFFE CONTAINER — Customer Reviews System
 *  Star Ratings, Reviews List, Review Form
 * ═══════════════════════════════════════════════
 */

const REVIEWS_SYSTEM = {
  reviews: [],
  averageRating: 0,
  totalReviews: 0,

  /**
     * Initialize reviews system
     */
  init() {
    this.loadReviews();
    this.renderReviewsSummary();
    this.renderReviewsList();
    this.initReviewForm();
    this.initRatingFilter();
  },

  /**
     * Load reviews from localStorage or use sample data
     */
  loadReviews() {
    const stored = localStorage.getItem('fnb_reviews');

    if (stored) {
      this.reviews = JSON.parse(stored);
    } else {
      // Sample reviews data
      this.reviews = [
        {
          id: 1,
          customerName: 'Nguyễn Văn A',
          rating: 5,
          date: '2026-03-10',
          comment: 'Cà phê ngon, không gian đẹp! Nhân viên rất nhiệt tình.',
          productName: 'Container Special',
          verified: true,
          helpful: 12
        },
        {
          id: 2,
          customerName: 'Trần Thị B',
          rating: 4,
          date: '2026-03-12',
          comment: 'Không gian check-in rất đẹp. Đồ uống ổn, giá hợp lý.',
          productName: 'Cold Brew Tower',
          verified: true,
          helpful: 8
        },
        {
          id: 3,
          customerName: 'Lê Văn C',
          rating: 5,
          date: '2026-03-13',
          comment: 'Quán đẹp quá, cà phê đậm đà. Sẽ quay lại!',
          productName: 'Espresso',
          verified: false,
          helpful: 5
        },
        {
          id: 4,
          customerName: 'Phạm Thị D',
          rating: 5,
          date: '2026-03-14',
          comment: 'Trải nghiệm tuyệt vời! Không gian container độc đáo, đồ uống ngon.',
          productName: 'Dirty Matcha Latte',
          verified: true,
          helpful: 3
        },
        {
          id: 5,
          customerName: 'Hoàng Văn E',
          rating: 4,
          date: '2026-03-14',
          comment: 'Đồ ngon, phục vụ nhanh. Chỗ đậu xe hơi hạn chế.',
          productName: 'Bánh Mì Chả Lụa',
          verified: true,
          helpful: 2
        }
      ];
      this.saveReviews();
    }

    this.calculateAverageRating();
  },

  /**
     * Save reviews to localStorage
     */
  saveReviews() {
    localStorage.setItem('fnb_reviews', JSON.stringify(this.reviews));
  },

  /**
     * Calculate average rating
     */
  calculateAverageRating() {
    if (this.reviews.length === 0) {
      this.averageRating = 0;
      this.totalReviews = 0;
      return;
    }

    const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    this.averageRating = (sum / this.reviews.length).toFixed(1);
    this.totalReviews = this.reviews.length;
  },

  /**
     * Render reviews summary (average rating + stars)
     */
  renderReviewsSummary() {
    const summaryEl = document.getElementById('reviewsSummary');
    if (!summaryEl) {return;}

    const starRating = this.generateStars(this.averageRating);

    summaryEl.innerHTML = `
            <div class="reviews-summary-content">
                <div class="reviews-overview">
                    <div class="average-rating">${this.averageRating}</div>
                    <div class="stars-large">${starRating}</div>
                    <div class="total-reviews">${this.totalReviews} đánh giá</div>
                </div>
                <div class="rating-breakdown">
                    ${this.generateRatingBars()}
                </div>
            </div>
        `;
  },

  /**
     * Generate star rating HTML
     */
  generateStars(rating, size = 'medium') {
    const fullStar = '★';
    const emptyStar = '☆';
    const stars = [];

    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(rating)) {
        stars.push(fullStar);
      } else if (i === Math.ceil(rating) && rating % 1 !== 0) {
        stars.push('★'); // Half star could be added with CSS
      } else {
        stars.push(emptyStar);
      }
    }

    return `<span class="stars ${size}">${stars.join('')}</span>`;
  },

  /**
     * Generate rating distribution bars
     */
  generateRatingBars() {
    const distribution = [5, 4, 3, 2, 1].map(star => {
      const count = this.reviews.filter(r => r.rating === star).length;
      const percentage = this.totalReviews > 0 ? (count / this.totalReviews) * 100 : 0;
      return { star, count, percentage };
    });

    return distribution.map(({ star, count, percentage }) => `
            <div class="rating-bar-row">
                <span class="star-label">${star} <span class="star-icon">★</span></span>
                <div class="rating-bar">
                    <div class="rating-bar-fill" style="width: ${percentage}%"></div>
                </div>
                <span class="rating-count">${count}</span>
            </div>
        `).join('');
  },

  /**
     * Render reviews list
     */
  renderReviewsList(filter = 'all') {
    const listEl = document.getElementById('reviewsList');
    if (!listEl) {return;}

    let filteredReviews = this.reviews;
    if (filter !== 'all') {
      filteredReviews = this.reviews.filter(r => r.rating === parseInt(filter));
    }

    // Sort by date (newest first)
    filteredReviews.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredReviews.length === 0) {
      listEl.innerHTML = '<p class="no-reviews">Chưa có đánh giá nào.</p>';
      return;
    }

    listEl.innerHTML = filteredReviews.map(review => `
            <div class="review-card" data-review-id="${review.id}">
                <div class="review-header">
                    <div class="reviewer-info">
                        <span class="reviewer-name">${review.customerName}</span>
                        ${review.verified ? '<span class="verified-badge" title="Đã xác minh">✓</span>' : ''}
                    </div>
                    <div class="review-meta">
                        ${this.generateStars(review.rating, 'small')}
                        <span class="review-date">${this.formatDate(review.date)}</span>
                    </div>
                </div>
                <div class="review-product">
                    <span class="review-product-label">Sản phẩm:</span>
                    ${review.productName}
                </div>
                <p class="review-comment">${review.comment}</p>
                <div class="review-actions">
                    <button class="helpful-btn" data-review-id="${review.id}">
                        👍 Hữu ích (${review.helpful})
                    </button>
                    <button class="report-btn">
                        ⚠ Báo cáo
                    </button>
                </div>
            </div>
        `).join('');

    // Add event listeners for helpful buttons
    listEl.querySelectorAll('.helpful-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const reviewId = parseInt(e.target.dataset.reviewId);
        this.markHelpful(reviewId);
      });
    });
  },

  /**
     * Mark review as helpful
     */
  markHelpful(reviewId) {
    const review = this.reviews.find(r => r.id === reviewId);
    if (review) {
      review.helpful++;
      this.saveReviews();
      this.renderReviewsList();

      // Show toast
      this.showToast('Cảm ơn bạn đã đánh giá!');
    }
  },

  /**
     * Initialize review form
     */
  initReviewForm() {
    const form = document.getElementById('reviewForm');
    if (!form) {return;}

    // Star rating input
    const starInputs = form.querySelectorAll('.star-input input');
    starInputs.forEach(input => {
      input.addEventListener('change', () => {
        this.updateStarDisplay(form, input.value);
      });
    });

    // Form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitReview(form);
    });
  },

  /**
     * Update star rating display
     */
  updateStarDisplay(form, rating) {
    const stars = form.querySelectorAll('.star-input .star');
    stars.forEach((star, index) => {
      if (index < parseInt(rating)) {
        star.classList.add('active');
        star.textContent = '★';
      } else {
        star.classList.remove('active');
        star.textContent = '☆';
      }
    });
  },

  /**
     * Submit new review
     */
  submitReview(form) {
    const formData = new FormData(form);
    const rating = parseInt(formData.get('rating'));
    const customerName = formData.get('customerName')?.trim();
    const comment = formData.get('comment')?.trim();
    const productName = formData.get('productName')?.trim();

    // Validation
    const errors = [];
    if (!rating || rating < 1) {errors.push('Vui lòng chọn số sao');}
    if (!customerName) {errors.push('Vui lòng nhập tên');}
    if (!comment || comment.length < 10) {errors.push('Đánh giá phải có ít nhất 10 ký tự');}

    if (errors.length > 0) {
      this.showErrors(errors);
      return;
    }

    // Create new review
    const newReview = {
      id: Date.now(),
      customerName,
      rating,
      date: new Date().toISOString().split('T')[0],
      comment,
      productName: productName || 'Không chỉ định',
      verified: false,
      helpful: 0
    };

    // Add to reviews array
    this.reviews.unshift(newReview);
    this.saveReviews();
    this.calculateAverageRating();

    // Re-render
    this.renderReviewsSummary();
    this.renderReviewsList();

    // Reset form
    form.reset();
    this.updateStarDisplay(form, 0);
    form.classList.remove('has-error');

    // Show success
    this.showToast('✅ Cảm ơn bạn đã đánh giá!', 'success');

    // Scroll to reviews
    document.getElementById('reviewsList')?.scrollIntoView({ behavior: 'smooth' });
  },

  /**
     * Initialize rating filter
     */
  initRatingFilter() {
    const filterBtns = document.querySelectorAll('.rating-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        this.renderReviewsList(filter);
      });
    });
  },

  /**
     * Show error messages
     */
  showErrors(errors) {
    const errorEl = document.getElementById('reviewFormError');
    if (errorEl) {
      errorEl.innerHTML = errors.map(err => `<p>${err}</p>`).join('');
      errorEl.style.display = 'block';
    }
    document.getElementById('reviewForm')?.classList.add('has-error');
  },

  /**
     * Format date to Vietnamese
     */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  /**
     * Show toast notification
     */
  showToast(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) {existing.remove();}

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: ${type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #f39c12, #f1c40f)'};
            color: #fff;
            padding: 14px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.9rem;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 9999;
            transition: transform 0.4s ease;
        `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(100px)';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }
};

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => REVIEWS_SYSTEM.init());
} else {
  REVIEWS_SYSTEM.init();
}

// Export for global use
window.REVIEWS_SYSTEM = REVIEWS_SYSTEM;
