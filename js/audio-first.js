// Audio-first mode: one track at a time, a voice guide text, big buttons and keyboard shortcuts.

// The tracks are the Earth data items from the catalog (the Hubble reference item is left out).
var TRACKS = CATALOG.filter(function (item) { return !item.reference; });
var current = 0;
var message = 'intro';

function transcriptText() {
  var title = TRACKS[current].title;
  if (message === 'repeat') return '[Repeated description placeholder for ' + title + ']';
  if (message === 'help') return 'Space plays or pauses. N moves to the next track and P to the previous one. R repeats. Escape returns to the standard layout.';
  return 'Track ' + (current + 1) + ' of ' + TRACKS.length + ': ' + title + '. [Spoken description placeholder] Press Space to play.';
}

function drawTrack() {
  var track = TRACKS[current];
  document.getElementById('track-label').textContent = 'Track ' + (current + 1) + ' of ' + TRACKS.length + ' · SVS ' + track.svs;
  document.getElementById('ct-h').textContent = track.title;
  document.getElementById('transcript').textContent = transcriptText();
  setNowPlayingTitle(track.title);
}

function drawPlayButton() {
  var icon = settings.playing ? ICONS.pause : ICONS.play;
  var label = settings.playing ? 'Pause' : 'Play';
  document.getElementById('btn-play').innerHTML = '<span class="row">' + icon + label + ' track</span><span class="state">Space</span>';
}

function goToTrack(index) {
  current = (index + TRACKS.length) % TRACKS.length;
  message = 'intro';
  drawTrack();
}

function togglePlay() { change('playing', !settings.playing); }
function repeatDescription() { message = 'repeat'; drawTrack(); }
function showHelp() { message = 'help'; drawTrack(); }

document.getElementById('btn-play').addEventListener('click', togglePlay);
document.getElementById('btn-next').addEventListener('click', function () { goToTrack(current + 1); });
document.getElementById('btn-repeat').addEventListener('click', repeatDescription);
document.getElementById('btn-help').addEventListener('click', showHelp);

// Keep the big play button in step with the one in the now-playing bar.
onSettingsChange(drawPlayButton);

function changeVolume(amount) {
  var volume = document.getElementById('np-vol');
  volume.value = Math.max(0, Math.min(100, Number(volume.value) + amount));
}

document.addEventListener('keydown', function (event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  var target = event.target;
  var onButton = target.tagName === 'BUTTON' || target.tagName === 'A';
  var onSlider = target.tagName === 'INPUT' && target.type === 'range';
  var key = event.key.toLowerCase();

  if (key === ' ') {
    if (onButton) return; // the browser already presses the button
    event.preventDefault();
    togglePlay();
  } else if (key === 'n') { goToTrack(current + 1); }
  else if (key === 'p') { goToTrack(current - 1); }
  else if (key === 'r') { repeatDescription(); }
  else if (key === 'h') { showHelp(); }
  else if (key === 'escape') { window.location.href = 'index.html'; }
  else if (key === 'arrowup' && !onSlider) { event.preventDefault(); changeVolume(10); }
  else if (key === 'arrowdown' && !onSlider) { event.preventDefault(); changeVolume(-10); }
});

drawTrack();
drawPlayButton();
