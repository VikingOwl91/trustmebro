const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

function createWindow() {
  const html = fs.readFileSync('index.html', 'utf8').replace('<script src="app.js"></script>', '');
  const dom = new JSDOM(html, { url: 'https://trustmebro.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const window = dom.window;
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.navigator.clipboard = { writeText: async () => {} };
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {};
  window.eval(fs.readFileSync('app.js', 'utf8'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return { window, input: window.document.querySelector('#fileInput') };
}

async function analyze(text) {
  const { window, input } = createWindow();
  const file = new window.File([text], 'fixture.eml', { type: 'message/rfc822' });
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 150));
  return window;
}

(async () => {
  const cssBody = await analyze([
    'From: sender@example.test',
    'Subject: CSS body',
    '',
    'margin-top: 10px;',
    'text-decoration: underline;'
  ].join('\n'));
  assert.doesNotMatch(cssBody.document.querySelector('#headerDetails').textContent, /margin-top|text-decoration/);

  const htmlBody = await analyze([
    'From: sender@example.test',
    'Subject: =?UTF-8?Q?Pr=C3=BCfung?=',
    'Content-Type: multipart/alternative; boundary="b"',
    '',
    '--b',
    'Content-Type: text/html; charset=utf-8',
    '',
    '<p>Bitte <a href="https://evil.example/path?a=1">pruefen</a></p>',
    '--b--'
  ].join('\n'));
  assert.match(htmlBody.document.querySelector('#headerDetails').textContent, /Prüfung/);
  assert.match(htmlBody.document.querySelector('#linkDetails').textContent, /https:\/\/evil\.example\/path\?a=1/);

  const duplicateAttachment = await analyze([
    'From: sender@example.test',
    'Content-Type: multipart/mixed; boundary="x"',
    '',
    '--x',
    'Content-Type: application/pdf; name="invoice.pdf"',
    'Content-Disposition: attachment; filename="invoice.pdf"',
    '',
    'bytes',
    '--x--'
  ].join('\n'));
  const attachmentText = duplicateAttachment.document.querySelector('#attachmentDetails').textContent;
  assert.equal((attachmentText.match(/invoice\.pdf/g) || []).length, 1);

  const continuedAttachment = await analyze([
    'From: sender@example.test',
    'Content-Type: multipart/mixed; boundary="x"',
    '',
    '--x',
    'Content-Type: application/pdf',
    'Content-Disposition: attachment; filename*0*=utf-8\'\'quarter%20; filename*1*=report.pdf',
    '',
    'bytes',
    '--x',
    'Content-Type: application/pdf',
    'Content-Disposition: attachment; filename="report.pdf"',
    '',
    'bytes',
    '--x--'
  ].join('\n'));
  const continuedText = continuedAttachment.document.querySelector('#attachmentDetails').textContent;
  assert.match(continuedText, /quarter report\.pdf/);
  assert.equal((continuedText.match(/report\.pdf/g) || []).length, 2);

  const heloOnly = await analyze([
    'From: sender@example.test',
    'Authentication-Results: mx; spf=pass smtp.helo=mail.example.test; dkim=pass',
    '',
    'Hello'
  ].join('\n'));
  assert.match(heloOnly.document.querySelector('#findingGroups').textContent, /SPF is missing|SPF fehlt/);
  assert.match(heloOnly.document.querySelector('#findingGroups').textContent, /MAIL FROM SPF not reported/);

  const mailFromFailure = await analyze([
    'From: sender@example.test',
    'Authentication-Results: mx; spf=none smtp.mailfrom=sender.example.test; dkim=pass',
    '',
    'Hello'
  ].join('\n'));
  assert.match(mailFromFailure.document.querySelector('#findingGroups').textContent, /SPF is missing|SPF fehlt/);
  assert.match(mailFromFailure.document.querySelector('#findingGroups').textContent, /MAIL FROM SPF/);

  // Private real-world fixtures are optional; never commit the original messages.
  const fixtures = fs.existsSync('upload')
    ? fs.readdirSync('upload').filter((name) => name.toLowerCase().endsWith('.eml'))
    : [];
  for (const fixture of fixtures) {
    const reportWindow = await analyze(fs.readFileSync(`upload/${fixture}`, 'utf8'));
    const reportText = reportWindow.document.querySelector('#findingGroups').textContent;
    const headerText = reportWindow.document.querySelector('#headerDetails').textContent;
    assert.doesNotMatch(headerText, /margin-top|text-decoration/, fixture);
    assert.match(reportText, /@3/);
    assert.match(reportWindow.document.querySelector('#rawDetails').textContent, /SPF HELO/);
    assert.match(reportWindow.document.querySelector('#rawDetails').textContent, /DKIM/);
    assert.match(reportWindow.document.querySelector('#rawDetails').textContent, /alignment/);
    assert.match(reportWindow.document.querySelector('#assessment').textContent, /\/100/);
    const report = reportWindow.document.querySelector('#assessment');
    assert.match(report.textContent, /Signal score|Signalbewertung/);
  }
  assert.match(htmlBody.document.querySelector('#linkDetails').textContent, /visible: pruefen/);
  console.log('PASS: parser header boundary, attachment deduplication, and SPF scope');
})().catch((error) => { console.error(error); process.exit(1); });
