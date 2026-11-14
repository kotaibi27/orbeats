// Explore (home) page: animated star picture behind the video, count-up numbers, catalog buttons.
(function () {
  // 1. Animated star picture: stars drift outward from the centre, thin ice-blue rings pulse like beats.
  //    It always runs behind the video, so the screen is never still even if the video fails.
  //    The Pause button in the now-playing bar stops it (event "orbeats:motion").
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');
  let running = true;
  let w = 0, h = 0, cx = 0, cy = 0, maxR = 0;
  const stars = [];
  const rings = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w / 2; cy = h * 0.45; maxR = Math.hypot(w, h) * 0.6;
  }

  function newStar(anywhere) {
    return {
      angle: Math.random() * Math.PI * 2,
      dist: anywhere ? Math.random() * maxR : Math.random() * 20,
      speed: 0.08 + Math.random() * 0.35,
      size: 0.4 + Math.random() * 1.4,
      warm: Math.random() < 0.18
    };
  }

  resize();
  for (let i = 0; i < 420; i++) stars.push(newStar(true));
  window.addEventListener('resize', resize);

  let lastBeat = 0;
  function frame(time) {
    if (running) {
      ctx.fillStyle = '#05080F';
      ctx.fillRect(0, 0, w, h);

      // beat rings every ~1.6 s
      if (time - lastBeat > 1600) { rings.push({ r: 8, alpha: 0.55 }); lastBeat = time; }
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.r += 1.1; ring.alpha *= 0.992;
        // rings fade down once you scroll past the hero, so text below stays calm
        const fade = Math.max(0.3, 1 - (window.scrollY || 0) / h);
        ctx.strokeStyle = 'rgba(127, 200, 248, ' + (ring.alpha * fade).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, ring.r, 0, Math.PI * 2); ctx.stroke();
        if (ring.r > maxR || ring.alpha < 0.02) rings.splice(i, 1);
      }

      // stars drifting outward, speeding up and brightening as they move away
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.dist += s.speed * (1 + s.dist / 260);
        if (s.dist > maxR) { stars[i] = newStar(false); continue; }
        const x = cx + Math.cos(s.angle) * s.dist;
        const y = cy + Math.sin(s.angle) * s.dist;
        const a = Math.min(1, 0.25 + s.dist / 500);
        ctx.fillStyle = s.warm ? 'rgba(255, 214, 170, ' + a + ')' : 'rgba(232, 237, 245, ' + a + ')';
        ctx.beginPath(); ctx.arc(x, y, s.size * (0.7 + s.dist / maxR), 0, Math.PI * 2); ctx.fill();
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.addEventListener('orbeats:motion', function (e) { running = e.detail.running; });

  // 2. Fade the video in once it is really playing
  const video = document.getElementById('bg-video');
  function showVideo() { if (video.currentTime > 0 || !video.paused) video.classList.add('is-live'); }
  video.addEventListener('playing', showVideo);
  video.addEventListener('timeupdate', showVideo);
  video.addEventListener('ended', function () { video.currentTime = 0; video.play().catch(function () {}); });  // loop forever
  showVideo();

  // 3. Big numbers count up once when they scroll into view
  const counters = document.querySelectorAll('.count');
  function countUp(el) {
    const target = parseFloat(el.dataset.target);
    const decimals = parseInt(el.dataset.decimals, 10);
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / 1600);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { countUp(entry.target); seen.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { seen.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = el.dataset.target; });
  }

})();
