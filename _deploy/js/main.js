// Main Entry Point - Initialize App

import { ThemeManager } from './theme.js';
import { MenuManager } from './menu.js';
import { CartManager } from './cart.js';
import { CheckoutManager } from './checkout.js';

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
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
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
    navigator.serviceWorker.register('/sw.js');
  }
});
