// GAME 1: GUESS THE YEAR
// The player hears a short sound made from one year of a NASA dataset and guesses the year.
// It can be played with a hand in front of the camera (no screen needed), with the keyboard,
// or by touch. Everything is spoken aloud and shown as captions.
//
// Needs: js/shared.js, js/voice.js, js/hands.js, js/play.js and js/games/guess-year-data.js.
//
// The game is a small "state machine". game.state is always one of:
//   'idle'       waiting to start
//   'intro'      the rules are being spoken
//   'listening'  the sound for this round is playing
//   'choosing'   the player picks one of 4 years
//   'feedback'   the answer is being explained
//   'over'       the game has ended

var ROUNDS = 5;
var CLIP_SECONDS = 10;      // the sound for each round
var COMPARE_SECONDS = 4;    // the shorter replays after an answer
var ANSWER_SECONDS = 30;    // time limit in Game mode (3 times longer with Relaxed timing)
var PINCH_HOLD_MS = 1000;   // hold a pinch this long to lock in
var FIST_HOLD_MS = 1000;    // hold a fist this long to skip (so a resting hand does not skip by accident)
var PALM_HOLD_MS = 700;     // hold an open palm this long to repeat

var game = {
  state: 'idle',
  round: 0, score: 0, streak: 0,
  dataset: 0,         // which entry of GUESS_YEAR_DATA
  answer: null,       // the correct year
  options: [],        // the 4 years offered
  chosen: -1,         // index of the picked option, -1 = none yet
  token: 0,           // goes up whenever the game moves on, so older spoken sequences stop
  timeLeft: 0, timer: null,
  relaxed: false,
  handStyle: 'fingers',   // 'fingers' = raise 1 to 4 fingers, 'zones' = move the hand up and down
  clip: null          // the sound that is playing now
};

function $(id) { return document.getElementById(id); }

function datasetTitle(index) {
  var data = GUESS_YEAR_DATA[index];
  for (var i = 0; i < CATALOG.length; i++) { if (CATALOG[i].svs === data.svs) return CATALOG[i].title; }
  return 'Dataset ' + data.svs;
}

function gameIsOn() { return play.games[0]; }   // the Guess the Year on/off switch on this page
function inRound() { return game.state === 'listening' || game.state === 'choosing'; }

// ---------- turning data into sound ----------

function average(list) {
  var sum = 0;
  for (var i = 0; i < list.length; i++) sum += list[i];
  return sum / list.length;
}

// Smallest and biggest number in a whole dataset, used to scale every value to 0..1
function datasetRange(data) {
  var low = Infinity, high = -Infinity, lowAvg = Infinity, highAvg = -Infinity;
  for (var year in data.years) {
    var values = data.years[year];
    for (var i = 0; i < values.length; i++) { low = Math.min(low, values[i]); high = Math.max(high, values[i]); }
    lowAvg = Math.min(lowAvg, average(values)); highAvg = Math.max(highAvg, average(values));
  }
  return { low: low, high: high, lowAvg: lowAvg, highAvg: highAvg };
}

function stopClip() {
  if (!game.clip) return;
  game.clip.gain.disconnect();      // silences every note that is still scheduled
  clearTimeout(game.clip.timer);
  game.clip.finish();
  game.clip = null;
}

// Play one year as sound. Returns a Promise that resolves when the sound ends.
//   bigger value        -> higher pitch and louder
//   bigger year average -> faster pulse (more notes per second)
function playYear(year, seconds) {
  stopClip();
  if (voice.fast) seconds = 0.3;
  var ctx = getAudio();
  var data = GUESS_YEAR_DATA[game.dataset];
  var values = data.years[year];
  var range = datasetRange(data);
  var activity = (average(values) - range.lowAvg) / ((range.highAvg - range.lowAvg) || 1);   // 0..1
  var notesPerSecond = 2 + activity * 4;                                                    // 2 to 6
  var total = Math.round(notesPerSecond * seconds);
  var step = seconds / total;

  var out = ctx.createGain();       // one volume knob for this whole clip, so it can be stopped
  out.connect(voice.master);

  for (var i = 0; i < total; i++) {
    // walk through the year once, start to end
    var value = values[Math.min(values.length - 1, Math.floor(i / total * values.length))];
    var level = (value - range.low) / ((range.high - range.low) || 1);    // 0..1
    var start = ctx.currentTime + 0.05 + i * step;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 196 * Math.pow(2, level * 2.2);                 // about 196 Hz to 900 Hz
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.06 + level * 0.22, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + step * 0.9);
    osc.connect(gain); gain.connect(out);
    osc.start(start); osc.stop(start + step);
  }

  HandEngine.guideTone = false;     // keep the hand tone quiet while the player listens
  return new Promise(function (resolve) {
    var clip = { gain: out, finish: resolve };
    clip.timer = setTimeout(function () { if (game.clip === clip) game.clip = null; resolve(); }, seconds * 1000 + 150);
    game.clip = clip;
  }).then(function () { HandEngine.guideTone = game.handStyle !== 'zones' || game.state !== 'choosing'; });
}

// ---------- drawing the screen ----------

function drawGame() {
  var on = gameIsOn();
  var data = GUESS_YEAR_DATA[game.dataset];
  $('gy-off').hidden = on;
  $('gy-body').hidden = !on;

  $('gy-dataset').textContent = datasetTitle(game.dataset) + (data.placeholder ? ' (sample data)' : '');
  $('gy-round').textContent = game.round ? 'Round ' + Math.min(game.round, ROUNDS) + ' of ' + ROUNDS : 'Not started';
  $('gy-progress').value = Math.min(game.round, ROUNDS);

  // Score, streak and timer only exist in Game mode
  $('gy-scorebox').hidden = !play.mode;
  $('gy-free').hidden = play.mode;
  $('gy-score').textContent = game.score + ' of ' + ROUNDS;
  $('gy-streak').textContent = game.streak;
  $('gy-timer').textContent = game.state === 'choosing' && play.mode ? game.timeLeft + ' s' : '–';

  var labels = { idle: 'Ready', intro: 'Getting ready…', listening: 'Listen…', choosing: 'Which year was it?', feedback: 'Answer', over: 'Game over' };
  $('gy-state').textContent = labels[game.state];

  // The four year buttons
  var buttons = $('gy-options').querySelectorAll('button');
  for (var i = 0; i < buttons.length; i++) {
    var active = game.state === 'choosing';
    var picked = game.chosen === i && (active || game.state === 'feedback');
    buttons[i].disabled = !active;
    buttons[i].setAttribute('aria-pressed', picked ? 'true' : 'false');
    buttons[i].querySelector('.opt-year').textContent = game.options[i] || '–';
    buttons[i].querySelector('.opt-note').textContent = picked ? 'Chosen' : '';
  }

  $('gy-start').textContent = game.state === 'over' ? 'Play again' : (game.state === 'idle' ? 'Start game' : 'Restart');
  $('gy-confirm').disabled = !(game.state === 'choosing' && game.chosen >= 0);
  $('gy-repeat').disabled = !inRound();
  $('gy-skip').disabled = !inRound();
}

// ---------- the game ----------

// Pick the correct year and three other years for this round.
function pickOptions() {
  var years = Object.keys(GUESS_YEAR_DATA[game.dataset].years).map(Number);
  var shuffled = years.slice().sort(function () { return Math.random() - 0.5; });
  game.answer = shuffled[0];
  game.options = shuffled.slice(0, 4).sort(function (a, b) { return a - b; });   // shown in year order
  game.chosen = -1;
}

function stopTimer() { clearInterval(game.timer); game.timer = null; }

function startTimer() {
  stopTimer();
  if (!play.mode) return;                                   // free play has no timer
  game.timeLeft = ANSWER_SECONDS * (game.relaxed ? 3 : 1);
  game.timer = setInterval(function () {
    game.timeLeft--;
    if (game.timeLeft === 10) say('10 seconds left.');
    if (game.timeLeft <= 0) { stopTimer(); lockIn(true); }
    drawGame();
  }, 1000);
}

// Every spoken sequence begins with  var my = newStep();  and checks  if (stale(my)) return;
// after each wait. That way an old sequence stops as soon as the player does something new.
function newStep() { stopClip(); stopTimer(); stopSpeaking(); return ++game.token; }
function stale(my) { return my !== game.token; }

async function startGame() {
  if (!gameIsOn()) return;
  var my = newStep();
  game.round = 0; game.score = 0; game.streak = 0; game.state = 'intro';
  $('gy-stage').focus();        // so keyboard shortcuts work straight away
  drawGame();
  await say('Guess the Year. You will hear ten seconds of sound made from one year of data. Then choose the year from four options. ' +
    'With your hand: raise one, two, three or four fingers to choose, then pinch and hold for one second to lock it in. ' +
    'Open palm repeats the sound. A fist skips. Swipe left or right to change the dataset. ' +
    'With the keyboard: press 1 to 4, then Enter. R repeats, N skips.');
  if (stale(my)) return;
  await introduceDataset(my);
  if (stale(my)) return;
  nextRound();
}

// Let the player hear the two ends of the scale before guessing.
async function introduceDataset(my) {
  var data = GUESS_YEAR_DATA[game.dataset];
  var years = Object.keys(data.years).map(Number);
  var first = years[0], last = years[years.length - 1];
  setNowPlayingTitle('Guess the Year · ' + datasetTitle(game.dataset));
  await say('Dataset: ' + datasetTitle(game.dataset) + '. ' + (data.placeholder ? 'This is sample data, not real measurements yet. ' : '') + data.hint);
  if (stale(my)) return;
  await say('The earliest year, ' + first + ', sounds like this.');
  if (stale(my)) return;
  await playYear(first, 3);
  if (stale(my)) return;
  await say('The latest year, ' + last + ', sounds like this.');
  if (stale(my)) return;
  await playYear(last, 3);
}

async function nextRound() {
  var my = newStep();
  game.round++;
  if (game.round > ROUNDS) { endGame(); return; }
  pickOptions();
  game.state = 'listening';
  drawGame();
  await say('Round ' + game.round + ' of ' + ROUNDS + '. Listen.');
  if (stale(my)) return;
  await playYear(game.answer, CLIP_SECONDS);
  if (stale(my)) return;
  askForChoice(my);
}

async function askForChoice(my) {
  game.state = 'choosing';
  HandEngine.guideTone = game.handStyle !== 'zones';
  game.timeLeft = ANSWER_SECONDS * (game.relaxed ? 3 : 1);
  drawGame();
  var text = 'Which year was it? ';
  for (var i = 0; i < 4; i++) text += 'Option ' + (i + 1) + ': ' + game.options[i] + '. ';
  await say(text);
  if (stale(my)) return;
  startTimer();                 // the clock starts only after the options have been read out
  drawGame();
  if (game.chosen >= 0) return;
  // If the player is already holding up 1 to 4 fingers when the list ends, take that as their choice.
  var held = HandEngine.fingers();
  if (game.handStyle === 'fingers' && held >= 1) choose(held - 1);
}

// Pick option 0..3. Picking the same option a second time locks it in (handy for touch).
function choose(index) {
  if (game.state !== 'choosing' || index < 0 || index > 3) return;
  if (game.chosen === index) { lockIn(false); return; }
  game.chosen = index;
  if (settings.audio) beep(330 * Math.pow(2, (3 - index) / 4), 0.12, 0.15);
  drawGame();
  say('Option ' + (index + 1) + ', ' + game.options[index] + '. Pinch and hold, or press Enter, to lock it in.');
}

// Build the one-sentence fact from the data itself, so it is always true for the numbers in the file.
function factSentence(yearA, yearB) {
  var data = GUESS_YEAR_DATA[game.dataset];
  var a = average(data.years[yearA]), b = average(data.years[yearB]);
  var percent = Math.round(Math.abs(a - b) / b * 100);
  var word = a >= b ? data.more : data.less;
  var sentence = percent === 0
    ? 'In this data, ' + data.thing + ' were about the same in ' + yearA + ' and ' + yearB + '.'
    : 'In this data, ' + data.thing + ' were about ' + percent + ' percent ' + word + ' in ' + yearA + ' than in ' + yearB + '.';
  return sentence + (data.placeholder ? ' This is sample data, not real measurements yet.' : '');
}

async function lockIn(timeUp) {
  if (game.state !== 'choosing') return;
  if (!timeUp && game.chosen < 0) { say('Choose an option first. Raise one to four fingers, or press 1 to 4.'); return; }
  var my = newStep();
  game.state = 'feedback';
  var guess = game.chosen >= 0 ? game.options[game.chosen] : null;
  var correct = guess === game.answer;
  if (correct) { game.score++; game.streak++; } else { game.streak = 0; }
  drawGame();
  if (settings.audio) (correct ? SOUNDS.right : SOUNDS.wrong)();

  if (timeUp && guess === null) await say('Time is up. It was ' + game.answer + '.');
  else if (correct) await say('You chose ' + guess + '. Correct!');
  else await say('You chose ' + guess + '. Not quite, it was ' + game.answer + '.');
  if (stale(my)) return;

  // Replay the correct sound, then the guessed one, so the player hears the difference.
  await say('This is ' + game.answer + ', the correct year.');
  if (stale(my)) return;
  await playYear(game.answer, COMPARE_SECONDS);
  if (stale(my)) return;
  if (guess !== null && !correct) {
    await say('And this is ' + guess + ', your guess.');
    if (stale(my)) return;
    await playYear(guess, COMPARE_SECONDS);
    if (stale(my)) return;
  }

  // The fact compares the correct year with the guess, or with the first year when the guess was right.
  var years = Object.keys(GUESS_YEAR_DATA[game.dataset].years).map(Number);
  var other = (guess !== null && !correct) ? guess : (game.answer === years[0] ? years[years.length - 1] : years[0]);
  await say(factSentence(game.answer, other));
  if (stale(my)) return;
  if (play.mode) {
    await say('Score: ' + game.score + ' of ' + game.round + '.' + (game.streak > 1 ? ' ' + game.streak + ' in a row.' : ''));
    if (stale(my)) return;
  }
  await wait(600);
  if (stale(my)) return;
  nextRound();
}

async function repeatSound() {
  if (!inRound()) return;
  var my = newStep();
  game.state = 'listening';
  drawGame();
  await say('Again.');
  if (stale(my)) return;
  await playYear(game.answer, CLIP_SECONDS);
  if (stale(my)) return;
  askForChoice(my);
}

async function skipRound() {
  if (!inRound()) return;
  var my = newStep();
  game.streak = 0;
  await say('Skipped. It was ' + game.answer + '.');
  if (stale(my)) return;
  nextRound();
}

// direction: 1 = next dataset, -1 = previous
async function changeDataset(direction) {
  var count = GUESS_YEAR_DATA.length;
  game.dataset = (game.dataset + direction + count) % count;
  var my = newStep();
  var playing = game.state !== 'idle' && game.state !== 'over';
  if (playing) { game.state = 'intro'; game.round = Math.max(0, game.round - 1); }   // the round starts again with the new data
  drawGame();
  await introduceDataset(my);
  if (stale(my)) return;
  if (playing) nextRound();
}

async function endGame() {
  var my = newStep();
  game.state = 'over';
  game.round = ROUNDS;
  HandEngine.guideTone = true;
  drawGame();
  var text = play.mode ? 'Game over. You scored ' + game.score + ' out of ' + ROUNDS + '. ' : 'That was ' + ROUNDS + ' rounds. ';
  await say(text + 'To play again: pinch, press Enter, or tap Play again.');
}

function stopGame() {
  newStep();
  game.state = 'idle'; game.round = 0; game.chosen = -1; game.options = [];
  HandEngine.guideTone = true;
  drawGame();
}

// Enter, a pinch, or the Lock in button: lock the choice, or start a game when none is running.
function confirmAction() {
  if (game.state === 'choosing') lockIn(false);
  else if (game.state === 'idle' || game.state === 'over') startGame();
}

// ---------- hand controls ----------

var holdTimer = null;     // runs while a pinch, fist or open palm is being held
var zone = -1, zoneTimer = null;

function startHold(ms, done) {
  clearTimeout(holdTimer);
  // a rising tone tells the player the hold is being counted
  if (settings.audio) { beep(440, 0.1, 0.12); beep(554, 0.1, 0.12, ms / 2000); }
  holdTimer = setTimeout(function () { if (settings.audio) SOUNDS.ok(); done(); }, voice.fast ? 60 : ms);
}

HandEngine.on('pinch', function (e) {
  if (!gameIsOn()) return;
  if (e.down) startHold(PINCH_HOLD_MS, confirmAction);
  else clearTimeout(holdTimer);
});

HandEngine.on('pose', function (e) {
  clearTimeout(holdTimer);
  if (!gameIsOn() || !inRound()) return;
  if (e.pose === 'fist') startHold(FIST_HOLD_MS, skipRound);
  if (e.pose === 'open') startHold(PALM_HOLD_MS, repeatSound);
});

HandEngine.on('fingers', function (e) {
  if (game.handStyle === 'fingers' && e.count >= 1 && e.count <= 4 && game.chosen !== e.count - 1) choose(e.count - 1);
});

// Zone style: the picture is split into 4 bands. Top band = option 1. Each band has its own note.
HandEngine.on('move', function (e) {
  if (game.handStyle !== 'zones' || game.state !== 'choosing') { zone = -1; return; }
  var now = Math.min(3, Math.floor((1 - e.y) * 4));
  if (now === zone) return;
  zone = now;
  if (settings.audio) beep(330 * Math.pow(2, (3 - zone) / 4), 0.15, 0.15);
  clearTimeout(zoneTimer);
  // staying in a band for a moment chooses it (no fast or exact movement needed)
  zoneTimer = setTimeout(function () { if (game.chosen !== zone) choose(zone); }, game.relaxed ? 1200 : 600);
});

HandEngine.on('swipe', function (e) {
  if (gameIsOn()) changeDataset(e.direction === 'right' ? 1 : -1);
});

HandEngine.on('status', function (e) { $('camera-note').textContent = e.message; });

// ---------- camera on and off ----------

async function useCamera() {
  $('camera-box').hidden = false;
  $('camera-note').textContent = 'Your browser will now ask to use the camera. It is only used to see your hand. Nothing is recorded.';
  await say('Your browser will now ask to use the camera. The camera is only used to see your hand. Nothing is recorded or sent anywhere. ' +
    'If you prefer, choose Use keyboard or touch instead.');
  if (play.control !== 'camera') return;      // the player changed their mind while this was spoken
  var ok = await HandEngine.start();
  if (!ok) {
    await say('The camera is not available, so the game now uses keyboard and touch. Press 1 to 4 to choose and Enter to lock in.');
    useKeyboard(true);
    return;
  }
  await HandEngine.calibrate();
  if (game.state === 'idle') say('The camera is ready. Pinch, or press Enter, to start the game.');
}

function useKeyboard(quiet) {
  HandEngine.stop();
  $('camera-box').hidden = true;
  play.control = 'keyboard';
  drawControls();
  if (!quiet) say('Using keyboard and touch. Press 1 to 4 to choose and Enter to lock in.');
}

// js/play.js calls this whenever a switch or the control choice on the Play tab changes.
function onPlayChange(what) {
  if (what === 'control') {
    if (play.control === 'camera') useCamera();
    else { HandEngine.stop(); $('camera-box').hidden = true; }
  }
  if (what === 'game' && !gameIsOn()) { stopGame(); stopSpeaking(); }
  drawGame();
}

// ---------- buttons, switches and keyboard ----------

$('gy-start').addEventListener('click', startGame);
$('gy-confirm').addEventListener('click', confirmAction);
$('gy-repeat').addEventListener('click', repeatSound);
$('gy-skip').addEventListener('click', skipRound);
$('gy-prev').addEventListener('click', function () { changeDataset(-1); });
$('gy-next').addEventListener('click', function () { changeDataset(1); });
$('use-keyboard').addEventListener('click', function () { useKeyboard(false); });
$('calibrate').addEventListener('click', function () { HandEngine.calibrate(); });

$('gy-options').addEventListener('click', function (event) {
  var button = event.target.closest('button');
  if (button) choose(Number(button.getAttribute('data-option')));
});

function flipSwitch(id, apply) {
  $(id).addEventListener('click', function () {
    var on = this.getAttribute('aria-checked') !== 'true';
    this.setAttribute('aria-checked', on ? 'true' : 'false');
    this.querySelector('.state').textContent = on ? 'On' : 'Off';
    apply(on);
  });
}
flipSwitch('relaxed-switch', function (on) { game.relaxed = on; HandEngine.relaxed = on; say('Relaxed timing ' + (on ? 'on. You have three times more time.' : 'off.')); });
flipSwitch('preview-switch', function (on) { HandEngine.showPreview = on; $('hand-preview').hidden = !on; });

$('hand-style').addEventListener('change', function (event) {
  game.handStyle = event.target.value;
  say(game.handStyle === 'zones' ? 'Hand height: move your hand up and down. The top is option 1, the bottom is option 4. Pinch to lock in.' : 'Fingers: raise one to four fingers to choose. Pinch to lock in.');
});

// Keyboard shortcuts. They are ignored while typing in a field or using a radio button or slider.
document.addEventListener('keydown', function (event) {
  if (!gameIsOn() || event.ctrlKey || event.metaKey || event.altKey) return;
  var tag = event.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  var onButton = tag === 'BUTTON' || tag === 'A';
  var key = event.key.toLowerCase();

  if (key >= '1' && key <= '4') choose(Number(key) - 1);
  else if (key === 'enter' && !onButton) confirmAction();     // on a button, Enter presses that button instead
  else if (key === 'r') repeatSound();
  else if (key === 'n') skipRound();
  else if (key === 'arrowleft') changeDataset(-1);
  else if (key === 'arrowright') changeDataset(1);
  else if (key === 'escape') { stopGame(); say('Game stopped.'); }
  else return;
  event.preventDefault();
});

$('gy-prev').innerHTML = ICONS.arrowLeft;
$('gy-next').innerHTML = ICONS.arrowRight;

// Show the first state. Captions follow the Captions button in the accessibility bar.
$('game-caption').classList.toggle('sr', !settings.cc);
drawGame();
