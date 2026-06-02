// Main Entry Point - Initialize App


// Initialize all managers
document.addEventListener('DOMContentLoaded', () => {
  // Mobile menu toggle
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('active');
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
          // Close mobile menu if open
          mobileMenu?.classList.remove('active');
        }
      }
    });
  });

  // Header scroll effect
  const header = document.querySelector('.header');

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }

  });

  // Newsletter form
  const newsletterSubmit = document.getElementById('newsletter-submit');
  const newsletterEmail = document.getElementById('newsletter-email');

  if (newsletterSubmit && newsletterEmail) {
    newsletterSubmit.addEventListener('click', async () => {
      const email = newsletterEmail.value;
      if (email) {
        // Future: Send to backend
        alert('Cảm ơn bạn đã đăng ký!');
        newsletterEmail.value = '';
      }
    });
  }

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Check for updates on server periodically
      setInterval(() => reg.update(), 120000); // Check every 2 minutes

      reg.addEventListener('updatefound', () => {
        const installingWorker = reg.installing;
        if (installingWorker) {
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Automatically activate the new Service Worker immediately
              installingWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
});
