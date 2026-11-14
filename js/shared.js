// ORBEATS shared code. It runs on every page.
// It builds the header, footer and now-playing bar, and runs the accessibility toolbar.
// To change the header, footer or now-playing bar, edit them here once.

// The NASA data catalog. Home page and audio-first mode both read this list.
var CATALOG = [
  { svs: '5313', title: 'Change in Night Lights between 2012 and 2023', detail: 'SVS 5313 · NASA Black Marble · Suomi NPP VIIRS' },
  { svs: '3912', title: 'Global Sea Surface Currents and Temperature', detail: 'SVS 3912 · ECCO2 model · March 2007 to March 2008' },
  { svs: '5425', title: 'Perpetual Ocean 2: Western Boundary Currents', detail: 'SVS 5425 · ECCO-2 · 2021 to 2023' },
  { svs: '4950', title: 'GEDI Forest Height', detail: 'SVS 4950 · GEDI lidar on the ISS' },
  { svs: '5011', title: 'Lightning Events Detected from the ISS, 2017 to 2023', detail: 'SVS 5011 · Lightning Imaging Sensor' },
  { svs: '4960', title: 'A 3D View of an Atmospheric River from an Earth System Model', detail: 'SVS 4960 · MERRA-2' },
  { svs: '5533', title: 'Air Quality Model Runs', detail: 'SVS 5533 · GEOS-CF · July to August 2024' },
  { svs: '5669', title: 'GEOS Aerosols', detail: 'SVS 5669 · GEOS model · snapshot of August 19, 2025' },
  { svs: '13786', title: 'Data Sonification: Caldwell 73', detail: 'SVS 13786 · Hubble · reference only, not Earth data', reference: true }
];

var ICONS = {
  logo: '<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="16" fill="none" stroke="#7FC8F8" stroke-width="1"></circle><circle cx="17" cy="17" r="11.5" fill="none" stroke="#7FC8F8" stroke-opacity=".35" stroke-width="1"></circle><circle cx="17" cy="17" r="7" fill="none" stroke="#7FC8F8" stroke-opacity=".35" stroke-width="1"></circle><circle cx="17" cy="17" r="1.6" fill="#E8EDF5"></circle></svg>',
  contrast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"></path></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"></path><path d="M16.5 8.5a5 5 0 0 1 0 7"></path><path d="M19 6a8.5 8.5 0 0 1 0 12"></path></svg>',
  captions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M10.5 10.2a2.5 2.5 0 1 0 0 3.6M17 10.2a2.5 2.5 0 1 0 0 3.6"></path></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"></path></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4.5" width="4.5" height="15" rx="1"></rect><rect x="13.5" y="4.5" width="4.5" height="15" rx="1"></rect></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"></path></svg>'
};

// ---------- settings (saved so they carry across pages) ----------
var settings = { scale: 1, hc: false, audio: true, cc: true, playing: true };
try {
  var saved = JSON.parse(localStorage.getItem('orbeats-settings') || '{}');
  for (var key in saved) { if (key in settings) settings[key] = saved[key]; }
} catch (e) { /* storage not available: keep defaults */ }

function saveSettings() {
  try { localStorage.setItem('orbeats-settings', JSON.stringify(settings)); } catch (e) { }
}

// Other scripts can add a function here to be told when a setting changes.
var listeners = [];
function onSettingsChange(fn) { listeners.push(fn); }

// ---------- page pieces ----------
var page = document.body.getAttribute('data-page');

function tabLink(href, label, name) {
  var current = page === name ? ' aria-current="page"' : '';
  return '<li><a class="tab" href="' + href + '"' + current + '>' + label + '</a></li>';
}

function buildHeader() {
  var isAudio = page === 'audio';
  var tagline = isAudio ? 'Audio-first mode' : 'The Earth Information Jukebox';
  var middle = isAudio
    ? '<a class="btn" href="index.html">' + ICONS.arrowLeft + 'Exit audio-first mode</a>'
    : '<nav aria-label="Main sections"><ul class="tabs">' +
      tabLink('index.html', 'Explore', 'explore') +
      tabLink('play.html', 'Play', 'play') +
      tabLink('compose.html', 'Compose', 'compose') + '</ul></nav>';

  return '<a class="skip" href="#main">Skip to content</a>' +
    '<header class="hdr"><div class="hdr-row">' +
    '<a class="logo" href="index.html" aria-label="ORBEATS, ' + tagline + ', home">' + ICONS.logo +
    '<span><span class="wordmark">ORBEATS</span><span class="tagline">' + tagline + '</span></span></a>' +
    middle +
    '<div class="a11y" role="toolbar" aria-label="Accessibility settings">' +
    '<div class="tool-group"><span class="sr">Text size</span><span aria-hidden="true">Text</span>' +
    '<button class="tool" id="text-smaller" aria-label="Decrease text size">A−</button>' +
    '<span id="text-pct" aria-live="polite" style="min-width: 2.8em; text-align: center; color: var(--text)">100%</span>' +
    '<button class="tool" id="text-bigger" aria-label="Increase text size">A+</button></div>' +
    '<button class="tool" id="btn-hc" aria-pressed="false">' + ICONS.contrast + '<span>Contrast</span><span class="state"></span></button>' +
    '<button class="tool" id="btn-audio" aria-pressed="true">' + ICONS.speaker + '<span>Audio</span><span class="state"></span></button>' +
    '<button class="tool" id="btn-cc" aria-pressed="true">' + ICONS.captions + '<span>Captions</span><span class="state"></span></button>' +
    '</div></div></header>';
}

function buildFooter() {
  return '<footer class="ftr"><div class="ftr-row">' +
    '<p>Data and visualizations: <a href="https://svs.gsfc.nasa.gov/" target="_blank" rel="noopener">NASA Scientific Visualization Studio<span class="sr"> (opens in a new tab)</span></a></p>' +
    '<nav aria-label="Footer"><ul><li><a href="#">About</a></li><li><a href="#">Accessibility</a></li><li><a href="index.html#catalog">Data catalog</a></li><li><a href="#">Contact</a></li></ul></nav>' +
    '</div></footer>';
}

function buildNowPlaying() {
  var title = document.body.getAttribute('data-np-title') || '[Track title]';
  var caption = document.body.getAttribute('data-np-caption') || '[What this sound represents placeholder]';
  var bars = '';
  for (var i = 0; i < 16; i++) { bars += i < 9 ? '<i class="on"></i>' : '<i></i>'; }
  return '<section class="np" aria-label="Now playing"><div class="np-row">' +
    '<button class="btn btn-primary btn-icon" id="np-play" aria-label="Pause"></button>' +
    '<div style="min-width: 14em; max-width: 26em"><p class="label" style="font-size: .68em">Now playing</p>' +
    '<p class="np-title" id="np-title">' + title + '</p></div>' +
    '<p class="np-cap" id="np-cap" aria-live="polite">Caption · <span>' + caption + '</span></p>' +
    '<p class="np-cap" id="np-off">Audio is off. Captions only.</p>' +
    '<div class="vol"><label for="np-vol" class="sr">Volume</label>' + ICONS.speaker +
    '<input id="np-vol" type="range" min="0" max="100" value="70"></div>' +
    '<div><span class="sr">Output level: [level placeholder]</span><div class="meter" aria-hidden="true">' + bars + '</div></div>' +
    '</div></section>';
}

var app = document.getElementById('app');
document.getElementById('site-header').innerHTML = buildHeader();
document.getElementById('site-footer').innerHTML = buildFooter();
// The now-playing bar goes directly inside the page wrapper so it can stick to the bottom of the screen.
app.insertAdjacentHTML('beforeend', buildNowPlaying());

// ---------- toolbar behavior ----------

function setPressed(buttonId, on) {
  var button = document.getElementById(buttonId);
  button.setAttribute('aria-pressed', on ? 'true' : 'false');
  button.querySelector('.state').textContent = on ? 'On' : 'Off';
}

function render() {
  app.style.fontSize = 'calc(1rem * ' + settings.scale + ')';
  app.classList.toggle('hc', settings.hc);
  app.classList.toggle('paused', !(settings.playing && settings.audio));
  document.getElementById('text-pct').textContent = Math.round(settings.scale * 100) + '%';
  setPressed('btn-hc', settings.hc);
  setPressed('btn-audio', settings.audio);
  setPressed('btn-cc', settings.cc);
  var playButton = document.getElementById('np-play');
  playButton.innerHTML = settings.playing ? ICONS.pause : ICONS.play;
  playButton.setAttribute('aria-label', settings.playing ? 'Pause' : 'Play');
  document.getElementById('np-cap').hidden = !settings.cc;
  document.getElementById('np-off').hidden = settings.audio;
  for (var i = 0; i < listeners.length; i++) listeners[i]();
}

function change(name, value) {
  settings[name] = value;
  saveSettings();
  render();
}

function roundScale(n) { return Math.round(n * 100) / 100; }

document.getElementById('text-smaller').addEventListener('click', function () { change('scale', Math.max(1, roundScale(settings.scale - 0.15))); });
document.getElementById('text-bigger').addEventListener('click', function () { change('scale', Math.min(1.6, roundScale(settings.scale + 0.15))); });
document.getElementById('btn-hc').addEventListener('click', function () { change('hc', !settings.hc); });
document.getElementById('btn-audio').addEventListener('click', function () { change('audio', !settings.audio); });
document.getElementById('btn-cc').addEventListener('click', function () { change('cc', !settings.cc); });
document.getElementById('np-play').addEventListener('click', function () { change('playing', !settings.playing); });

// Pages call this to change the track name in the now-playing bar.
function setNowPlayingTitle(title) { document.getElementById('np-title').textContent = title; }

render();
