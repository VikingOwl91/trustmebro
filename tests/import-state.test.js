const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8').replace('<script src="app.js"></script>', '');

function boot(theme) {
  const dom = new JSDOM(html, { url: 'https://trustmebro.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = () => ({ matches: theme === 'dark', addEventListener() {} });
  window.navigator.clipboard = { writeText: async () => {} };
  window.eval(fs.readFileSync('app.js', 'utf8'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return dom;
}

for (const theme of ['light', 'dark']) {
  const dom = boot(theme);
  const { window } = dom;
  const importButtons = [...window.document.querySelectorAll('[data-import]')];
  const modeButtons = importButtons.filter((button) => button.dataset.import !== 'help');

  for (const mode of ['file', 'source', 'headers', 'body', 'file']) {
    window.document.querySelector(`[data-import="${mode}"]`).click();
    const selected = modeButtons.filter((button) => button.classList.contains('is-selected'));
    assert.equal(selected.length, 1, `${theme}: one import option selected for ${mode}`);
    assert.equal(selected[0].dataset.import, mode);
    assert.equal(selected[0].getAttribute('aria-selected'), 'true');
    assert.equal(modeButtons.filter((button) => button.getAttribute('aria-selected') === 'true').length, 1);
    assert.equal(window.document.querySelector('#pasteBox').classList.contains('hidden'), mode === 'file');
    if (mode !== 'file') assert.match(window.document.querySelector('#pasteLabel').textContent, mode === 'headers' ? /headers/ : mode === 'body' ? /text\/body/ : /complete original/);
  }

  window.document.querySelector('[data-import="headers"]').click();
  window.document.querySelector('#helpButton').click();
  assert.equal(modeButtons.filter((button) => button.classList.contains('is-selected'))[0].dataset.import, 'headers');
  const guideButtons = [...window.document.querySelectorAll('[data-guide]')];
  const guideText = { gmail: /Show original/, outlook: /View message details/, thunderbird: /View Source/, apple: /All Headers/, other: /Save as \.eml/ };
  for (const client of ['gmail', 'outlook', 'thunderbird', 'apple', 'other', 'gmail']) {
    window.document.querySelector(`[data-guide="${client}"]`).click();
    const selected = guideButtons.filter((button) => button.classList.contains('is-selected'));
    assert.equal(selected.length, 1, `${theme}: one guide selected for ${client}`);
    assert.equal(selected[0].dataset.guide, client);
    assert.equal(selected[0].getAttribute('aria-selected'), 'true');
    assert.equal(guideButtons.filter((button) => button.getAttribute('aria-selected') === 'true').length, 1);
    assert.match(window.document.querySelector('#guideText').textContent, guideText[client]);
  }
  window.document.querySelector('#helpCancel').click();
  assert.equal(modeButtons.filter((button) => button.classList.contains('is-selected'))[0].dataset.import, 'headers');
  dom.window.close();
}

console.log('PASS: import and acquisition-guide state interactions in Light and Dark');
