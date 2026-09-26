const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

(async () => {
  const html = fs.readFileSync('index.html', 'utf8').replace('<script type="module" src="./app.ts"></script>', '');
  const dom = new JSDOM(html, { url: 'https://trustmebro.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window: w } = dom;
  const copied = [];
  const exports = [];
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.scrollTo = () => {};
  w.navigator.clipboard = { writeText: async (value) => copied.push(value) };
  const NativeBlob = w.Blob;
  w.Blob = class extends NativeBlob {
    constructor(parts, options) { super(parts, options); if (options?.type === 'application/json') exports.push(parts.join('')); }
  };
  w.URL.createObjectURL = () => 'blob:test';
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {};
  w.eval(fs.readFileSync('.build/app.js', 'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const input = w.document.querySelector('#fileInput');
  const valid = `From: scammer@acme.com\nReply-To: victim@gmail.net\nSubject: Urgent donation\nAuthentication-Results: mx; spf=none; dkim=none\nReceived: from mail.acme.com (203.0.113.42)\n\nPlease reply immediately to claim a $5 million donation. https://evil.example/login`;
  function select(name, text, type = 'message/rfc822') {
    const file = new w.File([text], name, { type });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
  const wait = () => new Promise((resolve) => setTimeout(resolve, 300));

  select('bad.eml', 'not an email');
  await wait();
  assert.match(w.document.querySelector('#state').textContent, /valid email source/);
  select('sample.eml', valid);
  await wait();
  assert.equal(w.document.querySelector('#report').classList.contains('hidden'), false);
  assert.match(w.document.querySelector('#findingGroups').textContent, /From \/ Reply-To mismatch/);
  assert.match(w.document.querySelector('#findingGroups').textContent, /Pressure to respond quickly/);
  assert.match(w.document.querySelector('#linkDetails').textContent, /evil\.example/);

  w.document.querySelector('[data-import="source"]').click();
  w.document.querySelector('#pasteInput').value = valid;
  w.document.querySelector('#pasteAnalyze').click();
  await wait();
  assert.equal(w.document.querySelector('#pasteInput').value, valid);
  w.document.querySelector('#copyButton').click();
  w.document.querySelector('#exportButton').click();
  assert.equal(copied.length, 1);
  assert.match(copied[0], /trustmebro\.report/);
  assert.equal(exports.length, 1);

  w.document.querySelector('#resetButton').click();
  assert.equal(w.document.querySelector('#report').classList.contains('hidden'), true);
  assert.equal(w.document.querySelector('#pasteInput').value, '');
  assert.equal(w.document.querySelector('#fileInput').value, '');
  assert.equal(w.document.querySelector('#findingGroups').textContent, '');
  assert.equal(w.document.querySelector('#linkDetails').textContent, '');
  assert.equal(w.document.querySelector('#rawDetails').textContent, '');
  assert.equal(w.document.querySelector('#assessment').textContent, '');
  assert.equal(w.document.querySelector('.completeness strong').textContent, '—');
  assert.equal(w.document.querySelector('.completeness span:last-child').textContent, '');
  w.document.querySelector('#copyButton').click();
  w.document.querySelector('#exportButton').click();
  assert.equal(copied.length, 1);
  assert.equal(exports.length, 1);
  w.document.querySelector('[data-locale="de"]').click();
  assert.equal(w.document.querySelector('#report').classList.contains('hidden'), true);
  assert.equal(w.document.querySelector('#pasteInput').value, '');
  assert.equal(copied.length, 1);
  assert.equal(exports.length, 1);
  let releaseRead;
  const pendingFile = new w.File(['pending'], 'pending.eml', { type: 'message/rfc822' });
  Object.defineProperty(pendingFile, 'text', { value: () => new Promise((resolve) => { releaseRead = resolve; }) });
  Object.defineProperty(input, 'files', { configurable: true, value: [pendingFile] });
  input.dispatchEvent(new w.Event('change', { bubbles: true }));
  w.document.querySelector('#resetButton').click();
  releaseRead(valid);
  await wait();
  assert.equal(w.document.querySelector('#report').classList.contains('hidden'), true);
  assert.equal(w.document.querySelector('#findingGroups').textContent, '');
  assert.equal(copied.length, 1);
  assert.equal(exports.length, 1);
  console.log('PASS: malformed -> valid .eml -> report -> copy/export -> reset clears inputs and analysis state');
})().catch((error) => { console.error(error); process.exit(1); });
