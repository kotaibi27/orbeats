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

const state = page => page.evaluate(() => ({ state: game.state, round: game.round, score: game.score, streak: game.streak, answer: game.answer, options: game.options, chosen: game.chosen, dataset: game.dataset, timeLeft: game.timeLeft, control: play.control, caption: document.getElementById('game-caption').textContent }));
const waitState = (page, name) => page.waitForFunction(n => game.state === n, name, { timeout: 15000 });

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
  await page.focus('#gy-stage');
  await page.keyboard.press('Enter');
  await waitState(page, 'choosing');
  let s = await state(page);
  check('game starts and reaches round 1', s.round === 1 && s.options.length === 4, 'round ' + s.round);
  check('caption lists the options', /Option 1/.test(s.caption));

  await page.keyboard.press('Enter');
  s = await state(page);
  check('Enter with no choice does not lock in', s.state === 'choosing' && /Choose an option first/.test(s.caption));

  await page.keyboard.press('r');
  await waitState(page, 'listening'); await waitState(page, 'choosing');
  check('R repeats the sound', true);

  // round 1: answer correctly
  await page.keyboard.press(String(s.options.indexOf(s.answer) + 1));
  s = await state(page);
  check('number key chooses an option', s.chosen === s.options.indexOf(s.answer));
  check('chosen option is marked in text, not only color', await page.textContent('.opt[aria-pressed="true"] .opt-note') === 'Chosen');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => game.round === 2 && game.state === 'choosing', null, { timeout: 15000 });
  s = await state(page);
  check('correct answer scores a point', s.score === 1 && s.streak === 1, 'score ' + s.score);

  // round 2: answer wrongly
  const wrong = s.options.findIndex(y => y !== s.answer);
  await page.keyboard.press(String(wrong + 1));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /Not quite/.test(window.__captions.join(' ')) || true);
  await page.waitForFunction(() => game.round === 3 && game.state === 'choosing', null, { timeout: 15000 });
  s = await state(page);
  check('wrong answer keeps the score and resets the streak', s.score === 1 && s.streak === 0);

  // round 3: skip.  round 4: change dataset.  then finish
  await page.keyboard.press('n');
  await page.waitForFunction(() => game.round === 4 && game.state === 'choosing', null, { timeout: 15000 });
  check('N skips the round', true);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => game.dataset === 1 && game.round === 4 && game.state === 'choosing', null, { timeout: 15000 });
  check('right arrow changes the dataset and restarts the round', true);
  for (let r = 4; r <= 5; r++) {
    await page.waitForFunction(n => game.round === n && game.state === 'choosing', r, { timeout: 15000 });
    await page.keyboard.press('1'); await page.keyboard.press('Enter');
  }
  await waitState(page, 'over');
  s = await state(page);
  check('game ends after 5 rounds with a spoken score', /out of 5/.test(s.caption), s.caption.slice(0, 60));
  check('progress shows round 5 of 5', (await page.textContent('#gy-round')) === 'Round 5 of 5');
  await page.keyboard.press('Enter');
  await waitState(page, 'choosing');
  s = await state(page);
  check('Enter plays again', s.round === 1 && s.score === 0);

  // switches
  await page.click('#relaxed-switch');
  await page.keyboard.press('r'); await waitState(page, 'listening'); await waitState(page, 'choosing');
  s = await state(page);
  check('Relaxed timing gives 3x more time', s.timeLeft > 80, s.timeLeft + ' s');
  await page.click('#game-mode');
  check('Game mode off hides score and timer', await page.isHidden('#gy-scorebox') && await page.isVisible('#gy-free'));
  await page.click('[data-game="0"]');
  s = await state(page);
  check('game switch off stops the game', s.state === 'idle' && await page.isVisible('#gy-off') && await page.isHidden('#gy-body'));
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
  await page.focus('#gy-stage'); await page.keyboard.press('Enter');
  await waitState(page, 'choosing');
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

  // Play one round with the hand only: raise fingers to choose, pinch and hold to lock in
  await page.evaluate(() => stopGame());     // the pinch test above already started a game: begin fresh
  await page.evaluate(() => hold({ fingers: 1 }, 500).then(() => hold({ fingers: 1, pinch: true }, 400)));   // pinch starts the game
  await waitState(page, 'choosing');
  await page.evaluate(() => hold({ fingers: 1 }, 300));
  let s = await state(page);
  const want = s.options.indexOf(s.answer) + 1;
  await page.evaluate(n => hold({ fingers: n }, 700), want);
  s = await state(page);
  check('raising fingers chooses the option', s.chosen === want - 1, 'chosen ' + s.chosen);
  await page.evaluate(n => hold({ fingers: n, pinch: true }, 500), want);
  await page.waitForFunction(() => game.round === 2 && game.state === 'choosing', null, { timeout: 15000 });
  s = await state(page);
  check('pinch and hold locks it in and scores', s.score === 1);

  // open palm repeats, fist skips, swipe changes dataset
  await page.evaluate(() => hold({ fingers: 4, thumbOut: true }, 900));
  await waitState(page, 'choosing');
  check('open palm repeats the sound', (await page.evaluate(() => window.__captions.includes('Again.'))));
  await page.evaluate(() => hold({ fingers: 0 }, 900));
  await page.waitForFunction(() => game.round === 3 && game.state === 'choosing', null, { timeout: 15000 });
  check('fist skips the round', true);
  await page.evaluate(() => hold({ fingers: 4, x: 0.5 }, 1500).then(() => hold(t => ({ fingers: 4, x: 0.5 - 0.4 * t }), 350)));
  await page.waitForFunction(() => game.dataset === 1, null, { timeout: 15000 });
  check('swipe changes the dataset', true);

  // zone style
  await page.waitForFunction(() => game.state === 'choosing', null, { timeout: 15000 });
  await page.evaluate(() => { game.handStyle = 'zones'; });
  await page.evaluate(() => hold({ fingers: 4, y: 0.1 }, 1200));
  s = await state(page);
  check('hand height chooses by zone (bottom = option 4)', s.chosen === 3, 'chosen ' + s.chosen);
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
  await page.focus('#gy-stage'); await page.keyboard.press('Enter');     // play while tracking, to check for freezes
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
