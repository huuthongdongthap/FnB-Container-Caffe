
(function(){
  'use strict';
  const stage = document.getElementById('heroLogoStage') || document.getElementById('logoStage');
  if(!stage) {return;}

  let lastRippleTs = 0;
  const THROTTLE = 180;
  const TILT_MAX = 1.5;

  stage.addEventListener('mousemove', function(e){
    const rect = stage.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width * 100;
    const yPct = (e.clientY - rect.top) / rect.height * 100;

    const tx = (yPct/100 - .5) * TILT_MAX * -2;
    const ty = (xPct/100 - .5) * TILT_MAX * 2;
    stage.style.transform = 'rotateX(' + tx + 'deg) rotateY(' + ty + 'deg)';

    if(yPct < 45 || yPct > 72) {return;}
    const now = Date.now();
    if(now - lastRippleTs < THROTTLE) {return;}
    lastRippleTs = now;
    spawnRipple(xPct, yPct);
  });

  stage.addEventListener('mouseleave', function(){
    stage.style.transform = '';
  });

  stage.addEventListener('click', function(e){
    const rect = stage.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width * 100;
    const yPct = (e.clientY - rect.top) / rect.height * 100;
    if(yPct >= 55) {return;}
    spawnClickDrop(xPct, yPct);
  });

  function spawnRipple(xPct, yPct){
    const r = document.createElement('div');
    r.className = 'user-ripple';
    r.style.left = xPct + '%';
    r.style.top = yPct + '%';
    stage.appendChild(r);
    setTimeout(function(){ r.remove(); }, 1500);
  }

  function spawnClickDrop(xPct, yPct){
    const d = document.createElement('div');
    d.className = 'click-drop';
    d.style.left = xPct + '%';
    d.style.top = yPct + '%';
    stage.appendChild(d);

    const startTime = performance.now();
    const startY = yPct;
    const distance = 55 - startY;
    const duration = Math.max(800, distance * 50);

    function step(now){
      const t = Math.min((now - startTime) / duration, 1);
      const ease = Math.pow(t, 1.6);
      d.style.top = (startY + distance * ease) + '%';
      if(t < 1){
        requestAnimationFrame(step);
      } else {
        d.remove();
        spawnRipple(xPct, 55);
      }
    }
    requestAnimationFrame(step);
  }
})();

/* ─── SCROLL-REVEAL (ported from Sophia ScrollReveal via IntersectionObserver) ─── */
(function initScrollReveal(){
  const targets = document.querySelectorAll('.reveal');
  if(!targets.length) {return;}
  const observer = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        const delay = parseInt(entry.target.getAttribute('data-delay') || '0', 10);
        setTimeout(function(){
          entry.target.classList.add('visible');
        }, delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });
  targets.forEach(function(el){ observer.observe(el); });
})();
