const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');

function createWindow() {
  const html = fs.readFileSync('index.html', 'utf8').replace('<script type="module" src="./app.ts"></script>', '');
  const dom = new JSDOM(html, { url: 'https://trustmebro.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const window = dom.window;
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.scrollTo = () => {};
  window.navigator.clipboard = { writeText: async () => {} };
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {};
  window.eval(fs.readFileSync('.build/app.js', 'utf8'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return { window, input: window.document.querySelector('#fileInput') };
}

async function analyze(text) {
  const { window, input } = createWindow();
  const file = new window.File([text], 'fixture.eml', { type: 'message/rfc822' });
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 300));
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

  const bodySpoofedReceived = await analyze([
    'From: sender@acme.com',
    'Content-Type: text/plain',
    '',
    'Received: from forged.example by fake.example',
    'A normal message body'
  ].join('\n'));
  assert.match(bodySpoofedReceived.document.querySelector('#rawDetails').textContent, /received hops0/);

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

  assert.match(htmlBody.document.querySelector('#linkDetails').textContent, /visible: pruefen/);

  const htmlWithReorderedAttributes = await analyze([
    'From: sender@acme.com',
    'Content-Type: text/html; charset=utf-8',
    '',
    '<p><a title="safe title" href=https://html-dom.example/path>Open <strong>the details</strong></a></p>'
  ].join('\n'));
  assert.match(htmlWithReorderedAttributes.document.querySelector('#linkDetails').textContent, /html-dom\.example/);
  assert.match(htmlWithReorderedAttributes.document.querySelector('#linkDetails').textContent, /visible: Open the details/);

  const nestedMime = await analyze([
    'From: sender@acme.com',
    'Content-Type: multipart/mixed; boundary="outer-boundary"',
    '',
    '--outer-boundary',
    'Content-Type: multipart/alternative; boundary="inner-boundary"',
    '',
    '--inner-boundary',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    'Pr=C3=BCfung -- is ordinary body text.',
    'Open https://quoted.example/path and continue.',
    '--inner-boundary',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from('<p>HTML fallback https://html.example/path</p>').toString('base64'),
    '--inner-boundary--',
    '--outer-boundary',
    'Content-Type: application/octet-stream; name="notes.txt"',
    'Content-Disposition: attachment; filename="notes.txt"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from('https://attachment.example/hidden million inheritance').toString('base64'),
    '--outer-boundary--'
  ].join('\r\n'));
  const nestedLinks = nestedMime.document.querySelector('#linkDetails').textContent;
  assert.match(nestedLinks, /quoted\.example/);
  assert.match(nestedLinks, /html\.example/);
  assert.doesNotMatch(nestedLinks, /attachment\.example|outer-boundary|inner-boundary/);
  assert.match(nestedMime.document.querySelector('#attachmentDetails').textContent, /notes\.txt/);
  assert.doesNotMatch(nestedMime.document.querySelector('#findingGroups').textContent, /Commercial or financial offer/);

  const messageAttachments = await analyze([
    'From: sender@acme.com',
    'Authentication-Results: mx; spf=pass smtp.mailfrom=acme.com; dkim=pass header.d=acme.com',
    'Content-Type: multipart/mixed; boundary="message-parts"',
    '',
    '--message-parts',
    'Content-Type: text/plain',
    '',
    'A routine note.',
    '--message-parts',
    'Content-Type: text/plain; name="attached.txt"',
    'Content-Disposition: attachment; filename="attached.txt"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from('million donation https://text-attachment.example').toString('base64'),
    '--message-parts',
    'Content-Type: message/rfc822',
    'Content-Disposition: attachment; filename="forwarded.eml"',
    '',
    'From: sender@attacker.net',
    'Content-Type: text/plain',
    '',
    'Urgent inheritance https://rfc822-attachment.example',
    '--message-parts--'
  ].join('\r\n'));
  assert.doesNotMatch(messageAttachments.document.querySelector('#linkDetails').textContent, /text-attachment|rfc822-attachment/);
  assert.doesNotMatch(messageAttachments.document.querySelector('#findingGroups').textContent, /Commercial or financial offer|Pressure to respond quickly/);
  assert.match(messageAttachments.document.querySelector('#attachmentDetails').textContent, /attached\.txt|forwarded\.eml/);

  const noReadablePart = await analyze([
    'From: sender@example.com',
    'Authentication-Results: mx; spf=pass smtp.mailfrom=acme.com; dkim=pass header.d=acme.com; dmarc=pass',
    'Content-Type: multipart/mixed; boundary="only-attachment"',
    '',
    '--only-attachment',
    'Content-Type: application/octet-stream; name="payload.txt"',
    'Content-Disposition: attachment; filename="payload.txt"',
    '',
    Buffer.from('https://must-not-be-extracted.example and inheritance').toString('base64'),
    '--only-attachment--'
  ].join('\n'));
  assert.doesNotMatch(noReadablePart.document.querySelector('#linkDetails').textContent, /must-not-be-extracted/);
  assert.doesNotMatch(noReadablePart.document.querySelector('#findingGroups').textContent, /Commercial or financial offer/);
  assert.equal(noReadablePart.document.querySelector('#verdict').textContent, 'Observations to review');
  assert.match(noReadablePart.document.querySelector('#assessment').textContent, /5\/100/);
  assert.match(noReadablePart.document.querySelector('#assessment').textContent, /raw \+5; counted \+5; category cap 5/);
  assert.match(noReadablePart.document.querySelector('.completeness').textContent, /No readable text body was available/);

  const linkObservation = await analyze([
    'From: sender@acme.com',
    'Authentication-Results: mx; spf=pass smtp.mailfrom=acme.com; dkim=pass header.d=acme.com',
    'Content-Type: text/plain',
    '',
    'A routine update: https://updates.acme.com/status'
  ].join('\n'));
  assert.equal(linkObservation.document.querySelector('#verdict').textContent, 'Observations to review');
  assert.match(linkObservation.document.querySelector('#assessment').textContent, /5\/100/);

  const alignedUk = await analyze([
    'From: sender@mail.example.co.uk',
    'Authentication-Results: mx; spf=pass smtp.mailfrom=bounce@sub.example.co.uk; dkim=pass header.d=mail.example.co.uk; dkim=pass header.d=other.co.uk; dmarc=pass',
    '',
    'Hello'
  ].join('\n'));
  assert.match(alignedUk.document.querySelector('#rawDetails').textContent, /From domainmail\.example\.co\.uk/);
  assert.match(alignedUk.document.querySelector('#rawDetails').textContent, /DKIM alignmentmail\.example\.co\.uk: aligned/);
  assert.match(alignedUk.document.querySelector('#rawDetails').textContent, /other\.co\.uk: not aligned/);
  assert.match(alignedUk.document.querySelector('#rawDetails').textContent, /MAIL FROM alignmentaligned/);

  const privateSuffix = await analyze([
    'From: sender@account.github.io',
    'Authentication-Results: mx; spf=pass smtp.mailfrom=account.github.io; dkim=pass header.d=attacker.github.io',
    '',
    'Hello'
  ].join('\n'));
  assert.match(privateSuffix.document.querySelector('#rawDetails').textContent, /attacker\.github\.io: not aligned/);

  const unknownAlignment = await analyze([
    'From: sender@localhost',
    'Authentication-Results: mx; spf=pass smtp.mailfrom=localhost; dkim=pass header.d=localhost',
    '',
    'Hello'
  ].join('\n'));
  assert.match(unknownAlignment.document.querySelector('#rawDetails').textContent, /From domain—/);
  assert.match(unknownAlignment.document.querySelector('#rawDetails').textContent, /localhost: unknown/);
  assert.match(unknownAlignment.document.querySelector('#rawDetails').textContent, /MAIL FROM alignmentunknown/);

  const exactDomain = await analyze([
    'From: sender@ACME.COM',
    'Authentication-Results: mx; spf=pass smtp.mailfrom=bounce@acme.com; dkim=pass header.d=acme.com',
    '',
    'Hello'
  ].join('\n'));
  assert.match(exactDomain.document.querySelector('#rawDetails').textContent, /DKIM alignmentacme\.com: aligned/);

  const separatedAuthEvidence = await analyze([
    'From: sender@acme.com',
    'Authentication-Results: mx; dkim=pass',
    'Authentication-Results: mx; spf=pass smtp.mailfrom=acme.com; header.d=acme.com',
    '',
    'Hello'
  ].join('\n'));
  assert.match(separatedAuthEvidence.document.querySelector('#rawDetails').textContent, /DKIM alignment—: unknown/);
  assert.match(separatedAuthEvidence.document.querySelector('#rawDetails').textContent, /MAIL FROM alignmentaligned/);

  const cappedScore = await analyze([
    'From: sender@example.com',
    'Reply-To: reply@elsewhere.net',
    'Authentication-Results: mx; spf=none smtp.mailfrom=elsewhere.net; dkim=fail header.d=elsewhere.net',
    'Content-Type: text/plain',
    '',
    'Urgent million donation offer. Please reply immediately. https://safe.example/path'
  ].join('\n'));
  const assessmentText = cappedScore.document.querySelector('#assessment').textContent;
  assert.match(assessmentText, /raw \+15; counted \+15; category cap 25/);
  assert.match(assessmentText, /raw \+10; counted \+10; category cap 25/);
  assert.match(assessmentText, /raw \+5; counted \+0; category cap 25/);
  assert.match(assessmentText, /75\/100/);
  const contributions = [...assessmentText.matchAll(/counted \+(\d+)/g)].reduce((sum, match) => sum + Number(match[1]), 0);
  assert.equal(contributions, 75);
  assert.equal(cappedScore.document.querySelector('#verdict').textContent, 'Likely suspicious');

  const spfOnly = await analyze([
    'From: sender@acme.com',
    'Authentication-Results: mx; spf=pass smtp.helo=mail.acme.com; dkim=pass header.d=acme.com',
    '',
    'Routine update'
  ].join('\n'));
  assert.match(spfOnly.document.querySelector('#assessment').textContent, /15\/100/);
  assert.match(spfOnly.document.querySelector('#rawDetails').textContent, /limited/);
  assert.equal(spfOnly.document.querySelector('#verdict').textContent, 'Signals to review');

  const moderateScore = await analyze([
    'From: sender@acme.com',
    'Reply-To: reply@different.net',
    'Authentication-Results: mx; spf=pass smtp.mailfrom=acme.com; dkim=pass header.d=acme.com',
    '',
    'Routine update'
  ].join('\n'));
  assert.match(moderateScore.document.querySelector('#assessment').textContent, /20\/100/);
  assert.match(moderateScore.document.querySelector('#rawDetails').textContent, /moderate/);
  assert.equal(moderateScore.document.querySelector('#verdict').textContent, 'Likely suspicious');

  const elevatedScore = await analyze([
    'From: sender@acme.com',
    'Reply-To: reply@different.net',
    'Authentication-Results: mx; spf=pass smtp.mailfrom=acme.com; dkim=pass header.d=acme.com',
    '',
    'A million dollar donation offer. Please reply. https://updates.acme.com/status'
  ].join('\n'));
  assert.match(elevatedScore.document.querySelector('#assessment').textContent, /45\/100/);
  assert.match(elevatedScore.document.querySelector('#rawDetails').textContent, /elevated/);

  const highScore = await analyze([
    'From: sender@acme.com',
    'Reply-To: reply@different.net',
    'Authentication-Results: mx; spf=none smtp.mailfrom=other.net; dkim=fail header.d=other.net',
    '',
    'A million dollar donation offer. Please reply. https://updates.acme.com/status'
  ].join('\n'));
  assert.match(highScore.document.querySelector('#assessment').textContent, /70\/100/);
  assert.match(highScore.document.querySelector('#rawDetails').textContent, /high/);
  assert.equal(highScore.document.querySelector('#verdict').textContent, 'Likely suspicious');

  if (process.env.TRUSTMEBRO_RUN_LOCAL_FIXTURES === '1') {
    for (const fixtureDir of ['upload', 'test-mails']) {
      const fixtures = fs.existsSync(fixtureDir)
        ? fs.readdirSync(fixtureDir).filter((name) => name.toLowerCase().endsWith('.eml'))
        : [];
      for (const fixture of fixtures) {
        const reportWindow = await analyze(fs.readFileSync(`${fixtureDir}/${fixture}`, 'utf8'));
        assert.equal(reportWindow.document.querySelector('#report').classList.contains('hidden'), false);
        assert.match(reportWindow.document.querySelector('#assessment').textContent, /\/100/);
      }
    }
  }
  console.log('PASS: MIME nesting/decoding/isolation, PSL alignment, neutral metadata, score caps, and synthetic regression cases');
})().catch((error) => { console.error(error); process.exit(1); });
