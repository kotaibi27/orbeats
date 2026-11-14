// Play tab: game switches, game mode and the controls choice.
// The current choices are kept in the "play" object so the games can read them.

var play = {
  mode: true,                   // Game mode: score, timer and streaks
  games: [true, true],          // which games are switched on (0 = Air Tiles, 1 = Earth Simon)
  control: 'keyboard'           // 'camera', 'keyboard' or 'touch'
};

var CONTROL_NOTES = {
  camera: 'Move your hand into a lane and pinch to hit a tile. Pinch to start. Swipe changes the dataset between songs. Keyboard and touch always work too.',
  keyboard: 'Press 1 to 4 to hit a lane, Enter to start, left and right arrows change the dataset, Escape stops.',
  touch: 'Tap a lane button when its tile reaches the line.'
};

// A game script can define onPlayChange(what) to be told when something here changes.
function tellGame(what) { if (typeof onPlayChange === 'function') onPlayChange(what); }

// Choose a control from code (for example when the camera is refused).
function setControl(name) {
  play.control = name;
  document.querySelector('input[name="ctrl"][value="' + name + '"]').checked = true;
  document.getElementById('ctrl-note').textContent = CONTROL_NOTES[name];
}

// Game mode switch. js/app.js flips the switch and sends the "orbeats:switch" event.
document.getElementById('game-mode').addEventListener('orbeats:switch', function (e) {
  play.mode = e.detail.on;
  document.getElementById('mode-hint').textContent = play.mode ? 'Score, timer and streaks' : 'Free play';
  tellGame('mode');
});

// Game on/off switches (each has data-game="0" or "1" in play.html)
document.querySelectorAll('[data-game]').forEach(function (button) {
  button.addEventListener('orbeats:switch', function (e) {
    play.games[Number(button.getAttribute('data-game'))] = e.detail.on;
    tellGame('game');
  });
});

// Controls choice
document.querySelectorAll('input[name="ctrl"]').forEach(function (radio) {
  radio.addEventListener('change', function () {
    setControl(radio.value);
    tellGame('control');
  });
});

setControl('keyboard');
