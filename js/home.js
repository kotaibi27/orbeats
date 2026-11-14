// Home page: the data catalog list and the animated background video with its music.

// ---------- data catalog list ----------
var listHtml = '';
for (var i = 0; i < CATALOG.length; i++) {
  var item = CATALOG[i];
  var tag = item.reference ? '<span class="label" style="color: var(--amber); letter-spacing: .12em">Reference</span>' : '';
  listHtml += '<li class="cat-item">' +
    '<div class="thumb" style="aspect-ratio: 16 / 9">[Image placeholder]</div>' +
    '<div><p class="serif" style="font-size: 1.25em">' + item.title + '</p><p class="muted" style="font-size: .85em">' + item.detail + '</p></div>' +
    '<div style="display: flex; align-items: center; gap: 1em">' + tag +
    '<button class="btn btn-icon" aria-label="Play ' + item.title + '">' + ICONS.play + '</button></div></li>';
}
document.getElementById('catalog-list').innerHTML = listHtml;

// ---------- background video and music ----------
// The video always plays muted (browsers require this). Sound starts only after a click.
var video = document.getElementById('bg-video');
var musicBtn = document.getElementById('music-btn');
var musicLabel = document.getElementById('music-label');
var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var soundOn = false;

function syncVideo() {
  if (reduceMotion && !soundOn) { video.pause(); return; }
  if (settings.playing) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
  else video.pause();
  video.muted = !(soundOn && settings.audio);
}

function setSound(on) {
  soundOn = on;
  musicBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  musicLabel.textContent = on ? 'Mute the music' : 'Play the music';
  if (on && !settings.playing) change('playing', true);
  if (on && !settings.audio) change('audio', true);
  syncVideo();
}

musicBtn.addEventListener('click', function () { setSound(!soundOn); });
onSettingsChange(syncVideo);
syncVideo();
