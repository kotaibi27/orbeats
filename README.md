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

Internet is needed for two things: the fonts (Newsreader and Inter from Google Fonts) and the live Sun viewer on the home page. Without internet the page still works, with fallback fonts and a fallback message instead of the Sun viewer.

## What is in the repo

    index.html          Home page (Sun viewer, live status row, data catalog)
    explore.html        Tab 1: Explore (empty content area for us to fill)
    play.html           Tab 2: Play (game on/off switches, game mode, controls)
    compose.html        Tab 3: Compose (empty content area for us to fill)
    audio-first.html    Audio-first mode (voice guide, big buttons, keyboard shortcuts)
    components.html     Colors, type and controls reference
    css/style.css       All styles
    js/shared.js        Header, footer, now-playing bar, accessibility toolbar, data catalog
    js/home.js          Home page: catalog list and the moving status values
    js/play.js          Play page switches and controls
    js/audio-first.js   Audio-first mode tracks and keyboard shortcuts
    js/components.js    Component set page

## Where to edit

- Header, footer or now-playing bar: `js/shared.js` (edit once, every page changes).
- The NASA data catalog: the `CATALOG` list at the top of `js/shared.js`. The home page list and the audio-first tracks both read it.
- Game names: the `GAMES` list at the top of `js/play.js`.
- Explore and Compose content: put it inside the content area of `explore.html` and `compose.html` (look for the comment "Empty on purpose").
- Colors: the variables at the top of the `.app` rule in `css/style.css`.

## Things to know

- The values in the home page status row are sample values that move on their own. They are marked "[Sample value]". Replace the `refresh()` function in `js/home.js` with real data when ready.
- The Sun viewer on the home page is an embedded third-party page (https://astrodavid10.github.io/sol-solar-viewer/). Check that its creator is happy with the embed and credit them.
- The Play and Now playing buttons do not make sound yet. They only switch the state and animation. Audio comes next.
- The accessibility toolbar settings (text size, contrast, audio, captions) are remembered while moving between pages.
- Add `?data=down` to the home page address to preview the "data unavailable" look.

## Credits

Data and visualizations: NASA Scientific Visualization Studio (https://svs.gsfc.nasa.gov/). Sun imagery: NASA Solar Dynamics Observatory. This is not an official NASA product.

The original design lives in the Claude Design file: https://claude.ai/artifact/Gx81G4nvM9z1FzZ2nvYGay
