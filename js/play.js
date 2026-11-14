// Play page: game on/off switches, game mode switch, and the controls selector.

var GAMES = ['Guess the Year', 'Air Tiles', 'Earth Simon'];
var CONTROLS = [
  { id: 'camera', label: 'Camera and hand gestures', note: '[Camera status placeholder] · Keyboard and touch always work as a fallback.' },
  { id: 'keyboard', label: 'Keyboard', note: '[Keyboard instructions placeholder]' },
  { id: 'touch', label: 'Touch or click', note: '[Touch instructions placeholder]' }
];

var play = { mode: true, games: [true, true, true], control: 'keyboard' };

function drawGames() {
  var html = '';
  for (var i = 0; i < GAMES.length; i++) {
    var on = play.games[i];
    html += '<article style="display: flex; flex-direction: column; gap: 1em; padding-top: 1.2em; border-top: 1px solid var(--line)">' +
      '<div class="thumb" style="aspect-ratio: 16 / 9">[Image placeholder]</div>' +
      '<div style="display: flex; justify-content: space-between; align-items: center; gap: .8em">' +
      '<h3 style="font-size: 1.6em">' + GAMES[i] + '</h3>' +
      '<button class="switch" role="switch" data-game="' + i + '" aria-checked="' + on + '" aria-label="' + GAMES[i] + ' enabled">' +
      '<span class="track" aria-hidden="true"></span><span class="state">' + (on ? 'On' : 'Off') + '</span></button></div>' +
      '<p class="muted" style="font-size: .9em">[One-line description placeholder]</p></article>';
  }
  document.getElementById('games').innerHTML = html;
}

function drawControls() {
  var html = '';
  var note = '';
  for (var i = 0; i < CONTROLS.length; i++) {
    var c = CONTROLS[i];
    var checked = play.control === c.id ? ' checked' : '';
    html += '<label><input type="radio" name="ctrl" value="' + c.id + '"' + checked + '><span>' + c.label + '</span></label>';
    if (play.control === c.id) note = c.note;
  }
  document.getElementById('controls').innerHTML = html;
  document.getElementById('control-note').textContent = note;
}

function drawMode() {
  document.getElementById('mode-switch').setAttribute('aria-checked', play.mode ? 'true' : 'false');
  document.getElementById('mode-state').textContent = play.mode ? 'On' : 'Off';
  document.getElementById('mode-hint').textContent = play.mode ? 'Score, timer and streaks' : 'Free play';
}

// One click listener handles every game switch.
document.getElementById('games').addEventListener('click', function (event) {
  var button = event.target.closest('[data-game]');
  if (!button) return;
  var index = Number(button.getAttribute('data-game'));
  play.games[index] = !play.games[index];
  drawGames();
  document.querySelector('[data-game="' + index + '"]').focus();
});

document.getElementById('controls').addEventListener('change', function (event) {
  play.control = event.target.value;
  drawControls();
  document.querySelector('#controls input:checked').focus();
});

document.getElementById('mode-switch').addEventListener('click', function () {
  play.mode = !play.mode;
  drawMode();
});

drawGames();
drawControls();
drawMode();
