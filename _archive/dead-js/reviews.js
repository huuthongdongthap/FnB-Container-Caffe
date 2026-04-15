/**
 * Customer Reviews & Rating System
 * AURA SPACE Café
 */

export class ReviewsSystem {
  constructor() {
    this.storageKey = 'fnb_cafe_reviews';
    this.reviews = this.loadReviews();
    this.init();
  }

  init() {
    this.renderReviews();
    this.initStarRating();
    this.initReviewForm();
    this.initSorting();
    this.updateAverageRating();
  }

  // ============ LOAD/SAVE REVIEWS ============

  loadReviews() {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      return JSON.parse(stored);
    }
    // Default sample reviews
    return [
      {
        id: 1,
        name: 'Nguyễn Văn A',
        rating: 5,
        comment: 'Cà phê ngon, không gian đẹp! Nhân viên phục vụ nhiệt tình.',
        date: '2026-03-10',
        helpful: 12
      },
      {
        id: 2,
        name: 'Trần Thị B',
        rating: 4,
        comment: 'Không gian check-in rất sống ảo. Đồ uống ổn, giá hợp lý.',
        date: '2026-03-12',
        helpful: 8
      },
      {
        id: 3,
        name: 'Lê Văn C',
        rating: 5,
        comment: 'Container Special ngon tuyệt! Sẽ quay lại.',
        date: '2026-03-13',
        helpful: 15
      }
    ];
  }

  saveReviews() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.reviews));
  }

  addReview(review) {
    const newReview = {
      id: Date.now(),
      name: review.name,
      rating: review.rating,
      comment: review.comment,
      date: new Date().toISOString().split('T')[0],
      helpful: 0
    };
    this.reviews.unshift(newReview);
    this.saveReviews();
    this.renderReviews();
    this.updateAverageRating();
  }

  // ============ STAR RATING INTERACTION ============

  initStarRating() {
    document.querySelectorAll('.star-rating-input').forEach(rating => {
      const stars = rating.parentElement.querySelectorAll('.star');

      stars.forEach((star, index) => {
        star.addEventListener('click', () => {
          const value = index + 1;
          rating.value = value;
          this.updateStarDisplay(stars, value);
        });

        star.addEventListener('mouseenter', () => {
          this.updateStarDisplay(stars, index + 1, true);
        });
      });

      rating.parentElement.addEventListener('mouseleave', () => {
        const currentValue = parseInt(rating.value) || 0;
        this.updateStarDisplay(stars, currentValue);
      });
    });
  }

  updateStarDisplay(stars, value, isHover = false) {
    const fillClass = isHover ? 'star-fill-hover' : 'star-fill';
    stars.forEach((star, index) => {
      if (index < value) {
        star.classList.add(fillClass);
        star.classList.remove('star-empty');
      } else {
        star.classList.remove(fillClass);
        star.classList.add('star-empty');
      }
    });
  }

  // ============ REVIEW FORM ============

  initReviewForm() {
    const form = document.getElementById('reviewForm');
    if (!form) {return;}

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('reviewerName')?.value.trim();
      const rating = document.getElementById('reviewRating')?.value;
      const comment = document.getElementById('reviewComment')?.value.trim();

      if (!name || !rating || !comment) {
        this.showNotification('Vui lòng điền đầy đủ thông tin!', 'error');
        return;
      }

      if (rating < 1) {
        this.showNotification('Vui lòng chọn số sao!', 'error');
        return;
      }

      this.addReview({ name, rating, comment });

      // Reset form
      form.reset();
      document.querySelectorAll('.star-rating-input').forEach(r => {
        r.value = 0;
        this.updateStarDisplay(r.parentElement.querySelectorAll('.star'), 0);
      });

      this.showNotification('Cảm ơn bạn đã đánh giá!', 'success');

      // Close modal if exists
      const modal = document.getElementById('reviewModal');
      if (modal) {modal.classList.remove('active');}
    });
  }

  // ============ RENDER REVIEWS ============

  renderReviews(sortBy = 'newest') {
    const container = document.getElementById('reviewsList');
    if (!container) {return;}

    const sortedReviews = [...this.reviews];

    switch (sortBy) {
    case 'highest':
      sortedReviews.sort((a, b) => b.rating - a.rating);
      break;
    case 'lowest':
      sortedReviews.sort((a, b) => a.rating - b.rating);
      break;
    case 'helpful':
      sortedReviews.sort((a, b) => b.helpful - a.helpful);
      break;
    case 'newest':
    default:
      sortedReviews.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    container.innerHTML = sortedReviews.map(review => this.renderReviewCard(review)).join('');

    // Init helpful button listeners
    container.querySelectorAll('.helpful-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const reviewId = parseInt(e.target.dataset.reviewId);
        this.markHelpful(reviewId);
      });
    });
  }

  renderReviewCard(review) {
    const stars = this.renderStars(review.rating, false);
    const date = new Date(review.date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
            <div class="review-card reveal" data-rating="${review.rating}">
                <div class="review-header">
                    <div class="reviewer-info">
                        <div class="reviewer-avatar">
                            ${review.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="reviewer-details">
                            <h4 class="reviewer-name">${this.escapeHtml(review.name)}</h4>
                            <span class="review-date">${date}</span>
                        </div>
                    </div>
                    <div class="review-rating">
                        ${stars}
                    </div>
                </div>
                <p class="review-comment">${this.escapeHtml(review.comment)}</p>
                <div class="review-footer">
                    <button class="helpful-btn" data-review-id="${review.id}">
                        👍 Hữu ích (${review.helpful})
                    </button>
                </div>
            </div>
        `;
  }

  renderStars(rating, interactive = true) {
    const inputHtml = interactive ?
      `<input type="hidden" class="star-rating-input" value="${rating}">` : '';

    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      const filled = i <= rating ? 'star-fill' : 'star-empty';
      starsHtml += `<span class="star ${filled}">★</span>`;
    }

    return `<div class="star-rating ${interactive ? 'interactive' : ''}">
            ${inputHtml}${starsHtml}
        </div>`;
  }

  // ============ SORTING ============

  initSorting() {
    const sortSelect = document.getElementById('reviewSort');
    if (!sortSelect) {return;}

    sortSelect.addEventListener('change', (e) => {
      this.renderReviews(e.target.value);
    });
  }

  // ============ AVERAGE RATING ============

  updateAverageRating() {
    const totalReviews = this.reviews.length;
    const totalStars = this.reviews.reduce((sum, r) => sum + r.rating, 0);
    const average = totalReviews > 0 ? (totalStars / totalReviews).toFixed(1) : 0;

    // Update average display
    const avgElement = document.getElementById('averageRating');
    if (avgElement) {
      avgElement.textContent = average;
    }

    const totalReviewsElement = document.getElementById('totalReviews');
    if (totalReviewsElement) {
      totalReviewsElement.textContent = totalReviews;
    }

    // Update rating bars
    this.renderRatingDistribution();
  }

  renderRatingDistribution() {
    const distributionContainer = document.getElementById('ratingDistribution');
    if (!distributionContainer) {return;}

    const distribution = [5, 4, 3, 2, 1].map(stars => {
      const count = this.reviews.filter(r => r.rating === stars).length;
      const percentage = this.reviews.length > 0
        ? (count / this.reviews.length * 100).toFixed(0)
        : 0;
      return { stars, count, percentage };
    });

    distributionContainer.innerHTML = distribution.map(item => `
            <div class="rating-bar">
                <span class="rating-bar-stars">${item.stars} ★</span>
                <div class="rating-bar-track">
                    <div class="rating-bar-fill" style="width: ${item.percentage}%"></div>
                </div>
                <span class="rating-bar-count">${item.count}</span>
            </div>
        `).join('');
  }

  // ============ HELPER FUNCTIONS ============

  markHelpful(reviewId) {
    const review = this.reviews.find(r => r.id === reviewId);
    if (review) {
      review.helpful++;
      this.saveReviews();
      this.renderReviews();
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showNotification(message, type = 'success') {
    // Remove existing notification
    const existing = document.querySelector('.review-notification');
    if (existing) {existing.remove();}

    const notification = document.createElement('div');
    notification.className = `review-notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // ============ FILTER BY RATING ============

  filterByRating(minRating) {
    const container = document.getElementById('reviewsList');
    if (!container) {return;}

    const cards = container.querySelectorAll('.review-card');
    cards.forEach(card => {
      const rating = parseInt(card.dataset.rating);
      if (rating >= minRating || minRating === 0) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  }
}

// Auto-initialize on DOM ready
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.reviewsSystem = new ReviewsSystem();
  });
}
