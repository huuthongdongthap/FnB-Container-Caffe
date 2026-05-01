/**
 * AURA CAFE — Gallery Lightbox Module
 */

export function initGalleryLightbox() {
  const galleryItems = document.querySelectorAll('.gallery-item');
  if (!galleryItems.length) {return;}

  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `
    <button class="lightbox-close">&times;</button>
    <div class="lightbox-content">
      <img src="" alt="" class="lightbox-image">
      <div class="lightbox-caption"></div>
    </div>
  `;
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(6, 10, 19, 0.95);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(10px);
  `;
  document.body.appendChild(overlay);

  const lightboxImg = overlay.querySelector('.lightbox-image');
  const lightboxCaption = overlay.querySelector('.lightbox-caption');
  const closeBtn = overlay.querySelector('.lightbox-close');

  const closeLightbox = () => {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  };

  closeBtn.addEventListener('click', closeLightbox);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {closeLightbox();}
  });

  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      const caption = item.querySelector('.gallery-overlay span');
      overlay.style.display = 'flex';
      lightboxImg.src = img.src;
      lightboxCaption.textContent = caption?.textContent || '';
      document.body.style.overflow = 'hidden';
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {closeLightbox();}
  });
}
