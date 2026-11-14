// ORBEATS shared behaviour: accessibility toolbar, now-playing bar, switches and music.
// Settings are remembered between pages with localStorage.

(function () {
  const app = document.getElementById('app');

  // ---------------------------------------------------------------
  // 1. Saved settings (text size, high contrast, audio, captions)
  // ---------------------------------------------------------------
  let settings = { scale: 1, hc: false, audio: true, cc: true };
  try {
    settings = Object.assign(settings, JSON.parse(localStorage.getItem('orbeats-settings') || '{}'));
  } catch (e) { /* storage unavailable: use defaults */ }

  // Generic play state for pages without music (kept for your own audio code)
  let playing = true;

  function save() {
    try { localStorage.setItem('orbeats-settings', JSON.stringify(settings)); } catch (e) {}
  }

  // ---------------------------------------------------------------
  // 2. Music: the audio track of "Data Sonification: Caldwell 73"
  //    Home page: the hero <video id="bg-video"> IS the music, so sound
  //    and picture always stay in sync. Other pages: if the visitor turned
  //    the sound on, the same video file continues in a hidden player.
  //    Sound never starts without the visitor's choice.
  // ---------------------------------------------------------------
  const MUSIC_SRC = 'https://svs.gsfc.nasa.gov/vis/a010000/a013700/a013786/Caldwell73_2K_Final';
  const MUSIC_TITLE = 'Data Sonification: Caldwell 73';
  const MUSIC_CAPTION = 'Each star in this Hubble image becomes a note. Stars farther from the center sound higher.';
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  let music = { on: false, volume: 0.8, time: 0, userMuted: false };
  try { music = Object.assign(music, JSON.parse(localStorage.getItem('orbeats-music') || '{}')); } catch (e) {}

  let player = document.getElementById('bg-video');
  const isHome = !!player;
  let failed = false;    // the video could not load
  let motion = true;
  let override = null;   // another player (the Explore demo) that is using the now-playing bar     // home: picture moving (the Pause button in the bottom bar stops it)
  let blocked = false;   // the browser refused to start sound

  if (!player && music.on) {
    player = document.createElement('video');
    player.loop = true;
    player.preload = 'auto';
    player.setAttribute('playsinline', '');
    player.hidden = true;
    player.src = player.canPlayType('video/webm') ? MUSIC_SRC + '.webm' : MUSIC_SRC + '.mp4';
    document.body.appendChild(player);
    const t = document.querySelector('.np-title');
    if (t) t.textContent = MUSIC_TITLE;
    const c = document.querySelector('#np-cap span');
    if (c) c.textContent = MUSIC_CAPTION;
  }

  function saveMusic() {
    if (player) music.time = player.currentTime || 0;
    try { localStorage.setItem('orbeats-music', JSON.stringify(music)); } catch (e) {}
  }

  function soundOn() {
    return !!player && !failed && !blocked && !player.muted && !player.paused;
  }

  // Turn the sound on. volume is optional (the big hero button uses 0.8).
  function enableSound(volume) {
    if (!player || failed) return;
    if (typeof volume === 'number') music.volume = volume;
    if (music.volume === 0) music.volume = 0.8;
    player.volume = music.volume;
    player.muted = false;
    blocked = false;
    music.on = true;
    music.userMuted = false;
    if (isHome) setMotion(true);
    if (override) { override.pause(); setOverride(null); }
    document.dispatchEvent(new CustomEvent('orbeats:music', { detail: { on: true } }));
    settings.audio = true;
    save();
    player.play().then(function () { saveMusic(); render(); }).catch(function () {
      blocked = true;
      player.muted = true;
      if (isHome) player.play().catch(function () {});   // keep the picture moving
      render();
    });
    render();
  }

  // Mute but keep the video playing (home page picture stays alive).
  function muteSound() {
    if (!player) return;
    music.on = false;
    player.muted = true;
    if (!isHome) player.pause();
    saveMusic();
    document.dispatchEvent(new CustomEvent('orbeats:music', { detail: { on: false } }));
    render();
  }

  // Pause picture and sound together (they are the same element).
  function pauseSound() {
    if (!player) return;
    music.on = false;
    player.pause();
    saveMusic();
    render();
  }

  // Home: start or stop all motion (video and the animated star picture)
  function setMotion(on) {
    motion = on;
    if (player && !failed) { if (on) player.play().catch(function () {}); else player.pause(); }
    document.dispatchEvent(new CustomEvent('orbeats:motion', { detail: { running: on } }));
  }

  function togglePlayPause() { if (soundOn()) pauseSound(); else enableSound(); }
  function toggleMute() { if (soundOn()) { music.userMuted = true; muteSound(); } else enableSound(0.8); }

  if (player) {
    player.volume = music.volume;
    player.addEventListener('loadedmetadata', function () {
      if (!isHome && music.time && music.time < player.duration) player.currentTime = music.time;
    }, { once: true });
    player.addEventListener('error', markFailed);
    const lastSource = player.querySelector('source:last-of-type');
    if (lastSource) lastSource.addEventListener('error', markFailed);
    // The error may fire before this script runs, so also check the network state.
    function checkSource() { if (player.networkState === 3) markFailed(); }   // 3 = no usable source
    checkSource();
    setTimeout(checkSource, 4000);
    player.addEventListener('play', render);
    player.addEventListener('pause', render);
    window.addEventListener('pagehide', saveMusic);

    if (isHome) player.play().catch(function () {});   // silent picture loop
    if (isHome && !music.on && !music.userMuted) autoStartMusic();
    if (music.on) {
      // The visitor chose sound on a previous page: try to continue, fall back to the button.
      player.muted = false;
      player.play().then(render).catch(function () { blocked = true; player.muted = true; if (isHome) player.play().catch(function () {}); render(); });
    }
  }

  // Home: start the music by itself. Browsers usually block sound until the visitor
  // interacts, so if that happens the music starts on the first tap, click or key press
  // anywhere on the page. (On a museum kiosk, launch Chrome with
  // --autoplay-policy=no-user-gesture-required and it starts straight away.)
  function autoStartMusic() {
    player.volume = music.volume || 0.8;
    player.muted = false;
    player.play().then(function () {
      music.on = true; settings.audio = true; saveMusic(); render();
      document.dispatchEvent(new CustomEvent('orbeats:music', { detail: { on: true } }));
    }).catch(function () {
      player.muted = true;
      player.play().catch(function () {});
      armFirstInteraction();
      render();
    });
  }

  function armFirstInteraction() {
    const events = ['pointerdown', 'keydown', 'touchstart'];
    function go(e) {
      events.forEach(function (ev) { document.removeEventListener(ev, go, true); });
      // These controls decide about sound themselves
      if (e.target.closest && e.target.closest('#sound-btn, #np-play, [data-setting="audio"], .cat-play, #v-play, #np-vol')) return;
      if (!soundOn() && !music.userMuted && !failed) enableSound(music.volume || 0.8);
    }
    events.forEach(function (ev) { document.addEventListener(ev, go, true); });
  }

  function markFailed() {
    failed = true;
    document.body.classList.add('bg-failed');
    render();
  }


  // ---------------------------------------------------------------
  // 3. Draw the current state on the page
  // ---------------------------------------------------------------
  function setHidden(id, hide) { const el = document.getElementById(id); if (el) el.hidden = hide; }

  function render() {
    const musicMode = !!player;
    if (musicMode) playing = isHome ? motion : soundOn();
    if (override) playing = override.isPlaying();

    app.style.fontSize = 'calc(1rem * ' + settings.scale + ')';
    app.classList.toggle('hc', settings.hc);
    app.classList.toggle('paused', !(playing && settings.audio));
    app.classList.toggle('music-on', soundOn());
    app.classList.toggle('motion-off', isHome && !motion);

    const pct = document.getElementById('text-pct');
    if (pct) pct.textContent = Math.round(settings.scale * 100) + '%';

    document.querySelectorAll('[data-setting]').forEach(function (btn) {
      const on = btn.dataset.setting === 'audio' && override ? override.isPlaying() : (musicMode && btn.dataset.setting === 'audio' ? soundOn() : settings[btn.dataset.setting]);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.querySelector('.state').textContent = on ? 'On' : 'Off';
    });

    setHidden('np-cap', override ? !(settings.cc && playing) : (musicMode ? !(settings.cc && soundOn()) : !settings.cc));
    setHidden('np-audio-off', musicMode ? true : settings.audio);

    // Home hero controls
    const big = document.getElementById('sound-btn');
    if (big) {
      big.disabled = failed;
      const on = soundOn();
      big.classList.toggle('is-on', on);
      big.querySelector('.sound-label').textContent = failed ? 'Unavailable' : (on ? 'Mute the music' : 'Tap to hear the music');
      big.querySelector('.ic-speaker').hidden = on;
      big.querySelector('.ic-mute').hidden = !on;
    }
    setHidden('sound-blocked', !blocked || failed);
    setHidden('sound-cap', !settings.cc);

    const lowerBtn = document.getElementById('music-btn');
    if (lowerBtn) {
      lowerBtn.disabled = failed;
      lowerBtn.querySelector('.music-label').textContent = failed ? 'Unavailable' : (playing ? 'Pause the music' : 'Play the music');
      lowerBtn.querySelector('.ic-play').hidden = playing;
      lowerBtn.querySelector('.ic-pause').hidden = !playing;
    }

    const npVol = document.getElementById('np-vol');
    if (npVol && musicMode) { npVol.value = Math.round(music.volume * 100); npVol.disabled = failed; }

    document.querySelectorAll('#np-play, #af-play').forEach(function (btn) {
      if (musicMode) btn.disabled = failed && !isHome;
      btn.querySelector('.ic-pause').hidden = !playing;
      btn.querySelector('.ic-play').hidden = playing;
      if (btn.id === 'np-play') btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      else btn.querySelector('span span:last-child').textContent = playing ? 'Pause track' : 'Play track';
    });
  }

  // ---------------------------------------------------------------
  // 4. Toolbar buttons
  // ---------------------------------------------------------------
  document.querySelectorAll('[data-action="text-smaller"]').forEach(function (b) {
    b.addEventListener('click', function () { settings.scale = Math.max(1, Math.round((settings.scale - 0.15) * 100) / 100); save(); render(); });
  });
  document.querySelectorAll('[data-action="text-bigger"]').forEach(function (b) {
    b.addEventListener('click', function () { settings.scale = Math.min(1.6, Math.round((settings.scale + 0.15) * 100) / 100); save(); render(); });
  });
  document.querySelectorAll('[data-setting]').forEach(function (b) {
    b.addEventListener('click', function () {
      const key = b.dataset.setting;
      if (key === 'audio' && override) {          // Audio on/off controls the Explore demo while it owns the bar
        if (override.isPlaying()) override.pause(); else override.toggle();
        render(); return;
      }
      if (key === 'audio' && player) {            // Audio on/off controls the music
        if (soundOn()) { settings.audio = false; save(); music.userMuted = true; muteSound(); }
        else enableSound();
        return;
      }
      settings[key] = !settings[key];
      save(); render();
    });
  });

  // ---------------------------------------------------------------
  // 5. Play / pause and volume (now-playing bar, hero, audio-first)
  // ---------------------------------------------------------------
  // Let another player (Explore demo sounds) use the now-playing bar
  function setOverride(obj, title, caption) {
    override = obj;
    const t = document.querySelector('.np-title');
    const c = document.querySelector('#np-cap span');
    if (t) t.textContent = obj ? title : (player ? MUSIC_TITLE : t.textContent);
    if (c) c.textContent = obj ? caption : (player ? MUSIC_CAPTION : c.textContent);
    render();
  }

  function togglePlay() {
    if (override) { override.toggle(); render(); return; }
    if (isHome) { setMotion(!motion); render(); return; }
    if (player) { togglePlayPause(); return; }
    playing = !playing; render();
    document.dispatchEvent(new CustomEvent('orbeats:play', { detail: { playing: playing } }));
  }
  document.querySelectorAll('#np-play, #af-play, #music-btn').forEach(function (b) { b.addEventListener('click', togglePlay); });

  const bigBtn = document.getElementById('sound-btn');
  if (bigBtn) bigBtn.addEventListener('click', toggleMute);
  const blockedBtn = document.getElementById('sound-blocked');
  if (blockedBtn) blockedBtn.addEventListener('click', function () { enableSound(0.8); });

  const npVol = document.getElementById('np-vol');
  if (npVol && player) {
    npVol.addEventListener('input', function () {
      if (override) { override.setVolume(npVol.value / 100); return; }
      music.volume = npVol.value / 100;
      player.volume = music.volume;
      if (music.volume > 0 && !soundOn()) enableSound();
      saveMusic();
    });
  }

  // ---------------------------------------------------------------
  // 6. Generic on/off switches (role="switch") and sliders with outputs
  // ---------------------------------------------------------------
  document.querySelectorAll('.switch[role="switch"]').forEach(function (sw) {
    sw.addEventListener('click', function () {
      const on = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
      sw.querySelector('.state').textContent = on ? 'On' : 'Off';
      sw.dispatchEvent(new CustomEvent('orbeats:switch', { bubbles: true, detail: { on: on } }));
    });
  });
  document.querySelectorAll('input[type="range"][data-output]').forEach(function (s) {
    s.addEventListener('input', function () { document.getElementById(s.dataset.output).textContent = s.value; });
  });

  // ---------------------------------------------------------------
  // 7. Level meter in the now-playing bar (simulated while sound plays)
  // ---------------------------------------------------------------
  const meterBars = Array.prototype.slice.call(document.querySelectorAll('.np .meter i'));
  let level = 0;
  function drawMeter() {
    if (override) {
      level += (override.level() - level) * 0.4;
      meterBars.forEach(function (bar, i) { bar.classList.toggle('on', i < Math.round(level)); });
      setTimeout(drawMeter, 120);
      return;
    }
    const target = (player ? soundOn() : playing && settings.audio) ? (reduceMotion ? 9 : 6 + Math.random() * 8) * (player ? music.volume / 0.8 : 1) : 0;
    level += (target - level) * (reduceMotion ? 1 : 0.15);
    meterBars.forEach(function (bar, i) { bar.classList.toggle('on', i < Math.round(level)); });
    setTimeout(drawMeter, reduceMotion ? 1000 : 120);
  }
  if (meterBars.length) drawMeter();

  // ---------------------------------------------------------------
  // 8. Small public helper for your own audio code
  // ---------------------------------------------------------------
  window.ORBEATS = {
    setNowPlaying: function (title, caption) {
      const t = document.querySelector('.np-title');
      const c = document.querySelector('#np-cap span');
      if (t && title) t.textContent = title;
      if (c && caption) c.textContent = caption;
    },
    togglePlay: togglePlay,
    setOverride: setOverride,
    refresh: function () { render(); },
    music: {
      enable: function () { enableSound(0.8); },
      mute: muteSound,
      toggle: function () { if (soundOn()) muteSound(); else enableSound(0.8); },
      isOn: soundOn,
      failed: function () { return failed; }
    },
    isPlaying: function () { return playing; },
    settings: settings
  };

  render();
})();
