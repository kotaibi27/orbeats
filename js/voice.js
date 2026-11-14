// ORBEATS voice and sound helpers for the Play tab.
// - say(text)      speaks the text aloud AND shows it as a live caption
// - beep(...)      plays one short tone
// - getAudio()     the shared Web Audio context (created on the first click, as browsers require)
// Everything respects the Audio and Captions buttons in the accessibility bar (js/app.js).

// The accessibility settings (audio on/off, captions on/off...) live in js/app.js.
var settings = ORBEATS.settings;

var voice = {
  ctx: null,       // the AudioContext
  master: null,    // master volume, linked to the volume slider in the now-playing bar
  fast: /[?&]fast=1/.test(location.search)   // ?fast=1 skips waiting for speech (used by the tests)
};

function getAudio() {
  if (!voice.ctx) {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    voice.ctx = new AudioCtx();
    voice.master = voice.ctx.createGain();
    voice.master.connect(voice.ctx.destination);
    updateMasterVolume();
  }
  if (voice.ctx.state === 'suspended') voice.ctx.resume();
  return voice.ctx;
}

// Volume = the slider in the now-playing bar. Zero when Audio is switched off.
function updateMasterVolume() {
  if (!voice.master) return;
  var slider = document.getElementById('np-vol');
  var volume = slider ? slider.value / 100 : 0.7;
  voice.master.gain.value = settings.audio ? volume : 0;
}

// Play one tone. when = seconds from now, pan = -1 (left) to 1 (right).
function beep(frequency, seconds, loudness, when, pan, type) {
  var ctx = getAudio();
  var start = ctx.currentTime + (when || 0);
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  var panner = ctx.createStereoPanner();
  osc.type = type || 'sine';
  osc.frequency.value = frequency;
  panner.pan.value = pan || 0;
  // quick fade in and out so there is no click
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(loudness || 0.2, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain); gain.connect(panner); panner.connect(voice.master);
  osc.start(start);
  osc.stop(start + seconds + 0.05);
}

// Small ready-made sounds, so every part of the game sounds the same.
var SOUNDS = {
  ok: function () { beep(660, 0.12, 0.2); beep(880, 0.18, 0.2, 0.12); },          // step confirmed
  found: function () { beep(523, 0.12, 0.15); beep(784, 0.2, 0.15, 0.1); },       // hand found
  lost: function () { beep(196, 0.35, 0.2); },                                    // hand lost
  right: function () { beep(523, 0.12, 0.2); beep(659, 0.12, 0.2, 0.12); beep(784, 0.3, 0.2, 0.24); },
  wrong: function () { beep(233, 0.25, 0.2); beep(175, 0.4, 0.2, 0.22); },
  tick: function () { beep(440, 0.06, 0.12); }
};

// Speak text aloud and show it as a caption. Returns a Promise that resolves when the speech ends,
// so game code can write:  await say('Round 1');
function say(text) {
  // 1. Caption (also read by screen readers, because the box is an ARIA live region)
  var box = document.getElementById('game-caption');
  if (box) box.textContent = text;

  // 2. Speech
  return new Promise(function (resolve) {
    if (voice.fast) { setTimeout(resolve, 30); return; }
    var canSpeak = 'speechSynthesis' in window && settings.audio;
    // If speech is not available, wait about as long as reading the caption takes.
    var readingTime = 600 + text.length * 55;
    if (!canSpeak) { setTimeout(resolve, readingTime); return; }

    var done = false;
    var began = Date.now();
    function finish() {
      if (done) return;
      done = true;
      // If the "speech" ended almost at once, this device has no voice: give time to read the caption instead.
      if (Date.now() - began < 300) setTimeout(resolve, readingTime); else resolve();
    }
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.cancel();          // never talk over an older sentence
    window.speechSynthesis.speak(utterance);
    setTimeout(finish, readingTime + 4000);   // safety net: some browsers never fire onend
  });
}

function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// A pause that game code can await:  await wait(500);
function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, voice.fast ? Math.min(ms, 40) : ms); });
}

// Keep the volume and captions in step with the accessibility bar and the volume slider.
function applySettings() {
  updateMasterVolume();
  if (!settings.audio) stopSpeaking();
  var box = document.getElementById('game-caption');
  if (box) box.classList.toggle('sr', !settings.cc);   // Captions off: hidden on screen, still read by screen readers
}
// js/app.js changes the settings when a toolbar button is clicked. We look right after the click.
document.querySelectorAll('[data-setting]').forEach(function (button) {
  button.addEventListener('click', function () { setTimeout(applySettings, 0); });
});
document.getElementById('np-vol').addEventListener('input', updateMasterVolume);
