# ORBEATS — The Earth Information Jukebox

Static website template (space palette version). Home page background: NASA SVS 13786, Data Sonification: Caldwell 73.
Plain HTML, CSS and JavaScript. No build step and no Claude canvas runtime (`support.js`) needed.

## Run it

Open `index.html` in a browser, or serve the folder locally:

    python -m http.server 8000

then visit http://localhost:8000

## Files

| File | Page |
|---|---|
| `index.html` | Explore (home): video hero, who it is for, why it works, audio-first, data catalog |
| `play.html` | Tab 2 — game picker, game mode, controls selector, empty stage |
| `compose.html` | Tab 3 — empty content canvas |
| `audio-first.html` | Audio-first mode (working keyboard shortcuts) |
| `components.html` | Component set |
| `css/styles.css` | All styles and colour tokens |
| `js/app.js` | Accessibility toolbar, now-playing bar, switches (shared by every page) |
| `js/home.js` | Hero star animation, count-up numbers |
| `js/explore.js` | Explore: catalog list + viewer (sound, timeline, visualizer, explanation) |
| `js/play.js`, `js/audio-first.js` | Page-specific behaviour |
| `js/hands.js` | Reusable hand-tracking engine (MediaPipe, runs in the browser) |
| `js/voice.js` | Speech and Web Audio helpers used by the games |
| `js/games/guess-year.js` | Game 1, Guess the Year |
| `js/games/guess-year-data.js` | The game's data (placeholder numbers, swap here) |
| `vendor/mediapipe/` | Hand model and WASM files, stored locally (see `vendor/README.md`) |
| `tests/run.js` | Playwright tests |

## Adding your content

- Compose: replace the dashed `.zone` boxes inside `<main>` with your own markup.
- Explore viewer: the 8 Earth datasets play a DEMO sound generated in the browser (`makeDemo()` in `js/explore.js`). Replace each case with real NASA data. Caldwell 73 plays the real sonification from the hero video.
- Now-playing bar from your own audio code:

      ORBEATS.setNowPlaying('Change in Night Lights between 2012 and 2023', 'Brighter areas play higher notes');
      document.addEventListener('orbeats:play', e => e.detail.playing ? myAudio.play() : myAudio.pause());

- `ORBEATS.settings.audio` and `ORBEATS.settings.cc` tell you whether audio and captions are on.

All motion stops when the visitor's system prefers reduced motion.
Data and visualizations: NASA Scientific Visualization Studio.

## Explore (home) hero

Layers inside `<section class="hero">`, bottom to top (`index.html`, `css/home.css`, `js/home.js`):

1. Navy `#05080F`
2. `#hero-canvas`: animated stars drifting outward with ice-blue beat rings. Always running, so the screen is never still, even if the video fails.
3. `#bg-video`: the Caldwell 73 video (SVS 13786), full brightness, `object-fit: cover`. It fades in once it actually plays.
4. `.hero-shade`: soft fade at the bottom only, behind the text.
5. Wordmark, subtitle, buttons, caption and credit (lower left).

Motion ignores the system reduce-motion setting by design; the Pause button in the now-playing bar stops the video and the animation together.

Sound is the video's own audio track (no separate file). "Tap to hear the music" unmutes at 80%. The big button, the now-playing
Play/Pause and volume, and the toolbar Audio toggle all control the same video element (`js/app.js`, section 2).
If the browser blocks sound, "Sound is blocked. Tap the button again to turn it on." appears.

To swap the video: change the two `<source>` lines in `index.html` and `MUSIC_SRC` / `MUSIC_TITLE` in `js/app.js`.

## Play tab: Guess the Year

The player hears 10 seconds of sound made from one year of a dataset, then picks the year from 4 options. 5 rounds per game. Everything is spoken aloud and shown as captions.

| Action | Hand (camera) | Keyboard | Touch |
|---|---|---|---|
| Choose a year | Raise 1 to 4 fingers, or move the hand up and down ("Hand height") | 1 to 4 | Tap a year |
| Lock it in | Pinch and hold for 1 second | Enter | Tap the year again, or Lock in |
| Repeat the sound | Open palm | R | Repeat sound |
| Skip the round | Fist (hold 1 second) | N | Skip |
| Change the dataset | Swipe left or right | Left and right arrows | Arrow buttons |
| Start, play again | Pinch | Enter | Start game |

To use the camera, choose "Camera and hand gestures" under Controls (serve the folder with `python -m http.server 8000`, because browsers only allow the camera on localhost or https). The page says what will happen, asks for the camera, then runs a short spoken calibration. If the camera is refused or missing it switches to keyboard and touch by itself. The video is never recorded, stored or uploaded.

How the sound is made: a bigger value plays a higher and louder note, and a year with a bigger average plays a faster pulse.

### How to swap in real data

Edit only `js/games/guess-year-data.js`. The steps are written at the top of that file. In short: replace each year's list of numbers with real values, then set `placeholder: false`. The numbers in the file today are made-up sample values, and the game says "sample data" aloud until you change that flag. The spoken fact after each answer is calculated from the numbers, so it updates by itself.

### How to use the hand engine in another game

    HandEngine.on('pinch', function (e) { if (e.down) { /* ... */ } });
    HandEngine.on('fingers', function (e) { /* e.count is 0 to 4 */ });
    HandEngine.start();

The full list of events is at the top of `js/hands.js`. The numbers that decide what counts as a pinch, fist or swipe are in the `TUNE` block there.

## How to test

    npm install --no-save playwright
    npx playwright install chromium
    node tests/run.js

This checks the keyboard-only path, the camera-denied path and every hand gesture (using simulated hand positions). To also test the real camera pipeline with Chrome's fake webcam, record a short video of a hand moving up, down, left and right, then leaving the picture, convert it and pass it in:

    ffmpeg -i my-hand.mp4 -vf scale=640:480 -pix_fmt yuv420p hand.y4m
    HAND_VIDEO=$PWD/hand.y4m node tests/run.js
