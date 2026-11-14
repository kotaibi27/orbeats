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
