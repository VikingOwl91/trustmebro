const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const html = fs
  .readFileSync('index.html', 'utf8')
  .replace('<script type="module" src="./app.ts"></script>', '');

function boot(language, saved) {
  const dom = new JSDOM(html, {
    url: 'https://trustmebro.test/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  Object.defineProperty(window.navigator, 'language', { configurable: true, value: language });
  Object.defineProperty(window.navigator, 'languages', { configurable: true, value: [language] });
  window.scrollTo = () => {};
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.navigator.clipboard = { writeText: async () => {} };
  if (saved) window.localStorage.setItem('trustmebro-locale', saved);
  window.eval(fs.readFileSync('.build/app.js', 'utf8'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return dom;
}

assert.equal(boot('de-DE').window.document.documentElement.lang, 'de');
assert.equal(boot('en-US').window.document.documentElement.lang, 'en');
assert.equal(boot('fr-FR').window.document.documentElement.lang, 'en');
assert.equal(boot('en-US', 'de').window.document.documentElement.lang, 'de');
{
  const german = boot('de-DE').window;
  assert.equal(
    german.document.querySelector('.brand').textContent.replace(/\s+/g, ' ').trim(),
    'TRUSTMEBRO',
  );
  assert.equal(german.document.querySelector('.brand .mark').getAttribute('aria-hidden'), 'true');
  assert.equal(
    german.document.querySelector('.brand').getAttribute('aria-label'),
    'TRUSTMEBRO Startseite',
  );
  const english = boot('en-US').window;
  assert.equal(
    english.document.querySelector('.brand').textContent.replace(/\s+/g, ' ').trim(),
    'TRUSTMEBRO',
  );
  assert.equal(english.document.querySelector('.brand .mark').getAttribute('aria-hidden'), 'true');
  assert.equal(
    english.document.querySelector('.brand').getAttribute('aria-label'),
    'TRUSTMEBRO home',
  );
}

const dom = boot('en-US');
const { window } = dom;
const blobs = [];
const NativeBlob = window.Blob;
window.Blob = class extends NativeBlob {
  constructor(parts, options) {
    super(parts, options);
    this.payload = parts.join('');
    if (options?.type === 'application/json') blobs.push(this.payload);
  }
};
window.URL.createObjectURL = () => 'blob:test';
window.URL.revokeObjectURL = () => {};
window.HTMLAnchorElement.prototype.click = function () {};
window.document.querySelector('[data-locale="de"]').click();
assert.equal(window.document.documentElement.lang, 'de');
assert.equal(
  window.document.querySelector('#demoButton').textContent,
  'Sichere Demo-Mail ausprobieren →',
);
assert.equal(window.localStorage.getItem('trustmebro-locale'), 'de');
window.document.querySelector('#demoButton').click();

setTimeout(() => {
  const ids = [...window.document.querySelectorAll('.finding .tag')].map(
    (node) => node.textContent,
  );
  const evidence = [...window.document.querySelectorAll('.evidence')].map(
    (node) => node.textContent,
  );
  const germanFinding = window.document.querySelector('.finding h4').textContent;
  window.document.querySelector('#exportButton').click();
  window.document.querySelector('[data-locale="en"]').click();
  assert.equal(window.document.documentElement.lang, 'en');
  assert.notEqual(window.document.querySelector('.finding h4').textContent, germanFinding);
  assert.deepEqual(
    [...window.document.querySelectorAll('.finding .tag')].map((node) => node.textContent),
    ids,
  );
  assert.deepEqual(
    [...window.document.querySelectorAll('.evidence')].map((node) => node.textContent),
    evidence,
  );
  assert.equal(window.document.querySelector('#verdict').textContent, 'Likely suspicious');
  window.document.querySelector('#exportButton').click();
  assert.equal(blobs.length, 2);
  assert.equal(blobs[0], blobs[1]);
  const exported = JSON.parse(blobs[0]);
  assert.equal(exported.assessment.version, '2');
  assert.equal(
    exported.assessment.reasons.reduce((sum, reason) => sum + reason.contribution, 0),
    exported.assessment.score,
  );
  const categoryPoints = new Map();
  const categoryCaps = new Map();
  for (const reason of exported.assessment.reasons) {
    categoryPoints.set(
      reason.category,
      (categoryPoints.get(reason.category) || 0) + reason.contribution,
    );
    categoryCaps.set(reason.category, reason.categoryCap);
  }
  for (const [category, points] of categoryPoints)
    assert.ok(points <= categoryCaps.get(category), `${category} score stays within its cap`);
  assert.equal(exported.body.status, 'readable');
  console.log('PASS: locale detection, persistence and report rerender without reanalysis');
}, 300);
