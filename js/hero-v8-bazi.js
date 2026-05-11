
(function(){
  'use strict';
  var stage = document.getElementById('logoStage');
  if(!stage) return;

  var lastRippleTs = 0;
  var THROTTLE = 180;
  var TILT_MAX = 1.5;

  stage.addEventListener('mousemove', function(e){
    var rect = stage.getBoundingClientRect();
    var xPct = (e.clientX - rect.left) / rect.width * 100;
    var yPct = (e.clientY - rect.top) / rect.height * 100;

    var tx = (yPct/100 - .5) * TILT_MAX * -2;
    var ty = (xPct/100 - .5) * TILT_MAX * 2;
    stage.style.transform = 'rotateX(' + tx + 'deg) rotateY(' + ty + 'deg)';

    if(yPct < 45 || yPct > 72) return;
    var now = Date.now();
    if(now - lastRippleTs < THROTTLE) return;
    lastRippleTs = now;
    spawnRipple(xPct, yPct);
  });

  stage.addEventListener('mouseleave', function(){
    stage.style.transform = '';
  });

  stage.addEventListener('click', function(e){
    var rect = stage.getBoundingClientRect();
    var xPct = (e.clientX - rect.left) / rect.width * 100;
    var yPct = (e.clientY - rect.top) / rect.height * 100;
    if(yPct >= 55) return;
    spawnClickDrop(xPct, yPct);
  });

  function spawnRipple(xPct, yPct){
    var r = document.createElement('div');
    r.className = 'user-ripple';
    r.style.left = xPct + '%';
    r.style.top = yPct + '%';
    stage.appendChild(r);
    setTimeout(function(){ r.remove(); }, 1500);
  }

  function spawnClickDrop(xPct, yPct){
    var d = document.createElement('div');
    d.className = 'click-drop';
    d.style.left = xPct + '%';
    d.style.top = yPct + '%';
    stage.appendChild(d);

    var startTime = performance.now();
    var startY = yPct;
    var distance = 55 - startY;
    var duration = Math.max(800, distance * 50);

    function step(now){
      var t = Math.min((now - startTime) / duration, 1);
      var ease = Math.pow(t, 1.6);
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
