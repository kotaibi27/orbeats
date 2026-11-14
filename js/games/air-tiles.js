// GAME: AIR TILES
// Tiles fall down 4 lanes. When a tile reaches the line at the bottom, hit its lane to play its note.
// The notes come from a NASA dataset (js/games/air-tiles-data.js): a bigger number is a higher note
// and a tile further to the right. So the song you play is the shape of the data.
//
// HOW YOU HIT A TILE
//   Hand:      move your hand left or right into a lane, then pinch (thumb and index finger)
//   Keyboard:  press 1, 2, 3 or 4
//   Touch:     tap one of the four lane buttons
// You can play with your eyes closed: a soft note is played in the right lane (left ear to right ear)
// at the exact moment the tile reaches the line.
//
// Needs js/app.js, js/voice.js, js/hands.js, js/play.js and js/games/air-tiles-data.js first.

// ---------- numbers you can tune ----------
var LANES = 4;
var BEAT_MS = 900;          // time between two tiles
var FALL_MS = 2400;         // how long a tile takes to fall to the line
var WINDOW_MS = 260;        // a hit counts if it is up to this early or late
var PERFECT_MS = 110;       // ...and is "Perfect" if it is this close
var COUNT_IN_MS = 2400;     // quiet time before the first tile arrives
var FIST_STOP_MS = 2000;    // hold a fist this long to stop a song
var RELAXED_WINDOW = 2.5;   // Relaxed timing: hit window is this many times wider...
var RELAXED_SLOW = 1.5;     // ...and everything is this many times slower
var NOTE_STEPS = [0, 2, 4, 7, 9, 12, 14, 16];   // 8 notes of a pentatonic scale: always sounds pleasant
var LANE_NAMES = ['Low', 'Mid low', 'Mid high', 'High'];
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// The test mode (?fast=1) makes a song short. The hit window stays the same.
function beatMs() { return (voice.fast ? 450 : BEAT_MS) * (game.relaxed ? RELAXED_SLOW : 1); }
function fallMs() { return (voice.fast ? 1000 : FALL_MS) * (game.relaxed ? RELAXED_SLOW : 1); }
function windowMs() { return WINDOW_MS * (game.relaxed ? RELAXED_WINDOW : 1); }

var game = {
  state: 'idle',        // 'idle', 'countdown', 'playing' or 'over'
  dataset: 0,           // which dataset in AIR_TILES_DATA
  tiles: [],            // the tiles of the song: { lane, freq, loud, time, month, state }
  years: [0, 0],        // the two years this song is made from
  score: 0, streak: 0, bestStreak: 0,
  hits: 0, perfects: 0, misses: 0, wrongLane: 0,
  handLane: -1,         // the lane the hand is in (-1 = no hand)
  relaxed: false,       // Relaxed timing switch
  introduced: false,    // the long spoken explanation is only read the first time
  token: 0,             // changes whenever a new step starts, so old async code can stop itself
  flash: [0, 0, 0, 0],  // when each lane was last hit (for the little flash)
  frame: null           // the animation loop
};

function $(id) { return document.getElementById(id); }
function gameIsOn() { return play.games[0]; }                    // the Air Tiles on/off switch on this page
function inSong() { return game.state === 'countdown' || game.state === 'playing'; }
function datasetTitle() { return AIR_TILES_DATA[game.dataset].title; }

// Show text in the caption box WITHOUT speaking it (used during the song, where speech would drown the music).
function caption(text) { var box = $('game-caption'); if (box) box.textContent = text; }

// ---------- turning data into a song ----------

// The lowest and highest number in a dataset, over all its years.
function datasetRange(data) {
  var low = Infinity, high = -Infinity;
  Object.keys(data.years).forEach(function (year) {
    data.years[year].forEach(function (value) { low = Math.min(low, value); high = Math.max(high, value); });
  });
  return { low: low, high: high };
}

// Build the 24 tiles from two years in a row (chosen at random).
function buildSong() {
  var data = AIR_TILES_DATA[game.dataset];
  var years = Object.keys(data.years).map(Number).sort();
  var first = Math.floor(Math.random() * Math.max(1, years.length - 1));
  var chosen = years.slice(first, first + 2);
  game.years = chosen;
  var range = datasetRange(data);
  var spread = Math.max(range.high - range.low, 1e-9);
  var tiles = [];
  chosen.forEach(function (year) {
    var values = data.years[year];
    values.forEach(function (value, month) {
      var share = (value - range.low) / spread;                               // 0 (lowest) to 1 (highest)
      var step = Math.min(NOTE_STEPS.length - 1, Math.floor(share * NOTE_STEPS.length));   // 0 to 7
      tiles.push({
        lane: Math.min(LANES - 1, Math.floor(step / 2)),                     // two notes per lane
        freq: 261.63 * Math.pow(2, NOTE_STEPS[step] / 12),                   // C4 and up
        loud: 0.12 + 0.18 * share,                                           // bigger value = louder
        value: value,
        month: values.length === 12 ? month : -1,
        time: 0, state: 'wait', cued: false
      });
    });
  });
  return tiles;
}

function lanePan(lane) { return -0.75 + lane * 0.5; }
function laneFreq(lane) { return 261.63 * Math.pow(2, NOTE_STEPS[lane * 2] / 12); }

// ---------- starting and stopping ----------

function newStep() { stopSpeaking(); return ++game.token; }
function stale(my) { return my !== game.token; }

async function startGame() {
  if (!gameIsOn() || inSong()) return;
  var my = newStep();
  var data = AIR_TILES_DATA[game.dataset];
  game.tiles = buildSong();
  game.score = 0; game.streak = 0; game.bestStreak = 0;
  game.hits = 0; game.perfects = 0; game.misses = 0; game.wrongLane = 0;
  game.state = 'countdown';
  getAudio();     // the first click or key press lets the browser play sound
  drawGame();

  if (!game.introduced) {
    game.introduced = true;
    var how = play.control === 'camera' ? 'Move your hand into a lane, then pinch to hit.'
      : play.control === 'touch' ? 'Tap a lane button to hit.' : 'Press 1, 2, 3 or 4 to hit.';
    await say('Air Tiles. Tiles fall down four lanes. When a tile reaches the line, a soft note plays in its lane. ' +
      'Hit the same lane to play the note loudly. Lane 1 on the left is the lowest note, lane 4 on the right is the highest. ' + how);
    if (stale(my)) return;
  }
  await say((data.placeholder ? 'Sample data: ' : '') + datasetTitle() + '. ' + data.hint + ' Get ready.');
  if (stale(my)) return;

  // The first tile reaches the line COUNT_IN_MS after the song starts.
  var begin = performance.now() + (voice.fast ? 800 : COUNT_IN_MS);
  game.tiles.forEach(function (tile, i) { tile.time = begin + i * beatMs(); });
  game.state = 'playing';
  caption('Playing. Hit each tile as it reaches the line.');
  startLoop();
  drawGame();
}

function stopGame() {
  game.token++;
  stopSpeaking();
  stopLoop();
  game.state = 'idle';
  drawGame();
}

async function endGame() {
  var my = newStep();
  stopLoop();
  game.state = 'over';
  drawGame();
  var total = game.tiles.length;
  var data = AIR_TILES_DATA[game.dataset];
  var text = 'The song is finished.';
  if (play.mode) {
    text += ' You hit ' + game.hits + ' of ' + total + ' tiles. Score ' + game.score + '. Best streak ' + game.bestStreak + '.';
  }
  await say(text);
  if (stale(my)) return;
  var top = game.tiles.reduce(function (best, tile) { return tile.value > best.value ? tile : best; }, game.tiles[0]);
  var fact = 'That melody was made from ' + (data.placeholder ? 'sample data for ' : '') + datasetTitle() + ', ' + game.years.join(' and ') + '.';
  if (top.month >= 0) fact += ' The highest note was in ' + MONTHS[top.month] + '.';
  await say(fact);
  if (stale(my)) return;
  say('Pinch, or press Enter, to play again.');
}

// ---------- hitting tiles ----------

function showFeedback(text) {
  $('at-feedback').textContent = text;
  clearTimeout(showFeedback.timer);
  showFeedback.timer = setTimeout(function () { $('at-feedback').textContent = ''; }, 800);
}

function hitLane(lane) {
  if (!gameIsOn()) return;
  // Outside a song, a lane just plays its note, so you can learn what each lane sounds like.
  if (game.state !== 'playing') { beep(laneFreq(lane), 0.4, 0.2, 0, lanePan(lane), 'triangle'); return; }

  var now = performance.now();
  var best = null, other = null;
  game.tiles.forEach(function (tile) {
    if (tile.state !== 'wait') return;
    var distance = Math.abs(now - tile.time);
    if (distance > windowMs()) return;
    if (tile.lane === lane) { if (!best || distance < Math.abs(now - best.time)) best = tile; }
    else other = tile;
  });

  if (best) {
    var perfect = Math.abs(now - best.time) <= PERFECT_MS * (game.relaxed ? RELAXED_WINDOW : 1);
    best.state = 'hit';
    game.hits++; game.streak++;
    if (perfect) game.perfects++;
    game.bestStreak = Math.max(game.bestStreak, game.streak);
    game.score += perfect ? 100 : 60;
    game.flash[lane] = now;
    beep(best.freq, 0.6, best.loud + 0.1, 0, lanePan(lane), 'triangle');      // the note the player makes
    showFeedback(perfect ? 'Perfect' : 'Good');
    if (game.streak % 5 === 0) caption('Streak of ' + game.streak + '.');
  } else if (other) {
    game.streak = 0; game.wrongLane++;
    SOUNDS.wrong();
    showFeedback('Wrong lane');
  } else {
    beep(150, 0.08, 0.08, 0, lanePan(lane));       // pressed with no tile near: a soft thud, no penalty
    showFeedback('No tile');
  }
  drawGame();
}

// ---------- the animation loop ----------

function startLoop() {
  stopLoop();
  function tick() {
    if (!inSong()) return;
    update();
    drawCanvas();
    game.frame = requestAnimationFrame(tick);
  }
  game.frame = requestAnimationFrame(tick);
}
function stopLoop() { if (game.frame) cancelAnimationFrame(game.frame); game.frame = null; }

// Called every frame: play the soft cue notes, find missed tiles, find the end of the song.
function update() {
  if (game.state !== 'playing') return;
  var now = performance.now();
  var open = 0;
  game.tiles.forEach(function (tile) {
    if (!tile.cued && now >= tile.time - 20) {
      tile.cued = true;
      beep(tile.freq, 0.25, 0.04, 0, lanePan(tile.lane), 'sine');            // the soft cue: "now!"
    }
    if (tile.state === 'wait' && now > tile.time + windowMs()) {
      tile.state = 'miss';
      game.misses++; game.streak = 0;
      beep(130, 0.2, 0.08, 0, lanePan(tile.lane));
      showFeedback('Miss');
      drawGame();
    }
    if (tile.state === 'wait') open++;
  });
  var last = game.tiles[game.tiles.length - 1];
  if (open === 0 && now > last.time + windowMs() + 600) endGame();
}

// ---------- drawing ----------

// Colours come from the page's own variables, so high contrast mode changes the game too.
function colours() {
  var cs = getComputedStyle($('at-canvas'));
  function get(name, fallback) { return cs.getPropertyValue(name).trim() || fallback; }
  return { bg: get('--panel', '#0B1220'), line: get('--line', '#1C2740'), text: get('--text', '#E8EDF5'),
    muted: get('--muted', '#9AA6BA'), accent: get('--accent', '#7FC8F8'), amber: get('--amber', '#E0A458') };
}

function drawCanvas() {
  var canvas = $('at-canvas');
  var c = canvas.getContext('2d');
  var w = canvas.width, h = canvas.height;
  var laneW = w / LANES, lineY = h - 80;
  var col = colours();
  var now = performance.now();

  c.fillStyle = col.bg; c.fillRect(0, 0, w, h);
  c.textAlign = 'center';

  for (var lane = 0; lane < LANES; lane++) {
    var x = lane * laneW;
    if (lane === game.handLane) { c.fillStyle = col.accent; c.globalAlpha = 0.15; c.fillRect(x, 0, laneW, h); c.globalAlpha = 1; }
    var age = now - game.flash[lane];
    if (age < 300) { c.fillStyle = col.amber; c.globalAlpha = 0.5 * (1 - age / 300); c.fillRect(x, lineY - 40, laneW, 80); c.globalAlpha = 1; }
    if (lane > 0) { c.fillStyle = col.line; c.fillRect(x - 1, 0, 2, h); }
    // lane number and name under the line: text, not only colour
    c.fillStyle = col.text; c.font = '600 28px Inter, sans-serif'; c.fillText(String(lane + 1), x + laneW / 2, h - 38);
    c.fillStyle = col.muted; c.font = '16px Inter, sans-serif'; c.fillText(LANE_NAMES[lane], x + laneW / 2, h - 14);
    if (lane === game.handLane) {          // a small triangle marks the lane your hand is in
      c.fillStyle = col.accent; c.beginPath();
      c.moveTo(x + laneW / 2 - 12, lineY + 12); c.lineTo(x + laneW / 2 + 12, lineY + 12); c.lineTo(x + laneW / 2, lineY + 1); c.fill();
    }
  }

  c.fillStyle = col.accent; c.fillRect(0, lineY - 2, w, 4);       // the hit line

  if (game.state === 'playing') {
    game.tiles.forEach(function (tile) {
      var progress = 1 - (tile.time - now) / fallMs();             // 0 = top, 1 = on the line
      if (progress < -0.1 || progress > 1.3 || tile.state === 'hit') return;
      var y = progress * lineY;
      var x = tile.lane * laneW + 10;
      if (tile.state === 'wait') {
        c.fillStyle = col.accent; c.fillRect(x, y - 36, laneW - 20, 72);
        c.fillStyle = col.bg; c.font = '700 30px Inter, sans-serif'; c.fillText(String(tile.lane + 1), x + (laneW - 20) / 2, y + 10);
      } else {                                                      // missed: an empty tile with an X
        c.strokeStyle = col.muted; c.lineWidth = 2; c.strokeRect(x, y - 36, laneW - 20, 72);
        c.fillStyle = col.muted; c.font = '700 30px Inter, sans-serif'; c.fillText('×', x + (laneW - 20) / 2, y + 10);
      }
    });
  } else {
    c.fillStyle = col.text; c.font = '500 26px Newsreader, Georgia, serif';
    var label = game.state === 'countdown' ? 'Get ready' : game.state === 'over' ? 'Song finished' : 'Press Start';
    c.fillText(label, w / 2, lineY / 2);
  }
}

// Update the text, buttons and scores around the canvas.
function drawGame() {
  var on = gameIsOn();
  $('at-off').hidden = on;
  $('at-body').hidden = !on;
  $('at-dataset').textContent = datasetTitle();
  var labels = { idle: 'Ready', countdown: 'Get ready', playing: 'Playing', over: 'Finished' };
  $('at-state').textContent = labels[game.state];
  $('at-start').textContent = game.state === 'over' ? 'Play again' : 'Start song';
  $('at-start').disabled = inSong();
  $('at-stop').disabled = !inSong();

  var total = game.tiles.length || 24;
  var done = game.tiles.filter(function (tile) { return tile.state !== 'wait'; }).length;
  $('at-progress').max = total;
  $('at-progress').value = done;
  $('at-round').textContent = game.state === 'idle' ? 'Not started' : done + ' of ' + total + ' tiles played';
  $('at-score').textContent = String(game.score);
  $('at-streak').textContent = String(game.streak);
  $('at-hits').textContent = game.hits + ' of ' + total;
  $('at-scorebox').hidden = !play.mode;
  $('at-free').hidden = play.mode;
  drawCanvas();
}

// ---------- hand controls ----------

var holdTimer = null;      // runs while a fist is being held

HandEngine.on('move', function (e) {
  var lane = Math.min(LANES - 1, Math.max(0, Math.floor(e.x * LANES)));
  if (lane === game.handLane) return;
  game.handLane = lane;
  // a quiet tone says which lane the hand is in, so it can be found by ear
  if (settings.audio && game.state !== 'countdown') beep(laneFreq(lane), 0.12, 0.05, 0, lanePan(lane));
  if (!inSong()) drawCanvas();
});

HandEngine.on('hand', function (e) { if (!e.present) { game.handLane = -1; if (!inSong()) drawCanvas(); } });

HandEngine.on('pinch', function (e) {
  if (!gameIsOn() || !e.down) return;
  if (game.state === 'idle' || game.state === 'over') startGame();
  else if (game.state === 'playing' && game.handLane >= 0) hitLane(game.handLane);
});

// A fist held for 2 seconds stops the song (the long hold stops it happening by accident).
HandEngine.on('pose', function (e) {
  clearTimeout(holdTimer);
  if (!gameIsOn() || !inSong() || e.pose !== 'fist') return;
  holdTimer = setTimeout(function () { stopGame(); say('Song stopped.'); }, voice.fast ? 60 : FIST_STOP_MS);
});

// Swiping changes the dataset, but only between songs (during a song your hand is busy moving between lanes).
HandEngine.on('swipe', function (e) {
  if (gameIsOn() && !inSong()) changeDataset(e.direction === 'right' ? 1 : -1);
});

HandEngine.on('status', function (e) { $('camera-note').textContent = e.message; });

function changeDataset(direction) {
  if (inSong()) return;
  game.dataset = (game.dataset + direction + AIR_TILES_DATA.length) % AIR_TILES_DATA.length;
  game.state = 'idle';
  game.tiles = [];
  drawGame();
  say((AIR_TILES_DATA[game.dataset].placeholder ? 'Sample data: ' : '') + datasetTitle() + '. ' + AIR_TILES_DATA[game.dataset].hint);
}

// ---------- camera on and off ----------

async function useCamera() {
  $('camera-box').hidden = false;
  $('camera-note').textContent = 'Your browser will now ask to use the camera. It is only used to see your hand. Nothing is recorded.';
  await say('Your browser will now ask to use the camera. The camera is only used to see your hand. Nothing is recorded or sent anywhere. ' +
    'If you prefer, choose Use keyboard or touch instead.');
  if (play.control !== 'camera') return;      // the player changed their mind while this was spoken
  var ok = await HandEngine.start();
  if (!ok) {
    await say('The camera is not available, so the game now uses keyboard and touch. Press 1 to 4 to hit a lane and Enter to start.');
    useKeyboard(true);
    return;
  }
  await HandEngine.calibrate();
  if (game.state === 'idle') say('The camera is ready. Pinch, or press Enter, to start the song.');
}

function useKeyboard(quiet) {
  HandEngine.stop();
  game.handLane = -1;
  $('camera-box').hidden = true;
  setControl('keyboard');
  if (!quiet) say('Using keyboard and touch. Press 1 to 4 to hit a lane and Enter to start.');
}

// js/play.js calls this whenever a switch or the control choice on the Play tab changes.
function onPlayChange(what) {
  if (what === 'control') {
    if (play.control === 'camera') useCamera();
    else { HandEngine.stop(); game.handLane = -1; $('camera-box').hidden = true; }
  }
  if (what === 'game' && !gameIsOn()) { stopGame(); stopSpeaking(); }
  drawGame();
}

// ---------- buttons, switches and keyboard ----------

$('at-start').addEventListener('click', startGame);
$('at-stop').addEventListener('click', function () { stopGame(); say('Song stopped.'); });
$('at-prev').addEventListener('click', function () { changeDataset(-1); });
$('at-next').addEventListener('click', function () { changeDataset(1); });
$('use-keyboard').addEventListener('click', function () { useKeyboard(false); });
$('calibrate').addEventListener('click', function () { HandEngine.calibrate(); });

// Lane buttons: a touch or mouse press hits straight away (pointerdown is faster than click).
// A keyboard press on a focused button (Enter or Space) arrives as a click with detail 0.
document.querySelectorAll('#at-lanes button').forEach(function (button) {
  var lane = Number(button.getAttribute('data-lane'));
  button.addEventListener('pointerdown', function (event) { event.preventDefault(); hitLane(lane); });
  button.addEventListener('click', function (event) { if (event.detail === 0) hitLane(lane); });
});

// js/app.js flips every switch on the page and sends "orbeats:switch". We only react to it.
function flipSwitch(id, apply) {
  $(id).addEventListener('orbeats:switch', function (e) { apply(e.detail.on); });
}
flipSwitch('relaxed-switch', function (on) {
  game.relaxed = on; HandEngine.relaxed = on;
  say('Relaxed timing ' + (on ? 'on. Tiles fall slower and you have more time to hit them. It starts with the next song.' : 'off.'));
});
flipSwitch('preview-switch', function (on) { HandEngine.showPreview = on; $('hand-preview').hidden = !on; });

// Keyboard shortcuts. They are ignored while typing in a field or using a radio button or slider.
document.addEventListener('keydown', function (event) {
  if (!gameIsOn() || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  var tag = event.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  var onButton = tag === 'BUTTON' || tag === 'A';
  var key = event.key.toLowerCase();

  if (key >= '1' && key <= '4') hitLane(Number(key) - 1);
  else if (key === 'enter' && !onButton) { if (!inSong()) startGame(); }   // on a button, Enter presses that button instead
  else if (key === 'arrowleft') changeDataset(-1);
  else if (key === 'arrowright') changeDataset(1);
  else if (key === 'escape') { if (inSong()) { stopGame(); say('Song stopped.'); } }
  else return;
  event.preventDefault();
});

// Show the first state. Captions follow the Captions button in the accessibility bar.
applySettings();
drawGame();
