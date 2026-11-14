// Audio-first mode: one track at a time, with keyboard shortcuts.
(function () {
  const catalog = [
  [
    "5313",
    "Change in Night Lights between 2012 and 2023"
  ],
  [
    "3912",
    "Global Sea Surface Currents and Temperature"
  ],
  [
    "5425",
    "Perpetual Ocean 2: Western Boundary Currents"
  ],
  [
    "4950",
    "GEDI Forest Height"
  ],
  [
    "5011",
    "Lightning Events Detected from the ISS, 2017 to 2023"
  ],
  [
    "4960",
    "A 3D View of an Atmospheric River from an Earth System Model"
  ],
  [
    "5533",
    "Air Quality Model Runs"
  ],
  [
    "5669",
    "GEOS Aerosols"
  ]
];
  let track = 0;

  const transcript = document.getElementById('af-transcript');
  const meta = document.getElementById('af-meta');
  const title = document.getElementById('ct-h');

  function show(message) {
    const t = catalog[track];
    meta.textContent = 'Track ' + (track + 1) + ' of ' + catalog.length + ' · SVS ' + t[0];
    title.textContent = t[1];
    if (message === 'repeat') transcript.textContent = '[Repeated description placeholder for ' + t[1] + ']';
    else if (message === 'help') transcript.textContent = 'Space plays or pauses. N moves to the next track. R repeats. Escape returns to the standard layout.';
    else transcript.textContent = 'Track ' + (track + 1) + ' of ' + catalog.length + ': ' + t[1] + '. [Spoken description placeholder] Press Space to play.';
    if (window.ORBEATS) window.ORBEATS.setNowPlaying(t[1]);
  }

  function next(step) { track = (track + step + catalog.length) % catalog.length; show('intro'); }

  document.getElementById('af-next').addEventListener('click', function () { next(1); });
  document.getElementById('af-repeat').addEventListener('click', function () { show('repeat'); });
  document.getElementById('af-help').addEventListener('click', function () { show('help'); });

  document.addEventListener('keydown', function (e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (k === ' ' && tag !== 'BUTTON' && tag !== 'A') { e.preventDefault(); window.ORBEATS.togglePlay(); }
    else if (k === 'n') next(1);
    else if (k === 'p') next(-1);
    else if (k === 'r') show('repeat');
    else if (k === 'h') show('help');
    else if (k === 'escape') window.location.href = 'index.html';
  });

  show('intro');
})();
