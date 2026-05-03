/**
 * AURA SPACE — Hero Section Module
 * Provides ambient + interactive ripple effects, particles, and custom cursor.
 *
 * Usage:
 *   import { initHeroAura } from './js/hero-aura.js';
 *   const cleanup = initHeroAura(document.querySelector('.hero-aura'));
 *   // later: cleanup() to dispose listeners and animations.
 */

/**
 * Initialize the hero section interactivity.
 * @param {HTMLElement} root - The .hero-aura root element.
 * @returns {() => void} cleanup function
 */
export function initHeroAura(root) {
  if (!root) {
    console.warn('[hero-aura] root element not found');
    return () => {};
  }

  const cleanups = [];

  cleanups.push(initRippleCanvas(root));
  cleanups.push(initParticles(root));
  cleanups.push(initCustomCursor(root));

  return () => cleanups.forEach((fn) => fn && fn());
}

/* =========================================================
   1. INTERACTIVE RIPPLE CANVAS
   ========================================================= */
function initRippleCanvas(root) {
  const canvas = root.querySelector('.ripple-canvas');
  if (!canvas) return () => {};

  const ctx = canvas.getContext('2d');
  const ripples = [];
  let rafId = null;
  let hoverInterval = null;

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  };
  resize();
  window.addEventListener('resize', resize);

  class Ripple {
    constructor(x, y, intense = false) {
      this.x = x;
      this.y = y;
      this.r = 0;
      this.maxR = intense ? 320 : 200;
      this.life = 1;
      this.speed = intense ? 4.5 : 3;
      this.color = intense ? [255, 215, 0] : [201, 162, 0];
    }
    update() {
      this.r += this.speed;
      this.life = 1 - this.r / this.maxR;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${this.color.join(',')}, ${this.life * 0.7})`;
      ctx.lineWidth = 1.5 * this.life + 0.3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 0.6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${this.color.join(',')}, ${this.life * 0.3})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    isDead() {
      return this.r >= this.maxR;
    }
  }

  const spawnRipple = (x, y, intense = false) => {
    ripples.push(new Ripple(x, y, intense));
    setTimeout(() => ripples.push(new Ripple(x, y, intense)), 120);
  };

  const onClick = (e) => spawnRipple(e.clientX, e.clientY, true);
  document.addEventListener('click', onClick);

  const logoWrapper = root.querySelector('.logo-wrapper');
  const onLogoEnter = () => {
    if (!logoWrapper) return;
    const rect = logoWrapper.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    spawnRipple(cx, cy, false);
    hoverInterval = setInterval(() => spawnRipple(cx, cy, false), 700);
  };
  const onLogoLeave = () => {
    if (hoverInterval) {
      clearInterval(hoverInterval);
      hoverInterval = null;
    }
  };
  if (logoWrapper) {
    logoWrapper.addEventListener('mouseenter', onLogoEnter);
    logoWrapper.addEventListener('mouseleave', onLogoLeave);
  }

  const loop = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].update();
      ripples[i].draw();
      if (ripples[i].isDead()) ripples.splice(i, 1);
    }
    rafId = requestAnimationFrame(loop);
  };
  loop();

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (hoverInterval) clearInterval(hoverInterval);
    window.removeEventListener('resize', resize);
    document.removeEventListener('click', onClick);
    if (logoWrapper) {
      logoWrapper.removeEventListener('mouseenter', onLogoEnter);
      logoWrapper.removeEventListener('mouseleave', onLogoLeave);
    }
  };
}

/* =========================================================
   2. FLOATING PARTICLES
   ========================================================= */
function initParticles(root) {
  const container = root.querySelector('.particles');
  if (!container) return () => {};

  const PARTICLE_COUNT = 18;
  const particles = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = 1 + Math.random() * 3;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = (Math.random() * 100) + '%';
    p.style.animationDuration = (12 + Math.random() * 18) + 's';
    p.style.animationDelay = (Math.random() * 12) + 's';
    p.style.setProperty('--drift', (Math.random() * 80 - 40) + 'px');
    p.style.opacity = (0.3 + Math.random() * 0.5).toString();
    container.appendChild(p);
    particles.push(p);
  }

  return () => particles.forEach((p) => p.remove());
}

/* =========================================================
   3. CUSTOM CURSOR (desktop only)
   ========================================================= */
function initCustomCursor(root) {
  if (window.matchMedia('(max-width: 768px)').matches) return () => {};

  const dot = root.querySelector('.cursor-dot');
  const ring = root.querySelector('.cursor-ring');
  if (!dot || !ring) return () => {};

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let rx = mx;
  let ry = my;
  let rafId = null;

  const onMove = (e) => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top = my + 'px';
  };
  document.addEventListener('mousemove', onMove);

  const animate = () => {
    rx += (mx - rx) * 0.15;
    ry += (my - ry) * 0.15;
    ring.style.left = rx + 'px';
    ring.style.top = ry + 'px';
    rafId = requestAnimationFrame(animate);
  };
  animate();

  const hoverables = root.querySelectorAll('button, .logo-wrapper');
  const onEnter = () => ring.classList.add('hover');
  const onLeave = () => ring.classList.remove('hover');
  hoverables.forEach((el) => {
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
  });

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    document.removeEventListener('mousemove', onMove);
    hoverables.forEach((el) => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    });
  };
}
