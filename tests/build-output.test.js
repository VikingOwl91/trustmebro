const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const output = fs.readFileSync('dist/index.html', 'utf8');
assert.doesNotMatch(output, /fonts\.googleapis\.com|fonts\.gstatic\.com/i);
const cssPath = output.match(/href="([^"]+\.css)"/)?.[1];
const scriptPath = output.match(/src="([^"]+\.js)"/)?.[1];
assert.ok(cssPath && scriptPath, 'static build links its bundled CSS and JavaScript');
const css = fs.readFileSync(path.join('dist', cssPath), 'utf8');
assert.doesNotMatch(css, /fonts\.googleapis\.com|fonts\.gstatic\.com/i);
assert.match(css, /data:font\/woff2/);

const html = output.replace(/<script\b[^>]*>[^<]*<\/script>/gi, '');
const dom = new JSDOM(html, {
  url: 'https://trustmebro.test/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
window.matchMedia = () => ({ matches: false, addEventListener() {} });
window.scrollTo = () => {};
window.navigator.clipboard = { writeText: async () => {} };
window.eval(fs.readFileSync(path.join('dist', scriptPath), 'utf8'));
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
window.document.querySelector('#demoButton').click();

setTimeout(() => {
  assert.equal(window.document.querySelector('#report').classList.contains('hidden'), false);
  assert.equal(window.document.documentElement.lang, 'en');
  assert.doesNotMatch(
    window.document.documentElement.innerHTML,
    /fonts\.googleapis\.com|fonts\.gstatic\.com/i,
  );
  console.log('PASS: built static page runs its demo and contains no remote font references');
}, 300);
