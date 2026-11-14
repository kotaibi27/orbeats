# ORBEATS

The Earth Information Jukebox. A website that turns NASA Earth data into something people can explore, play and compose with, with a voice-guided audio-first mode for blind and low-vision visitors.

Built for the NASA Space Apps Challenge 2026, challenge "The Earth Information Jukebox".

This is the website template. The Explore and Compose sections are empty on purpose, so the team can fill them in.

## How to run it on any laptop

No install is needed. It is plain HTML, CSS and JavaScript.

Option 1 (easiest): download or clone this repo, then double-click `index.html`.

Option 2 (local server): open a terminal in this folder and run

    python3 -m http.server 8000

then open http://localhost:8000 in a browser. Use this if you plan to load data files with fetch(), because browsers block that when a page is opened as a file.

Fonts are bundled in `fonts/`, so they work offline. The home page background video streams from NASA (internet needed). To make it work offline too, download `Caldwell73_2K_Final.webm` from https://svs.gsfc.nasa.gov/13786/ and save it as `media/caldwell73.webm`; the page uses that copy first.

## What is in the repo

    index.html          Tab 1: Explore and home (video hero with music, impact numbers, why it matters, data catalog)
    play.html           Tab 2: Play (game on/off switches, game mode, controls)
    compose.html        Tab 3: Compose (empty content area for us to fill)
    audio-first.html    Audio-first mode (voice guide, big buttons, keyboard shortcuts)
    components.html     Colors, type and controls reference
    css/style.css       All styles
    js/shared.js        Header, footer, now-playing bar, accessibility toolbar, data catalog
    js/home.js          Home page: catalog list, background video and music button
    js/play.js          Play page switches and controls
    js/audio-first.js   Audio-first mode tracks and keyboard shortcuts
    js/components.js    Component set page

## Where to edit

- Header, footer or now-playing bar: `js/shared.js` (edit once, every page changes).
- The NASA data catalog: the `CATALOG` list at the top of `js/shared.js`. The home page list and the audio-first tracks both read it.
- Game names: the `GAMES` list at the top of `js/play.js`.
- Explore is the home page (`index.html`). Compose content goes inside the content area of `compose.html` (look for the comment "Empty on purpose").
- Colors: the variables at the top of the `.app` rule in `css/style.css`.

## Things to know

- The Play and Now playing buttons do not make sound yet. They only switch the state and animation. Audio comes next.
- The accessibility toolbar settings (text size, contrast, audio, captions) are remembered while moving between pages.

## Credits

Data, video and sonification: NASA Scientific Visualization Studio (https://svs.gsfc.nasa.gov/, SVS 13786, Caldwell 73, Hubble imagery). This is not an official NASA product.

The original design lives in the Claude Design file: https://claude.ai/artifact/Gx81G4nvM9z1FzZ2nvYGay
