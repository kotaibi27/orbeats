// Play tab: game mode hint and controls note.
(function () {
  const mode = document.getElementById('game-mode');
  const hint = document.getElementById('mode-hint');
  mode.addEventListener('orbeats:switch', function (e) {
    hint.textContent = e.detail.on ? 'Score, timer and streaks' : 'Free play';
  });

  const notes = {
    camera: '[Camera status placeholder] · Keyboard and touch always work as a fallback.',
    keyboard: '[Keyboard instructions placeholder]',
    touch: '[Touch instructions placeholder]'
  };
  const note = document.getElementById('ctrl-note');
  document.querySelectorAll('input[name="ctrl"]').forEach(function (r) {
    r.addEventListener('change', function () { note.textContent = notes[r.value]; });
  });
})();
