// ORBEATS Play tab tests. Run with:   node tests/run.js
// Needs Playwright once:              npm install --no-save playwright && npx playwright install chromium
//
// Optional camera test with Chrome's fake webcam (any short video of a hand, in .y4m or .mjpeg format):
//   HAND_VIDEO=/path/to/hand.y4m node tests/run.js
//
// The tests open play.html?fast=1 . "fast" skips waiting for speech and shortens the sounds.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };
let failures = 0;

function check(name, ok, detail) {
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  (' + detail + ')' : ''));
  if (!ok) failures++;
}

// A tiny static file server, so the tests need nothing else installed.
function startServer() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, () => resolve(server)));
}

const state = page => page.evaluate(() => ({ state: game.state, hits: game.hits, misses: game.misses, score: game.score, streak: game.streak, wrong: game.wrongLane, dataset: game.dataset, control: play.control, handLane: game.handLane, tiles: game.tiles.map(t => ({ lane: t.lane, state: t.state, time: t.time })), caption: document.getElementById('game-caption').textContent }));
const waitState = (page, name) => page.waitForFunction(n => game.state === n, name, { timeout: 20000 });
// wait until tile number i is `lead` ms away from the line (checked every animation frame)
const waitTile = (page, i, lead) => page.waitForFunction(([n, l]) => performance.now() >= game.tiles[n].time - l, [i, lead || 0], { polling: 'raf', timeout: 20000 });
// let the page play every remaining tile by itself (sends real keydown events at the right moment)
const autoPlay = page => page.evaluate(() => {
  const loop = () => {
    if (game.state !== 'playing') return;
    const now = performance.now();
    game.tiles.forEach(t => { if (t.state === 'wait' && now >= t.time && !t.auto) { t.auto = true; document.dispatchEvent(new KeyboardEvent('keydown', { key: String(t.lane + 1), bubbles: true })); } });
    requestAnimationFrame(loop);
  };
  loop();
});

async function newPage(browser, url, options) {
  const context = await browser.newContext(options || {});
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  // MediaPipe prints harmless "INFO:" lines through console.error, so those are ignored
  page.on('console', m => { if (m.type() === 'error' && !/^INFO:/.test(m.text())) page.errors.push(m.text()); });
  await page.goto(url);
  return page;
}

// ---------- 1. keyboard only ----------
async function keyboardTest(browser, url) {
  console.log('Keyboard-only path');
  const page = await newPage(browser, url);
  await page.keyboard.press('Tab');                 // real key presses only, no mouse
  await page.focus('#at-stage');
  await page.keyboard.press('3');                   // before the song a lane only plays its note
  let s = await state(page);
  check('a lane key before the song does nothing to the game', s.state === 'idle' && s.hits === 0);
  await page.keyboard.press('Enter');
  await waitState(page, 'playing');
  s = await state(page);
  check('Enter starts a song of 24 tiles from two years', s.tiles.length === 24 && (await page.evaluate(() => game.years[1] - game.years[0])) === 1, s.tiles.length + ' tiles');
  check('tiles use all lanes in range', s.tiles.every(t => t.lane >= 0 && t.lane <= 3));

  // tile 0: hit with the right key
  await waitTile(page, 0, 20);
  await page.keyboard.press(String(s.tiles[0].lane + 1));
  s = await state(page);
  check('the right lane key hits the tile', s.tiles[0].state === 'hit' && s.hits === 1 && s.score >= 60, 'score ' + s.score);

  // tile 1: the wrong lane breaks the streak and leaves the tile in play
  await waitTile(page, 1, 20);
  await page.keyboard.press(String((s.tiles[1].lane + 1) % 4 + 1));
  s = await state(page);
  check('the wrong lane resets the streak', s.wrong === 1 && s.streak === 0 && s.tiles[1].state === 'wait');
  await page.waitForFunction(() => game.tiles[1].state === 'miss', null, { timeout: 5000 });
  check('a tile that is not hit becomes a miss', (await state(page)).misses === 1);

  await autoPlay(page);
  await waitState(page, 'over');
  await page.waitForFunction(() => /made from/.test(window.__captions.join(' ')), null, { timeout: 10000 });
  s = await state(page);
  check('song ends with a spoken score', /You hit \d+ of 24 tiles/.test(await page.evaluate(() => window.__captions.join(' '))));
  check('then says which data made the melody', /made from/.test(await page.evaluate(() => window.__captions.join(' '))));
  check('progress shows all tiles played', (await page.textContent('#at-round')) === '24 of 24 tiles played');
  await page.keyboard.press('Enter');
  await waitState(page, 'playing');
  s = await state(page);
  check('Enter plays again with a fresh score', s.hits === 0 && s.score === 0);
  await page.keyboard.press('Escape');
  s = await state(page);
  check('Escape stops the song', s.state === 'idle');
  await page.keyboard.press('ArrowRight');
  s = await state(page);
  check('right arrow changes the dataset', s.dataset === 1);
  await page.keyboard.press('ArrowLeft');

  // touch: tapping a lane button hits
  await page.focus('#at-stage'); await page.keyboard.press('Enter'); await waitState(page, 'playing');
  s = await state(page);
  await waitTile(page, 0, 20);
  await page.click('#at-lanes button[data-lane="' + s.tiles[0].lane + '"]');
  check('tapping the lane button hits', (await state(page)).hits === 1);
  await page.keyboard.press('Escape');

  // switches
  await page.click('#relaxed-switch');
  await page.focus('#at-stage'); await page.keyboard.press('Enter'); await waitState(page, 'playing');
  const gap = await page.evaluate(() => game.tiles[1].time - game.tiles[0].time);
  check('Relaxed timing slows the song down', Math.abs(gap - 675) < 2, gap + ' ms between tiles');
  await page.keyboard.press('Escape');
  await page.click('#game-mode');
  check('Game mode off hides the score and shows free play', await page.isHidden('#at-scorebox') && await page.isVisible('#at-free'));
  await page.click('[data-game="0"]');
  s = await state(page);
  check('game switch off hides the game', s.state === 'idle' && await page.isVisible('#at-off') && await page.isHidden('#at-body'));
  await page.click('[data-game="0"]');
  await page.click('[data-action="text-bigger"]'); await page.click('[data-setting="hc"]');
  check('text size and high contrast apply to the game', await page.evaluate(() => document.getElementById('app').classList.contains('hc') && document.getElementById('app').style.fontSize.includes('1.15')));
  await page.click('[data-setting="cc"]'); await page.waitForTimeout(50);
  check('captions off hides the caption but keeps it for screen readers', await page.evaluate(() => document.getElementById('game-caption').classList.contains('sr')));
  check('caption is an ARIA live region', await page.getAttribute('#game-caption', 'aria-live') !== null);
  check('no page errors', page.errors.length === 0, page.errors.join(' | '));
  await page.context().close();
}

// ---------- 2. camera denied ----------
async function deniedTest(browser, url) {
  console.log('Camera denied path');
  const page = await newPage(browser, url);          // no camera permission is granted
  await page.check('input[value="camera"]');
  await page.waitForFunction(() => play.control === 'keyboard', null, { timeout: 15000 });
  const s = await state(page);
  check('falls back to keyboard automatically', s.control === 'keyboard');
  check('says so in the caption', /keyboard and touch/.test(s.caption), s.caption.slice(0, 70));
  check('camera panel is hidden again', await page.isHidden('#camera-box'));
  await page.focus('#at-stage'); await page.keyboard.press('Enter');
  await waitState(page, 'playing');
  check('game is still playable by keyboard', true);
  check('no page errors', page.errors.length === 0, page.errors.join(' | '));
  await page.context().close();
}

// ---------- 3. gestures (hand landmarks are fed straight into the engine) ----------
// Builds 21 fake hand points. Image coordinates: x 0..1 left to right, y 0..1 top to bottom.
function handScript() {
  window.fakeHand = function (o) {
    const cx = o.x === undefined ? 0.5 : 1 - o.x, cy = o.y === undefined ? 0.5 : 1 - o.y;   // o.x / o.y are in engine terms (mirrored, up = 1)
    const p = []; for (let i = 0; i < 21; i++) p.push({ x: cx, y: cy, z: 0 });
    p[0] = { x: cx, y: cy + 0.15 };
    const knuckles = [[5, -0.04, 0], [9, 0, 0], [13, 0.035, 0.005], [17, 0.07, 0.02]];
    knuckles.forEach(([k, dx, dy], f) => {
      const up = f < (o.fingers || 0);
      p[k] = { x: cx + dx, y: cy + dy };
      p[k + 1] = { x: cx + dx, y: cy + dy - (up ? 0.06 : 0.04) };
      p[k + 2] = { x: cx + dx, y: cy + dy - (up ? 0.1 : 0.0) };
      p[k + 3] = { x: cx + dx, y: cy + dy - (up ? 0.13 : -0.03) };
    });
    p[4] = o.thumbOut ? { x: cx - 0.13, y: cy + 0.02 } : { x: cx - 0.05, y: cy + 0.04 };
    if (o.pinch) { p[8] = { x: cx - 0.07, y: cy - 0.03 }; p[4] = { x: cx - 0.08, y: cy - 0.02 }; }
    return p;
  };
  // Feed one hand shape 30 times a second for some milliseconds. shape can be a function of progress 0..1.
  window.hold = function (shape, ms) {
    return new Promise(resolve => {
      const start = performance.now();
      const timer = setInterval(() => {
        const t = (performance.now() - start) / ms;
        HandEngine.feed(shape === null ? null : fakeHand(typeof shape === 'function' ? shape(Math.min(1, t)) : shape));
        if (t >= 1) { clearInterval(timer); resolve(); }
      }, 33);
    });
  };
  window.__events = [];
  ['hand', 'pinch', 'pose', 'fingers', 'swipe'].forEach(n => HandEngine.on(n, e => window.__events.push(n + ':' + JSON.stringify(e))));
}

async function gestureTest(browser, url) {
  console.log('Hand gestures (simulated landmarks)');
  const page = await newPage(browser, url);
  await page.evaluate(handScript);
  const events = () => page.evaluate(() => { const e = window.__events; window.__events = []; return e; });

  await page.evaluate(() => hold({ fingers: 2 }, 700));
  let e = await events();
  check('hand found event', e.includes('hand:{"present":true}'));
  check('2 fingers counted', e.includes('fingers:{"count":2}'), e.join(' '));
  await page.evaluate(() => hold({ fingers: 4, thumbOut: true }, 700));
  e = await events();
  check('open palm detected', e.includes('pose:{"pose":"open"}'), e.join(' '));
  await page.evaluate(() => hold({ fingers: 0 }, 700));
  e = await events();
  check('fist detected', e.includes('pose:{"pose":"fist"}'), e.join(' '));
  await page.evaluate(() => hold({ fingers: 3 }, 600).then(() => hold({ fingers: 3, pinch: true }, 400)).then(() => hold({ fingers: 3 }, 500)));
  e = await events();
  check('pinch down and up, once each (no flicker)', e.filter(x => x.startsWith('pinch')).join() === 'pinch:{"down":true},pinch:{"down":false}', e.join(' '));
  await page.evaluate(() => hold({ fingers: 4, x: 0.2 }, 1500).then(() => hold(t => ({ fingers: 4, x: 0.2 + 0.6 * t }), 350)));
  e = await events();
  check('swipe right detected', e.includes('swipe:{"direction":"right"}'), e.join(' '));
  await page.evaluate(() => hold(t => ({ fingers: 4, y: 0.2 + 0.6 * t }), 600));
  const pos = await page.evaluate(() => HandEngine.position());
  check('palm position follows the hand, smoothed, up = 1', pos.y > 0.7 && pos.y <= 1, 'y ' + pos.y.toFixed(2));
  await page.evaluate(() => hold(null, 800));
  e = await events();
  check('hand lost event', e.includes('hand:{"present":false}'));

  // Play with the hand only: pinch starts the song, move into a lane, pinch to hit
  await page.evaluate(() => stopGame());     // the pinch test above already started a song: begin fresh
  await page.evaluate(() => hold({ fingers: 1, x: 0.9 }, 500));
  let s = await state(page);
  check('hand position picks a lane (right side = lane 4)', s.handLane === 3, 'lane ' + s.handLane);
  await page.evaluate(() => hold({ fingers: 1, x: 0.1 }, 500));
  s = await state(page);
  check('hand position picks a lane (left side = lane 1)', s.handLane === 0, 'lane ' + s.handLane);
  await page.evaluate(() => hold({ fingers: 1 }, 300).then(() => hold({ fingers: 1, pinch: true }, 400)));   // pinch starts the song
  await waitState(page, 'playing');
  check('pinch starts the song', true);
  await page.evaluate(() => hold({ fingers: 1, x: 0.5 }, 300));       // pinch is over: hand is open again
  s = await state(page);
  const lane0 = s.tiles[1].lane;        // tile 1: by now tile 0 has already gone past
  await page.evaluate(n => hold({ fingers: 1, x: (n + 0.5) / 4 }, 250), lane0);
  await waitTile(page, 1, 150);
  await page.evaluate(n => hold({ fingers: 1, x: (n + 0.5) / 4, pinch: true }, 300), lane0);
  s = await state(page);
  check('moving into the lane and pinching hits the tile', s.tiles[1].state === 'hit', 'tile 1: ' + s.tiles[1].state + ', lane ' + lane0 + ', hand lane ' + s.handLane);
  const before = (await state(page)).dataset;
  await page.evaluate(() => hold({ fingers: 4, x: 0.2 }, 1500).then(() => hold(t => ({ fingers: 4, x: 0.2 + 0.6 * t }), 350)));
  check('swiping during a song does not change the dataset', (await state(page)).dataset === before);
  await page.evaluate(() => hold({ fingers: 0 }, 900));
  s = await state(page);
  check('a held fist stops the song', s.state === 'idle', s.state);
  await page.evaluate(() => hold({ fingers: 4, x: 0.5 }, 1500).then(() => hold(t => ({ fingers: 4, x: 0.5 - 0.4 * t }), 350)));
  await page.waitForFunction(b => game.dataset !== b, before, { timeout: 15000 });
  check('swipe between songs changes the dataset', true);
  check('no page errors', page.errors.length === 0, page.errors.join(' | '));
  await page.context().close();
}

// ---------- 4. real camera pipeline with Chrome's fake webcam ----------
async function cameraTest(url, video) {
  console.log('Camera path with fake webcam: ' + video);
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + video, '--autoplay-policy=no-user-gesture-required'] });
  const page = await newPage(browser, url, { permissions: ['camera'] });
  await page.evaluate(() => {
    window.__hand = []; window.__seen = { x0: 1, x1: 0, y0: 1, y1: 0 };
    HandEngine.on('hand', e => window.__hand.push(e.present));
    HandEngine.on('move', e => { const s = window.__seen; s.x0 = Math.min(s.x0, e.x); s.x1 = Math.max(s.x1, e.x); s.y0 = Math.min(s.y0, e.y); s.y1 = Math.max(s.y1, e.y); });
    window.__long = 0;
    new PerformanceObserver(list => { window.__long += list.getEntries().filter(e => e.duration > 100).length; }).observe({ entryTypes: ['longtask'] });
  });
  await page.check('input[value="camera"]');
  await page.waitForFunction(() => HandEngine.running, null, { timeout: 60000 });
  check('camera starts and the model loads from vendor/', true);
  check('privacy note is shown', /nothing is recorded/i.test(await page.textContent('#camera-box')));
  await page.waitForFunction(() => window.__hand.includes(true), null, { timeout: 30000 });
  check('a real hand is found in the video', true);
  await page.evaluate(() => { window.__long = 0; });
  await page.focus('#at-stage'); await page.keyboard.press('Enter');     // play while tracking, to check for freezes
  await page.waitForTimeout(13000);
  const r = await page.evaluate(() => ({ fps: HandEngine.fps, delegate: HandEngine.delegate, seen: window.__seen, lost: window.__hand.includes(false), long: window.__long, audio: voice.ctx ? voice.ctx.state : 'none' }));
  check('hand position follows movement up-down', r.seen.y1 - r.seen.y0 > 0.15, (r.seen.y1 - r.seen.y0).toFixed(2));
  check('hand position follows movement left-right', r.seen.x1 - r.seen.x0 > 0.15, (r.seen.x1 - r.seen.x0).toFixed(2));
  check('hand lost is reported when the hand leaves', r.lost);
  console.log('  info tracking speed: ' + r.fps + ' frames per second on ' + r.delegate + ', long freezes (>100 ms): ' + r.long + ', audio: ' + r.audio);
  await page.screenshot({ path: path.join(__dirname, 'camera.png') });
  await page.click('#use-keyboard');
  check('"Use keyboard or touch instead" turns the camera off', await page.evaluate(() => !HandEngine.running && play.control === 'keyboard'));
  check('no page errors', page.errors.length === 0, page.errors.join(' | '));
  await browser.close();
}

(async () => {
  const server = await startServer();
  const url = 'http://localhost:' + server.address().port + '/play.html?fast=1';
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  // every page records the captions it has shown
  const init = () => { window.__captions = []; document.addEventListener('DOMContentLoaded', () => { const box = document.getElementById('game-caption'); if (box) new MutationObserver(() => window.__captions.push(box.textContent)).observe(box, { childList: true, characterData: true, subtree: true }); }); };
  const realNewContext = browser.newContext.bind(browser);
  browser.newContext = async o => { const c = await realNewContext(o); await c.addInitScript(init); return c; };

  await keyboardTest(browser, url);
  await deniedTest(browser, url);
  await gestureTest(browser, url);
  await browser.close();
  if (process.env.HAND_VIDEO) await cameraTest(url, process.env.HAND_VIDEO);
  else console.log('Camera path skipped (set HAND_VIDEO=/path/to/hand.y4m to run it)');
  server.close();
  console.log(failures ? '\n' + failures + ' check(s) FAILED' : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})();
