const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8').replace('<script src="app.js"></script>', '');

function boot(language, saved) {
  const dom = new JSDOM(html, { url: 'https://trustmebro.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  Object.defineProperty(window.navigator, 'language', { configurable: true, value: language });
  Object.defineProperty(window.navigator, 'languages', { configurable: true, value: [language] });
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.navigator.clipboard = { writeText: async () => {} };
  if (saved) window.localStorage.setItem('trustmebro-locale', saved);
  window.eval(fs.readFileSync('app.js', 'utf8'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return dom;
}

assert.equal(boot('de-DE').window.document.documentElement.lang, 'de');
assert.equal(boot('en-US').window.document.documentElement.lang, 'en');
assert.equal(boot('fr-FR').window.document.documentElement.lang, 'en');
assert.equal(boot('en-US', 'de').window.document.documentElement.lang, 'de');

const dom = boot('en-US');
const { window } = dom;
const blobs = [];
window.Blob = class { constructor(parts) { this.payload = parts.join(''); blobs.push(this.payload); } };
window.URL.createObjectURL = () => 'blob:test';
window.URL.revokeObjectURL = () => {};
window.HTMLAnchorElement.prototype.click = function () {};
window.document.querySelector('[data-locale="de"]').click();
assert.equal(window.document.documentElement.lang, 'de');
assert.equal(window.document.querySelector('#demoButton').textContent, 'Sichere Demo-Mail ausprobieren →');
assert.equal(window.localStorage.getItem('trustmebro-locale'), 'de');
window.document.querySelector('#demoButton').click();

setTimeout(() => {
  const ids = [...window.document.querySelectorAll('.finding .tag')].map((node) => node.textContent);
  const evidence = [...window.document.querySelectorAll('.evidence')].map((node) => node.textContent);
  const germanFinding = window.document.querySelector('.finding h4').textContent;
  window.document.querySelector('#exportButton').click();
  window.document.querySelector('[data-locale="en"]').click();
  assert.equal(window.document.documentElement.lang, 'en');
  assert.notEqual(window.document.querySelector('.finding h4').textContent, germanFinding);
  assert.deepEqual([...window.document.querySelectorAll('.finding .tag')].map((node) => node.textContent), ids);
  assert.deepEqual([...window.document.querySelectorAll('.evidence')].map((node) => node.textContent), evidence);
  assert.equal(window.document.querySelector('#verdict').textContent, 'Likely suspicious');
  window.document.querySelector('#exportButton').click();
  assert.equal(blobs.length, 2);
  assert.equal(blobs[0], blobs[1]);
  console.log('PASS: locale detection, persistence and report rerender without reanalysis');
}, 120);
