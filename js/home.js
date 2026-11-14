// Home page: the data catalog list and the animated background video with its music.

// ---------- data catalog list ----------
// A small unique waveform picture for each item, until real images are added.
function wave(n) {
  var bars = '';
  for (var k = 0; k < 24; k++) {
    var h = 8 + Math.abs(Math.sin((k + 1) * (n + 2) * 0.37) * 30 + Math.cos(k * 0.5 + n) * 12);
    bars += '<rect x="' + (k * 5 + 3) + '" y="' + (25 - h / 2) + '" width="2.6" height="' + h + '" rx="1.3" fill="#7FC8F8" fill-opacity="' + (0.35 + (k % 5) * 0.12) + '"></rect>';
  }
  return '<svg viewBox="0 0 126 50" preserveAspectRatio="none" aria-hidden="true">' + bars + '</svg>';
}

var listHtml = '';
for (var i = 0; i < CATALOG.length; i++) {
  var item = CATALOG[i];
  var tag = item.reference ? '<span class="label" style="color: var(--amber); letter-spacing: .12em">Reference</span>' : '';
  listHtml += '<li class="cat-item">' +
    '<div class="thumb" style="aspect-ratio: 16 / 9">' + wave(i) + '</div>' +
    '<div><p class="serif" style="font-size: 1.25em">' + item.title + '</p><p class="muted" style="font-size: .85em">' + item.detail + '</p></div>' +
    '<div style="display: flex; align-items: center; gap: 1em">' + tag +
    '<button class="btn btn-icon" aria-label="Play ' + item.title + '">' + ICONS.play + '</button></div></li>';
}
document.getElementById('catalog-list').innerHTML = listHtml;

// ---------- background video, moving orbit canvas, and music ----------
var video = document.getElementById('bg-video');
var musicBtn = document.getElementById('music-btn');
var musicLabel = document.getElementById('music-label');
var musicMsg = document.getElementById('music-msg');
var soundOn = false;

// The video fades in only once it is really playing. Until then (or if it cannot load),
// the moving orbit picture below shows instead, so the page is never still.
video.addEventListener('playing', function () { video.classList.add('on'); });
video.addEventListener('error', function () { video.classList.remove('on'); }, true);

function syncVideo() {
  video.volume = 0.8;
  video.muted = !(soundOn && settings.audio);
  if (settings.playing) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
  else video.pause();
}

function setSound(on) {
  soundOn = on;
  musicBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  musicLabel.textContent = on ? 'Mute the music' : 'Tap to hear the music';
  musicMsg.hidden = true;
  if (on && !settings.playing) change('playing', true);
  if (on && !settings.audio) change('audio', true);
  syncVideo();
  if (on) {
    setTimeout(function () {
      if (soundOn && (video.paused || video.muted || video.readyState < 2)) musicMsg.hidden = false;
    }, 1500);
  }
}
musicBtn.addEventListener('click', function () { setSound(!soundOn); });
onSettingsChange(syncVideo);
syncVideo();

// Moving orbit picture: stars drifting out from the center, with rings that pulse like beats.
var canvas = document.getElementById('orbit-canvas');
var ctx = canvas.getContext('2d');
var stars = [];
for (var s = 0; s < 220; s++) stars.push({ a: Math.random() * 6.283, r: Math.random(), v: 0.0004 + Math.random() * 0.0012, z: Math.random() * 1.3 + 0.3 });
function sizeCanvas() {
  canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
  canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
}
window.addEventListener('resize', sizeCanvas);
sizeCanvas();
function frame(t) {
  var w = canvas.width, h = canvas.height, cx = w * 0.68, cy = h * 0.42, max = Math.max(w, h) * 0.75;
  ctx.fillStyle = '#05080F'; ctx.fillRect(0, 0, w, h);
  for (var ring = 0; ring < 4; ring++) {
    var phase = ((t / 4000) + ring / 4) % 1;
    ctx.strokeStyle = 'rgba(127,200,248,' + (0.28 * (1 - phase)) + ')';
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, phase * max, 0, 6.283); ctx.stroke();
  }
  for (var k = 0; k < stars.length; k++) {
    var st = stars[k];
    if (settings.playing) { st.r += st.v; st.a += 0.0004; }
    if (st.r > 1) st.r = 0.02;
    var d = st.r * max, x = cx + Math.cos(st.a) * d, y = cy + Math.sin(st.a) * d * 0.8;
    ctx.fillStyle = 'rgba(232,237,245,' + Math.min(1, st.r * 1.6) * 0.9 + ')';
    ctx.beginPath(); ctx.arc(x, y, st.z * st.r * 2.4 * (window.devicePixelRatio || 1) + 0.4, 0, 6.283); ctx.fill();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- impact numbers count up once when they scroll into view ----------
var stats = document.querySelectorAll('.stat');
function countUp(el) {
  var target = parseFloat(el.getAttribute('data-count')), suffix = el.getAttribute('data-suffix'), t0 = null;
  var dec = String(target).indexOf('.') === -1 ? 0 : 1;
  function step(ts) {
    if (t0 === null) t0 = ts;
    var f = Math.min(1, (ts - t0) / 1400);
    el.textContent = (target * f).toFixed(dec) + suffix;
    if (f < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
if ('IntersectionObserver' in window) {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { countUp(en.target); io.unobserve(en.target); } });
  }, { threshold: 0.6 });
  stats.forEach(function (el) { io.observe(el); });
}
