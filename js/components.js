// Component set page: the color swatches, the demo switch and the demo slider.

var COLORS = [
  { hex: '#05080F', name: 'Space', use: 'Background', dark: false },
  { hex: '#0B1220', name: 'Panel', use: 'Surfaces', dark: false },
  { hex: '#121B2E', name: 'Panel raised', use: 'Selected states', dark: false },
  { hex: '#E8EDF5', name: 'Starlight', use: 'Text', dark: true },
  { hex: '#9AA6BA', name: 'Slate', use: 'Secondary text', dark: true },
  { hex: '#7FC8F8', name: 'Ice blue', use: 'Active, focus, highlights', dark: true },
  { hex: '#E0A458', name: 'Solar amber', use: 'Sparing secondary', dark: true }
];

var swatchHtml = '';
for (var i = 0; i < COLORS.length; i++) {
  var c = COLORS[i];
  var textColor = c.dark ? '#05080F' : '#E8EDF5';
  swatchHtml += '<div style="display: flex; flex-direction: column; gap: .6em">' +
    '<div style="height: 4.5em; background: ' + c.hex + '; border: 1px solid var(--line); display: flex; align-items: flex-end; padding: .5em .7em; color: ' + textColor + '; font-size: .8em">' + c.hex + '</div>' +
    '<p>' + c.name + '</p><p class="muted" style="font-size: .8em; margin-top: -.5em">' + c.use + '</p></div>';
}
document.getElementById('swatches').innerHTML = swatchHtml;

var demoSwitch = document.getElementById('demo-switch');
demoSwitch.addEventListener('click', function () {
  var on = demoSwitch.getAttribute('aria-checked') !== 'true';
  demoSwitch.setAttribute('aria-checked', on ? 'true' : 'false');
  document.getElementById('demo-state').textContent = on ? 'On' : 'Off';
});

document.getElementById('cs').addEventListener('input', function (event) {
  document.getElementById('cs-val').textContent = event.target.value;
});
