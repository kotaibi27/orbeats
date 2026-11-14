// Explore: pick a dataset from the catalog, then see it, hear it and read about it.
//
// The 8 Earth datasets play a DEMO SOUND made in the browser (Web Audio). It is a generated
// pattern that shows how the dataset could sound. Replace makeDemo() with real data later.
// Caldwell 73 plays the real NASA sonification: the audio track of the hero video.

(function () {
  const DATASETS = {
    '5313': { title: 'Change in Night Lights between 2012 and 2023', source: 'NASA Black Marble, Suomi NPP VIIRS.', visual: 'Night lights' },
    '3912': { title: 'Global Sea Surface Currents and Temperature', source: 'ECCO2 model, March 2007 to March 2008.', visual: 'Ocean currents' },
    '5425': { title: 'Perpetual Ocean 2: Western Boundary Currents', source: 'ECCO-2, 2021 to 2023.', visual: 'Boundary currents' },
    '4950': { title: 'GEDI Forest Height', source: 'GEDI lidar on the International Space Station.', visual: 'Forest height' },
    '5011': { title: 'Lightning Events Detected from the ISS, 2017 to 2023', source: 'Lightning Imaging Sensor on the ISS.', visual: 'Lightning' },
    '4960': { title: 'A 3D View of an Atmospheric River from an Earth System Model', source: 'MERRA-2.', visual: 'Atmospheric river' },
    '5533': { title: 'Air Quality Model Runs', source: 'GEOS-CF, July to August 2024.', visual: 'Air quality' },
    '5669': { title: 'GEOS Aerosols', source: 'GEOS model, snapshot of August 19, 2025.', visual: 'Aerosols' },
    '13786': { title: 'Data Sonification: Caldwell 73', source: 'Hubble imagery of the globular cluster Caldwell 73 (NGC 1851). Reference only, not Earth data.', visual: 'Caldwell 73', real: true }
  };
  const DEMO_NOTE = 'Demo sound: a generated pattern that shows how this dataset could sound. Real data is not connected yet.';
  const DEMO_LENGTH = 40; // seconds

  // ---------- Web Audio set-up (created on the first click, as browsers require) ----------
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac = null, master = null, analyser = null, levels = null;
  let volume = 0.8;

  function ensureAudio() {
    if (!ac) {
      ac = new AC();
      master = ac.createGain();
      master.gain.value = volume;
      analyser = ac.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      levels = new Uint8Array(analyser.frequencyBinCount);
      master.connect(analyser);
      analyser.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  }

  // Seeded random numbers so each dataset always sounds the same
  function rng(seed) { let s = seed % 2147483647; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }
  const SCALE = [0, 2, 4, 7, 9]; // pentatonic
  function note(step, base) { const oct = Math.floor(step / 5), deg = ((step % 5) + 5) % 5; return base * Math.pow(2, oct + SCALE[deg] / 12); }

  // Each demo is a list of notes: { t: start time, f: frequency, d: length, type, g: loudness, pan }
  function makeDemo(svs) {
    const r = rng(parseInt(svs, 10) * 7919);
    const out = [];
    const n = function (t, f, d, type, g, pan) { out.push({ t: t, f: f, d: d, type: type || 'sine', g: g || 0.2, pan: pan || 0 }); };
    let i, t;
    switch (svs) {
      case '5313': // a slowly rising trend with flicker
        for (i = 0; i < 80; i++) { t = i * 0.5; const v = i / 80 * 9 + r() * 3; n(t, note(Math.round(v), 196), 0.45, 'triangle', 0.16, Math.sin(i / 6) * 0.6); }
        for (i = 0; i < 8; i++) n(i * 5, 98, 5.2, 'sine', 0.08, 0);
        break;
      case '3912': // two slow waves crossing, panning across
        for (i = 0; i < 64; i++) { t = i * 0.625; n(t, note(5 + Math.round(4 * Math.sin(i / 5)), 131), 1.2, 'sine', 0.13, Math.sin(i / 8)); n(t + 0.3, note(9 + Math.round(3 * Math.cos(i / 7)), 131), 0.9, 'sine', 0.08, -Math.sin(i / 8)); }
        break;
      case '5425': // swirling arpeggios
        for (i = 0; i < 160; i++) { t = i * 0.25; const phase = i % 16; n(t, note(phase < 8 ? phase : 16 - phase, 220 + 30 * Math.sin(i / 20)), 0.3, 'sine', 0.12, Math.cos(i / 4) * 0.8); }
        break;
      case '4950': // tall and short trees as plucked notes
        for (i = 0; i < 100; i++) { t = i * 0.4; const h = Math.floor(r() * r() * 14); n(t, note(h, 165), 0.35, 'sine', 0.22, (r() - 0.5) * 1.2); }
        break;
      case '5011': // sparse flashes in clusters
        t = 0;
        while (t < DEMO_LENGTH) { const burst = 1 + Math.floor(r() * 5); for (i = 0; i < burst; i++) n(t + i * 0.07, 1200 + r() * 1800, 0.08, 'square', 0.05, (r() - 0.5) * 1.6); n(t, 55, 1.4, 'sine', 0.12, 0); t += 0.6 + r() * 2.4; }
        break;
      case '4960': // a swell that rises and falls
        for (i = 0; i < 40; i++) { t = i; const s = Math.sin(i / 40 * Math.PI); n(t, note(Math.round(s * 10), 110), 1.4, 'sawtooth', 0.03 + s * 0.05, Math.sin(i / 5) * 0.5); n(t, 55, 1.2, 'sine', 0.1, 0); }
        break;
      case '5533': // daily ups and downs
        for (i = 0; i < 96; i++) { t = i * 0.416; const day = Math.sin(i / 24 * Math.PI * 2); n(t, note(Math.round(4 + day * 4 + r() * 2), 175), 0.38, 'triangle', 0.13, day * 0.5); }
        break;
      case '5669': // a dense soft cloud of high notes
        for (i = 0; i < 260; i++) { t = r() * DEMO_LENGTH; n(t, note(10 + Math.floor(r() * 8), 220), 0.6 + r(), 'sine', 0.035, (r() - 0.5) * 1.8); }
        for (i = 0; i < 10; i++) n(i * 4, 110, 4.4, 'sine', 0.06, 0);
        break;
    }
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }

  // ---------- Demo player ----------
  let current = '5313';
  let notes = [];
  let pos = 0;            // seconds into the demo
  let playing = false;
  let startAt = 0, startPos = 0, nextIndex = 0, timer = null;
  let resumeMusic = false; // was the background music playing before a catalog sound started?

  function playNote(nt, when) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    o.type = nt.type; o.frequency.value = nt.f;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(nt.g, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + nt.d);
    o.connect(g);
    if (p) { p.pan.value = Math.max(-1, Math.min(1, nt.pan)); g.connect(p); p.connect(master); } else g.connect(master);
    o.start(when); o.stop(when + nt.d + 0.05);
  }

  function schedule() {
    const now = ac.currentTime;
    pos = startPos + (now - startAt);
    if (pos >= DEMO_LENGTH) { // loop
      startPos = 0; startAt = now; pos = 0; nextIndex = 0;
    }
    while (nextIndex < notes.length && notes[nextIndex].t < pos + 0.25) {
      const nt = notes[nextIndex];
      if (nt.t >= pos - 0.02) playNote(nt, startAt + (nt.t - startPos));
      nextIndex++;
    }
    updateTime();
  }

  function seekIndex() { nextIndex = 0; while (nextIndex < notes.length && notes[nextIndex].t < pos) nextIndex++; }

  function demoPlay() {
    ensureAudio();
    // Pause the background music while a catalog sound plays (the video keeps moving)
    if (window.ORBEATS && ORBEATS.music && ORBEATS.music.isOn()) { resumeMusic = true; ORBEATS.music.mute(); }
    playing = true;
    startAt = ac.currentTime + 0.05; startPos = pos; seekIndex();
    clearInterval(timer); timer = setInterval(schedule, 50);
    claimNowPlaying();
    render();
  }
  // resume = true: bring the background music back if it was playing before
  function demoPause(resume) {
    playing = false;
    clearInterval(timer);
    render(); if (window.ORBEATS) ORBEATS.refresh();
    if (resume !== false && resumeMusic && window.ORBEATS) { resumeMusic = false; ORBEATS.setOverride(null); ORBEATS.music.enable(); }
  }
  function demoToggle() { if (playing) demoPause(); else demoPlay(); }

  // ---------- Hook into the now-playing bar ----------
  const control = {
    toggle: function () { if (DATASETS[current].real) ORBEATS.music.toggle(); else demoToggle(); },
    pause: function () { demoPause(false); },
    isPlaying: function () { return playing; },
    setVolume: function (v) { volume = v; if (master) master.gain.value = v; },
    level: function () {
      if (!analyser || !playing) return 0;
      analyser.getByteFrequencyData(levels);
      let sum = 0; for (let i = 0; i < 200; i++) sum += levels[i];
      return Math.min(16, sum / 200 / 2.5);
    }
  };
  function claimNowPlaying() {
    if (!window.ORBEATS) return;
    ORBEATS.setOverride(control, DATASETS[current].title, DEMO_NOTE);
  }

  // Stop the demo when the hero music starts
  document.addEventListener('orbeats:music', function (e) { if (e.detail.on && playing) { resumeMusic = false; demoPause(false); ORBEATS.setOverride(null); } });

  // ---------- Viewer ----------
  const $ = function (id) { return document.getElementById(id); };
  const playBtn = $('v-play'), timeline = $('v-timeline'), canvas = $('v-canvas'), ctx = canvas.getContext('2d');

  function fmt(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function updateTime() {
    if (DATASETS[current].real) return;
    $('v-time').textContent = fmt(pos) + ' / ' + fmt(DEMO_LENGTH);
    timeline.value = Math.round(pos / DEMO_LENGTH * 400);
  }

  function setText(id, text) { $(id).textContent = text; }

  function select(svs, autoplay) {
    if (playing) demoPause(false);
    current = svs; pos = 0;
    const d = DATASETS[svs];
    notes = d.real ? [] : makeDemo(svs);
    setText('v-svs', 'SVS ' + svs);
    setText('viewer-h', d.title);
    setText('v-visual-label', d.real ? 'Live: the hero video above plays this sonification' : '[Image placeholder: NASA visualization]');
    setText('v-note', d.real ? 'This is the real NASA sonification. It plays with the video at the top of the page (needs an internet connection).' : DEMO_NOTE);
    setText('v-source', d.source);
    $('v-link').href = 'https://svs.gsfc.nasa.gov/' + svs + '/';
    if (d.real) {
      setText('v-see', 'Hubble imagery of Caldwell 73, a globular cluster: a spherical group of stars held together by gravity.');
      setText('v-hear', 'A radar-like sweep turns each star into a note. Stars farther from the center sound higher.');
      setText('v-why', '[Why it matters placeholder]');
      $('v-map').innerHTML = '<dt>Pitch</dt><dd>Distance of each star from the center</dd><dt>Choir</dt><dd>The whole image</dd><dt>Marimba</dt><dd>Orange and red stars</dd><dt>Glockenspiel</dt><dd>Blue stars</dd>';
    } else {
      setText('v-see', '[What you are seeing placeholder: describe the ' + d.visual.toLowerCase() + ' visualization in plain words.]');
      setText('v-hear', '[What you are hearing placeholder: for example, higher pitch means more ' + d.visual.toLowerCase() + '.]');
      setText('v-why', '[Why it matters placeholder]');
      $('v-map').innerHTML = '<dt>Pitch</dt><dd>[Data variable placeholder]</dd><dt>Rhythm</dt><dd>[Time step placeholder]</dd><dt>Left / right</dt><dd>[Location placeholder]</dd>';
    }
    timeline.disabled = !!d.real;
    $('v-time').textContent = d.real ? 'Plays with the hero video' : fmt(0) + ' / ' + fmt(DEMO_LENGTH);
    timeline.value = 0;
    document.querySelectorAll('.cat-row').forEach(function (row) {
      const on = row.querySelector('.cat-play').dataset.svs === svs;
      row.classList.toggle('is-active', on);
    });
    $('v-status').textContent = 'Now exploring ' + d.title + '.';
    if (autoplay) {
      if (d.real) { ORBEATS.setOverride(null); if (!ORBEATS.music.isOn()) ORBEATS.music.enable(); }
      else demoPlay();
    }
    render();
  }

  function isOn() { return DATASETS[current].real ? (window.ORBEATS && ORBEATS.music.isOn()) : playing; }

  function render() {
    const on = isOn();
    playBtn.querySelector('.ic-play').hidden = on;
    playBtn.querySelector('.ic-pause').hidden = !on;
    playBtn.querySelector('.v-play-label').textContent = on ? 'Pause the sound' : 'Play the sound';
    document.querySelectorAll('.cat-play').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.svs === current && on ? 'true' : 'false');
    });
  }

  playBtn.addEventListener('click', function () {
    if (DATASETS[current].real) { ORBEATS.setOverride(null); ORBEATS.music.toggle(); render(); }
    else demoToggle();
  });
  timeline.addEventListener('input', function () {
    pos = timeline.value / 400 * DEMO_LENGTH;
    if (playing) { startAt = ac.currentTime; startPos = pos; seekIndex(); }
    updateTime();
  });
  document.querySelectorAll('.cat-play').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const svs = btn.dataset.svs;
      if (svs === current && isOn()) { if (DATASETS[svs].real) ORBEATS.music.mute(); else demoPause(); render(); return; }
      select(svs, true);
      if (window.matchMedia('(max-width: 1040px)').matches) $('viewer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  document.addEventListener('orbeats:music', render);

  // ---------- Visual: frequency bars from the live sound, or a quiet idle line ----------
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const bars = 48, gap = 3, bw = (w - 40 - gap * (bars - 1)) / bars;
    if (analyser && playing) analyser.getByteFrequencyData(levels);
    for (let i = 0; i < bars; i++) {
      let v;
      if (analyser && playing) v = levels[Math.floor(3 + Math.pow(i / bars, 1.7) * 190)] / 255;
      else v = 0.04 + 0.02 * Math.sin(Date.now() / 900 + i / 3);
      const bh = Math.max(2, v * (h - 60));
      ctx.fillStyle = 'rgba(127, 200, 248, ' + (0.35 + v * 0.65) + ')';
      ctx.fillRect(20 + i * (bw + gap), h - 20 - bh, bw, bh);
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  select('5313', false);
  window.ORBEATS_EXPLORE = { select: select, makeDemo: makeDemo };
})();
