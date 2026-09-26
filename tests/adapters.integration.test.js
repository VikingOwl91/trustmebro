const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const html = fs
  .readFileSync('index.html', 'utf8')
  .replace('<script type="module" src="./app.ts"></script>', '');
const dom = new JSDOM(html, {
  url: 'https://trustmebro.test/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
window.matchMedia = () => ({ matches: false, addEventListener() {} });
window.scrollTo = () => {};
window.navigator.clipboard = { writeText: async () => {} };
const exportedReports = [];
const NativeBlob = window.Blob;
window.Blob = class extends NativeBlob {
  constructor(parts, options) {
    super(parts, options);
    if (options?.type === 'application/json') exportedReports.push(parts.join(''));
  }
};
window.URL.createObjectURL = () => 'blob:test';
window.URL.revokeObjectURL = () => {};
window.HTMLAnchorElement.prototype.click = function () {};
window.eval(fs.readFileSync('.build/app.js', 'utf8'));
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

const wait = () => new Promise((resolve) => setTimeout(resolve, 150));
const exportReport = () => {
  window.document.querySelector('#exportButton').click();
  return JSON.parse(exportedReports.at(-1));
};
const source = [
  'From: sender@acme.com',
  'Reply-To: sender@acme.com',
  'Authentication-Results: mx; spf=pass smtp.mailfrom=acme.com; dkim=pass header.d=acme.com; dmarc=pass',
  'Received: from mx.acme.com',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Routine account update. Visit https://acme.com/status for details.',
].join('\r\n');

(async () => {
  const fileInput = window.document.querySelector('#fileInput');
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: [new window.File([source], 'sample.eml', { type: 'message/rfc822' })],
  });
  fileInput.dispatchEvent(new window.Event('change', { bubbles: true }));
  await wait();
  const fileReport = exportReport();
  assert.equal(fileReport.source.adapter.id, 'eml-file');
  assert.equal(fileReport.source.adapter.version, '1');
  assert.equal(fileReport.source.adapter.inputKind, 'file');
  assert.deepEqual(fileReport.source.capabilities, {
    headers: true,
    authentication: true,
    routing: true,
    body: true,
    urls: true,
    attachments: true,
    mime: true,
  });
  assert.deepEqual(fileReport.privacy, {
    rawEmailUploaded: false,
    messageUploaded: false,
    attachmentsUploaded: false,
    externalRequests: 0,
  });

  window.document.querySelector('[data-import="source"]').click();
  window.document.querySelector('#pasteInput').value = source;
  window.document.querySelector('#pasteAnalyze').click();
  await wait();
  const rawReport = exportReport();
  assert.equal(rawReport.source.adapter.id, 'raw-source');
  assert.deepEqual(rawReport.findings, fileReport.findings);
  assert.deepEqual(rawReport.assessment, fileReport.assessment);
  assert.deepEqual(rawReport.urls, fileReport.urls);

  window.document.querySelector('[data-import="headers"]').click();
  assert.equal(window.document.querySelector('#report').classList.contains('hidden'), true);
  assert.equal(
    window.document.querySelector('#pasteInput').value,
    '',
    'switching paste modes clears prior input',
  );
  window.document.querySelector('#pasteInput').value =
    'From: sender@acme.com\nReceived: from mx.acme.com\nSubject: Header-only sample\n\nReceived: forged.example\nmargin-top: 1px\nhttps://must-not-be-read.example';
  window.document.querySelector('#pasteAnalyze').click();
  await wait();
  const headersReport = exportReport();
  assert.equal(headersReport.source.level, 'LIMITED');
  assert.equal(headersReport.source.adapter.id, 'headers');
  assert.equal(headersReport.source.capabilities.body, false);
  assert.equal(headersReport.received.length, 1);
  assert.deepEqual(headersReport.urls, []);
  assert.doesNotMatch(JSON.stringify(headersReport.headers), /margin-top|forged/);

  window.document.querySelector('[data-import="body"]').click();
  window.document.querySelector('#pasteInput').value =
    'Subject: This stays body text\nReceived: forged route\nA million dollar donation is urgent. https://body.example/path';
  window.document.querySelector('#pasteAnalyze').click();
  await wait();
  const bodyReport = exportReport();
  assert.equal(bodyReport.source.level, 'LIMITED');
  assert.equal(bodyReport.source.adapter.id, 'body');
  assert.equal(bodyReport.source.capabilities.headers, false);
  assert.equal(bodyReport.source.capabilities.body, true);
  assert.equal(bodyReport.body.textEvaluated, true);
  assert.deepEqual(bodyReport.headers, {});
  assert.deepEqual(bodyReport.received, []);
  assert.equal(bodyReport.authentication, null);
  assert.match(bodyReport.urls.join(' '), /body\.example/);
  assert.doesNotMatch(
    bodyReport.findings.map((finding) => finding.id).join(' '),
    /auth\.|identity\./,
  );

  window.document.querySelector('[data-import="source"]').click();
  window.document.querySelector('#pasteInput').value = 'Subject: incomplete source';
  window.document.querySelector('#pasteAnalyze').click();
  assert.match(
    window.document.querySelector('#state').textContent,
    /complete message header block/,
  );
  window.document.querySelector('[data-import="headers"]').click();
  window.document.querySelector('#pasteInput').value = 'From: valid@example.test\nnot a header';
  window.document.querySelector('#pasteAnalyze').click();
  assert.match(window.document.querySelector('#state').textContent, /valid message headers/);
  window.document.querySelector('[data-import="body"]').click();
  window.document.querySelector('#pasteInput').value = '';
  window.document.querySelector('#pasteAnalyze').click();
  assert.match(window.document.querySelector('#state').textContent, /Paste some message material/);

  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: [new window.File(['anything'], 'unsupported.msg', { type: 'application/octet-stream' })],
  });
  fileInput.dispatchEvent(new window.Event('change', { bubbles: true }));
  await wait();
  assert.match(
    window.document.querySelector('#state').textContent,
    /Outlook .msg is not supported/,
  );
  console.log(
    'PASS: adapter UI paths, capability provenance, mode isolation and local-only report contract',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
