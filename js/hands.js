// ORBEATS hand-tracking engine.
// It watches the webcam with MediaPipe HandLandmarker (stored in vendor/, so it works offline)
// and turns what it sees into simple events any game can listen to.
//
// PRIVACY: the video never leaves this page. Nothing is recorded, stored or uploaded.
//
// HOW TO USE IT
//   HandEngine.on('hand',    function (e) { e.present });            // true when a hand appears, false when lost
//   HandEngine.on('move',    function (e) { e.x, e.y });             // palm position, 0 to 1. x: 0 = left, 1 = right (mirrored). y: 0 = bottom, 1 = top
//   HandEngine.on('pinch',   function (e) { e.down });               // thumb and index finger touch (true) or let go (false)
//   HandEngine.on('pose',    function (e) { e.pose });               // 'open' (open palm), 'fist' or 'none'
//   HandEngine.on('fingers', function (e) { e.count });              // fingers raised, 0 to 4 (the thumb is not counted)
//   HandEngine.on('swipe',   function (e) { e.direction });          // 'left' or 'right'
//   HandEngine.on('status',  function (e) { e.state, e.message });   // 'loading', 'ready', 'denied', 'error', 'stopped'
//   HandEngine.start();      // asks for the camera, returns a Promise of true (running) or false (failed)
//   HandEngine.stop();       // turns the camera off
//   HandEngine.calibrate();  // short spoken calibration, returns a Promise
//
// Needs js/app.js and js/voice.js to be loaded first.

var HandEngine = (function () {

  // ---------- numbers you can tune ----------
  var TUNE = {
    smoothing: 0.4,       // 0 to 1. Lower = smoother but slower to follow the hand
    pinchOn: 0.35,        // pinch starts when thumb-index distance is below this (as a share of hand size)
    pinchOff: 0.55,       // ...and ends only above this. The gap stops flicker (hysteresis)
    holdMs: 350,          // a pose or finger count must stay the same this long before it counts
    lostMs: 500,          // hand must be gone this long before we say it is lost
    swipeDistance: 0.25,  // how far the palm must travel sideways (share of the picture)
    swipeMs: 450,         // ...within this time
    swipeCooldownMs: 1200
  };

  var MODEL_FOLDER = 'vendor/mediapipe/';

  // ---------- state ----------
  var handlers = {};          // event name -> list of functions
  var vision = null, files = null;   // the MediaPipe library and its WebAssembly files
  var landmarker = null;      // the MediaPipe model, loaded once
  var slowFrames = 0, switching = false;
  var video = null;           // hidden <video> that shows the webcam
  var stream = null;          // the webcam stream
  var running = false;
  var lastVideoTime = -1;

  var present = false;        // is a hand visible right now?
  var lastSeen = 0;
  var pos = { x: 0.5, y: 0.5 };   // smoothed palm position
  var pinching = false;
  var pose = 'none';
  var fingers = 0;
  var candidate = { pose: 'none', fingers: 0, since: 0 };   // what we see now, waiting to become stable
  var trail = [];             // recent palm positions, for swipes
  var lastSwipe = 0;
  var range = null;           // set by calibration: the part of the picture the user can reach
  var measure = null;         // set during calibration: a function that records where the hand has been
  var tone = null;            // the quiet guide tone
  var frames = 0, fpsStart = 0;

  var api = {
    running: false,
    fps: 0,
    delegate: '',             // 'GPU' or 'CPU', whichever is in use
    relaxed: false,           // Relaxed timing: more time for swipes and holds
    guideTone: true,          // quiet tone that follows the hand
    showPreview: true,        // draw the camera preview with the hand skeleton
    on: function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    start: start,
    stop: stop,
    calibrate: calibrate,
    feed: processHand,        // tests (and future input devices) can send hand landmarks directly
    position: function () { return { x: pos.x, y: pos.y, present: present }; },
    fingers: function () { return present ? fingers : 0; }   // the finger count right now
  };

  function emit(name, data) {
    var list = handlers[name] || [];
    for (var i = 0; i < list.length; i++) list[i](data || {});
  }

  function status(state, message) { emit('status', { state: state, message: message }); }

  // ---------- starting and stopping ----------

  // Is the graphics card real? Some computers only have a slow software one, and then the processor is faster.
  function hasRealGpu() {
    try {
      var gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return false;
      var info = gl.getExtension('WEBGL_debug_renderer_info');
      var name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
      return !/swiftshader|llvmpipe|software|basic render/i.test(name);
    } catch (e) { return false; }
  }

  // Build the hand model. delegate is 'GPU' (graphics card) or 'CPU' (processor).
  function buildModel(delegate) {
    return vision.HandLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL_FOLDER + 'hand_landmarker.task', delegate: delegate },
      runningMode: 'VIDEO',
      numHands: 2
    }).then(function (model) { landmarker = model; api.delegate = delegate; return model; });
  }

  function loadModel() {
    if (landmarker) return Promise.resolve(landmarker);
    // import() loads the MediaPipe library file. It only works from a web server (http://localhost),
    // not when the page is opened by double-click (file://).
    return import('../' + MODEL_FOLDER + 'vision_bundle.mjs').then(function (library) {
      vision = library;
      return vision.FilesetResolver.forVisionTasks(MODEL_FOLDER + 'wasm');
    }).then(function (wasmFiles) {
      files = wasmFiles;
      if (!hasRealGpu()) return buildModel('CPU');
      // Try the graphics card first (fast). If that fails, use the processor.
      return buildModel('GPU').catch(function () { return buildModel('CPU'); });
    });
  }

  // Safety net: if the graphics card turns out to be slow, switch to the processor once.
  function checkSpeed(ms) {
    if (api.delegate !== 'GPU' || switching) return;
    slowFrames = ms > 70 ? slowFrames + 1 : 0;
    if (slowFrames < 5) return;
    switching = true;
    var old = landmarker;
    buildModel('CPU').then(function () { old.close(); switching = false; }, function () { switching = false; });
  }

  function start() {
    if (running) return Promise.resolve(true);
    status('loading', 'Starting the camera…');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      status('error', 'This browser has no camera support.');
      return Promise.resolve(false);
    }

    return navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })
      .then(function (camera) {
        stream = camera;
        video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;       // shown live only. Never recorded or sent anywhere.
        return video.play();
      })
      .then(loadModel)
      .then(function () {
        running = true; api.running = true;
        fpsStart = performance.now(); frames = 0;
        status('ready', 'Camera is on, nothing is recorded.');
        requestAnimationFrame(loop);
        return true;
      })
      .catch(function (error) {
        stopCamera();
        var denied = error && (error.name === 'NotAllowedError' || error.name === 'NotFoundError' || error.name === 'NotReadableError' || error.name === 'OverconstrainedError');
        status(denied ? 'denied' : 'error', denied ? 'The camera is not available.' : 'Hand tracking could not start.');
        return false;
      });
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
    stream = null; video = null;
  }

  function stop() {
    if (!running && !stream) return;
    running = false; api.running = false;
    stopCamera();
    if (present) { present = false; emit('hand', { present: false }); }
    stopTone();
    clearPreview();
    status('stopped', 'Camera is off.');
  }

  // ---------- the loop: one pass per video frame ----------

  function loop() {
    if (!running) return;
    if (!switching && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      var before = performance.now();
      var result = landmarker.detectForVideo(video, before);
      checkSpeed(performance.now() - before);
      var hands = result.landmarks || [];
      // Two hands may be visible. We follow the first one MediaPipe reports.
      processHand(hands.length ? hands[0] : null);
      drawPreview(hands);

      frames++;
      var now = performance.now();
      if (now - fpsStart >= 1000) { api.fps = Math.round(frames * 1000 / (now - fpsStart)); frames = 0; fpsStart = now; }
    }
    requestAnimationFrame(loop);
  }

  // ---------- turning 21 landmarks into gestures ----------
  // MediaPipe gives 21 points per hand. The ones we use:
  //   0 wrist · 4 thumb tip · 5, 9, 13, 17 knuckles (index to pinky)
  //   8, 12, 16, 20 fingertips · 6, 10, 14, 18 middle joints

  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function processHand(points) {
    var now = performance.now();

    // No hand in this frame
    if (!points) {
      if (present && now - lastSeen > TUNE.lostMs) {
        present = false;
        setPinch(false); setStable('none', 0, now, true);
        trail = [];
        stopTone();
        if (settings.audio) SOUNDS.lost();
        emit('hand', { present: false });
      }
      return;
    }

    lastSeen = now;
    var wrist = points[0];
    var size = distance(wrist, points[9]) || 0.001;   // hand size, so gestures work near and far from the camera

    // Palm centre = average of the wrist and the four knuckles
    var palm = [0, 5, 9, 13, 17];
    var sumX = 0, sumY = 0;
    for (var i = 0; i < palm.length; i++) { sumX += points[palm[i]].x; sumY += points[palm[i]].y; }
    var rawX = 1 - sumX / palm.length;   // mirrored: moving your hand right moves x right
    var rawY = 1 - sumY / palm.length;   // flipped: up is 1

    // Calibration stretches the reachable area to the full 0-to-1 range
    if (range) {
      rawX = (rawX - range.x0) / (range.x1 - range.x0);
      rawY = (rawY - range.y0) / (range.y1 - range.y0);
    }
    if (measure) measure(rawX, rawY);
    rawX = Math.max(0, Math.min(1, rawX));
    rawY = Math.max(0, Math.min(1, rawY));

    if (!present) {
      present = true;
      pos.x = rawX; pos.y = rawY;
      if (settings.audio) SOUNDS.found();
      emit('hand', { present: true });
    }

    // Smoothing removes jitter: move only part of the way towards the new position
    pos.x += (rawX - pos.x) * TUNE.smoothing;
    pos.y += (rawY - pos.y) * TUNE.smoothing;
    emit('move', { x: pos.x, y: pos.y });
    updateTone();

    // Which fingers are raised? A finger is raised when its tip is clearly farther from the wrist than its middle joint.
    var tips = [8, 12, 16, 20], joints = [6, 10, 14, 18];
    var raised = 0;
    for (var f = 0; f < 4; f++) {
      if (distance(points[tips[f]], wrist) > distance(points[joints[f]], wrist) * 1.15) raised++;
    }
    var thumbOut = distance(points[4], points[5]) > size * 0.55;
    var indexReach = distance(points[8], wrist) / size;   // small when the index finger is curled into a fist

    // Pinch, with hysteresis: it starts below pinchOn and ends only above pinchOff
    var gap = distance(points[4], points[8]) / size;
    if (!pinching && gap < TUNE.pinchOn && indexReach > 1.05) setPinch(true);
    else if (pinching && gap > TUNE.pinchOff) setPinch(false);

    // Pose and finger count. While pinching we keep the last values, so a choice is not lost.
    if (!pinching) {
      var seenPose = 'none';
      if (raised === 4 && thumbOut) seenPose = 'open';
      else if (raised === 0 && indexReach < 1.05) seenPose = 'fist';
      setStable(seenPose, seenPose === 'open' ? 0 : raised, now, false);
    }

    detectSwipe(now);
  }

  function setPinch(down) {
    if (pinching === down) return;
    pinching = down;
    emit('pinch', { down: down });
  }

  // A pose or finger count only counts after it has stayed the same for holdMs.
  function setStable(seenPose, seenFingers, now, immediately) {
    if (seenPose !== candidate.pose || seenFingers !== candidate.fingers) {
      candidate = { pose: seenPose, fingers: seenFingers, since: now };
    }
    var hold = TUNE.holdMs * (api.relaxed ? 1.5 : 1);
    if (!immediately && now - candidate.since < hold) return;
    if (candidate.pose !== pose) { pose = candidate.pose; emit('pose', { pose: pose }); }
    if (candidate.fingers !== fingers) { fingers = candidate.fingers; emit('fingers', { count: fingers }); }
  }

  // Swipe = the palm travels far sideways in a short time, without moving much up or down.
  function detectSwipe(now) {
    var windowMs = TUNE.swipeMs * (api.relaxed ? 3 : 1);
    trail.push({ x: pos.x, y: pos.y, t: now });
    while (trail.length && now - trail[0].t > windowMs) trail.shift();
    if (now - lastSwipe < TUNE.swipeCooldownMs || trail.length < 3) return;
    // Compare with the farthest-left and farthest-right points of the last moment
    var minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (var i = 0; i < trail.length; i++) {
      minX = Math.min(minX, trail[i].x); maxX = Math.max(maxX, trail[i].x);
      minY = Math.min(minY, trail[i].y); maxY = Math.max(maxY, trail[i].y);
    }
    if (maxY - minY > 0.18) return;                       // moving up or down is not a swipe
    var direction = null;
    if (pos.x - minX > TUNE.swipeDistance) direction = 'right';
    else if (maxX - pos.x > TUNE.swipeDistance) direction = 'left';
    if (direction) {
      lastSwipe = now; trail = [];
      emit('swipe', { direction: direction });
    }
  }

  // ---------- guide tone: a quiet sound that tells a blind user where their hand is ----------
  // Pitch follows height (higher hand = higher note). Left-right follows the hand between the two ears.

  function updateTone() {
    if (!api.guideTone || !settings.audio) { stopTone(); return; }
    var ctx = getAudio();
    if (!tone) {
      tone = { osc: ctx.createOscillator(), gain: ctx.createGain(), pan: ctx.createStereoPanner() };
      tone.osc.type = 'sine';
      tone.gain.gain.value = 0.0001;
      tone.osc.connect(tone.gain); tone.gain.connect(tone.pan); tone.pan.connect(voice.master);
      tone.osc.start();
      tone.gain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.2);
    }
    var frequency = 220 * Math.pow(2, pos.y * 2);          // 220 Hz at the bottom, 880 Hz at the top
    tone.osc.frequency.setTargetAtTime(frequency, ctx.currentTime, 0.05);
    tone.pan.pan.setTargetAtTime(pos.x * 2 - 1, ctx.currentTime, 0.05);
  }

  function stopTone() {
    if (!tone) return;
    var old = tone; tone = null;
    var ctx = getAudio();
    old.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
    old.osc.stop(ctx.currentTime + 0.3);
  }

  // ---------- camera preview with the hand skeleton ----------

  var BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

  function clearPreview() {
    var canvas = document.getElementById('hand-preview');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawPreview(hands) {
    var canvas = document.getElementById('hand-preview');
    if (!canvas || !api.showPreview || canvas.hidden) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    // Draw the camera picture mirrored, like a mirror
    ctx.save();
    ctx.translate(w, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
    ctx.fillStyle = 'rgba(5, 8, 15, 0.45)';
    ctx.fillRect(0, 0, w, h);
    // Draw each hand as lines and dots
    for (var n = 0; n < hands.length; n++) {
      var p = hands[n];
      ctx.strokeStyle = '#7FC8F8'; ctx.lineWidth = 2;
      for (var b = 0; b < BONES.length; b++) {
        ctx.beginPath();
        ctx.moveTo((1 - p[BONES[b][0]].x) * w, p[BONES[b][0]].y * h);
        ctx.lineTo((1 - p[BONES[b][1]].x) * w, p[BONES[b][1]].y * h);
        ctx.stroke();
      }
      ctx.fillStyle = '#E8EDF5';
      for (var k = 0; k < p.length; k++) {
        ctx.beginPath(); ctx.arc((1 - p[k].x) * w, p[k].y * h, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // ---------- spoken calibration ----------
  // Three short steps. Each one is confirmed with a sound. A step ends as soon as it is done,
  // or after a few seconds, so nobody gets stuck.

  function waitFor(check, maxMs) {
    return new Promise(function (resolve) {
      var began = performance.now();
      var timer = setInterval(function () {
        var ok = check();
        if (ok || performance.now() - began > maxMs || !running) { clearInterval(timer); resolve(ok); }
      }, 100);
    });
  }

  function calibrate() {
    var stepMs = (voice.fast ? 300 : 5000) * (api.relaxed ? 3 : 1);
    var seen = { x0: 1, x1: 0, y0: 1, y1: 0 };
    range = null;   // measure the raw picture again
    measure = function (x, y) {
      seen.x0 = Math.min(seen.x0, x); seen.x1 = Math.max(seen.x1, x);
      seen.y0 = Math.min(seen.y0, y); seen.y1 = Math.max(seen.y1, y);
    };

    return say('Hold your hand up in front of the camera.')
      .then(function () { return waitFor(function () { return present; }, stepMs); })
      .then(function (ok) { if (ok) SOUNDS.ok(); return say(ok ? 'I can see your hand. Move it up and down.' : 'I cannot see a hand yet. Try moving it up and down.'); })
      .then(function () { return waitFor(function () { return seen.y1 - seen.y0 > 0.25; }, stepMs); })
      .then(function (ok) { if (ok) SOUNDS.ok(); return say('Move it left and right.'); })
      .then(function () { return waitFor(function () { return seen.x1 - seen.x0 > 0.25; }, stepMs); })
      .then(function (ok) {
        if (ok) SOUNDS.ok();
        measure = null;
        // Use the measured area only if it is big enough to be trusted
        if (seen.x1 - seen.x0 > 0.25 && seen.y1 - seen.y0 > 0.25) range = seen;
        return say(present ? 'Calibration done.' : 'Calibration finished, but I could not see your hand. Keyboard and touch still work.');
      });
  }

  return api;
})();
