// Home page: the data catalog list, the Sun viewer fallback, and the live status row.

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

// ---------- Sun viewer fallback ----------
// If there is no internet, hide the viewer and show the fallback message.
function checkViewer() {
  var offline = !navigator.onLine;
  document.getElementById('sun-live').hidden = offline;
  document.getElementById('sun-down').hidden = !offline;
}
window.addEventListener('online', checkViewer);
window.addEventListener('offline', checkViewer);
checkViewer();

// ---------- live status row ----------
// These values are SAMPLE values that move on their own. To use real data,
// replace the refresh() function below with a fetch() from a public space-weather feed.
// Add ?data=down to the page address to preview the "unavailable" look.
var dataDown = location.search.indexOf('data=down') !== -1;
var flareWords = ['Quiet', 'Moderate', 'High'];
var auroraWords = ['Calm', 'Active', 'Storm'];
var dotColors = ['#7FC8F8', '#E0A458', '#D9776B'];
var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function clock() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function seedHistory() {
  var list = [];
  var value = 405;
  for (var n = 0; n < 72; n++) {
    value += Math.sin(n * 0.37) * 9 + Math.cos(n * 0.11) * 6;
    list.push(Math.round(value));
  }
  list[71] = 398;
  return list;
}

var live = {
  ago: 4, lastClock: clock(),
  flare: 0, aurora: 0, kp: 1,
  wind: 398, windShown: 398,
  spots: 28, spotsShown: 28, regions: 9,
  history: seedHistory()
};

function byId(id) { return document.getElementById(id); }

// Changes text only if it is different, so screen readers are not interrupted for nothing.
function setText(id, text) {
  var el = byId(id);
  if (el.textContent !== String(text)) el.textContent = text;
}

function fade(id) {
  var el = byId(id);
  el.classList.remove('fa');
  void el.offsetWidth;
  el.classList.add('fa');
}

function drawStatus() {
  var s = live;
  var ago = s.ago < 60 ? s.ago + ' s' : Math.floor(s.ago / 60) + ' min';
  var last = s.lastClock;

  byId('live-dot').className = dataDown ? 'live-dot off' : 'live-dot';
  setText('live-word', dataDown ? 'Offline' : 'Live');
  setText('updated-text', dataDown ? 'Live data unavailable · last successful update ' + last : 'Updated ' + ago + ' ago');
  setText('updated-sr', dataDown ? 'Live data unavailable. Last successful update at ' + last + '.' : 'Last updated at ' + last + '.');

  setText('flare-word', dataDown ? 'Unavailable' : flareWords[s.flare]);
  byId('flare-dot').style.background = dataDown ? 'transparent' : dotColors[s.flare];
  setText('flare-sr', dataDown ? 'Solar flare activity: unavailable.' : 'Solar flare activity: ' + flareWords[s.flare] + '. Sample value.');

  setText('wind-num', dataDown ? 'Unavailable' : s.windShown);
  setText('wind-unit', dataDown ? '' : 'km/s');
  byId('spark').toggleAttribute('hidden', dataDown); // an SVG needs the attribute, not .hidden
  byId('wind-sub').hidden = !dataDown;
  setText('wind-sub', 'Last update ' + last);
  setText('wind-sr', dataDown ? 'Solar wind speed: unavailable.' : 'Solar wind speed: ' + s.wind + ' kilometers per second. Sample value.');
  var points = [];
  for (var n = 0; n < s.history.length; n++) {
    var x = (n * 120 / 71).toFixed(1);
    var y = (22 - (s.history[n] - 300) / (660 - 300) * 22).toFixed(1);
    points.push(x + ',' + y);
  }
  byId('spark-line').setAttribute('points', points.join(' '));

  setText('aurora-word', dataDown ? 'Unavailable' : auroraWords[s.aurora]);
  byId('aurora-dot').style.background = dataDown ? 'transparent' : dotColors[s.aurora];
  setText('kp-text', dataDown ? 'Last update ' + last : 'Kp ' + s.kp);
  setText('aurora-sr', dataDown ? 'Aurora activity: unavailable.' : 'Aurora activity: ' + auroraWords[s.aurora] + ', Kp index ' + s.kp + '. Sample value.');

  setText('spots-num', dataDown ? 'Unavailable' : s.spotsShown);
  setText('regions-text', dataDown ? 'Last update ' + last : 'in ' + s.regions + ' regions');
  setText('spots-sr', dataDown ? 'Sunspots: unavailable.' : 'Sunspots: ' + s.spots + ' in ' + s.regions + ' regions. Sample value.');
}

function randomBetween(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function clamp(n, low, high) { return Math.max(low, Math.min(high, n)); }

// Every 9 seconds, make up new sample values. Replace this with real data later.
function refresh() {
  if (dataDown) return;
  var s = live;
  var oldFlare = s.flare, oldAurora = s.aurora;
  s.wind = clamp(s.wind + randomBetween(-28, 28), 320, 640);
  if (Math.random() < 0.3) s.flare = clamp(s.flare + (Math.random() < 0.5 ? -1 : 1), 0, 2);
  if (Math.random() < 0.3) s.aurora = clamp(s.aurora + (Math.random() < 0.5 ? -1 : 1), 0, 2);
  s.kp = s.aurora === 0 ? randomBetween(1, 3) : (s.aurora === 1 ? 4 : randomBetween(5, 6));
  if (Math.random() < 0.4) s.spots = Math.max(0, s.spots + randomBetween(-3, 3));
  if (Math.random() < 0.2) s.regions = Math.max(1, s.regions + randomBetween(-1, 1));
  s.history = s.history.slice(1).concat([s.wind]);
  s.ago = 0;
  s.lastClock = clock();
  drawStatus();
  if (s.flare !== oldFlare) fade('flare-word');
  if (s.aurora !== oldAurora) fade('aurora-word');
}

// Makes the numbers count up or down smoothly toward the new value.
function stepToward(shown, target) {
  if (shown === target) return shown;
  if (reduceMotion) return target;
  var difference = target - shown;
  var step = Math.max(1, Math.round(Math.abs(difference) / 5));
  return shown + (difference > 0 ? step : -step);
}

function tick() {
  var newWind = stepToward(live.windShown, live.wind);
  var newSpots = stepToward(live.spotsShown, live.spots);
  if (newWind !== live.windShown || newSpots !== live.spotsShown) {
    live.windShown = newWind;
    live.spotsShown = newSpots;
    drawStatus();
  }
}

drawStatus();
setInterval(function () { live.ago++; drawStatus(); }, 1000);
setInterval(refresh, 9000);
setInterval(tick, 60);
