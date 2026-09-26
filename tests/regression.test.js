import { afterEach, test } from 'bun:test';
import { assert } from './helpers/assert';
import { bootApplication, closeAllWindows, setFileInput, waitForAnalysis } from './helpers/dom';

afterEach(closeAllWindows);

test('preserves import, reset, race, copy and export regressions', async () => {
  const harness = bootApplication();
  const { window: w } = harness;
  const exports = harness.exportedReports;
  const copied = harness.copiedText;
  const valid = `From: scammer@acme.com\nReply-To: victim@gmail.net\nSubject: Urgent donation\nAuthentication-Results: mx; spf=none; dkim=none\nReceived: from mail.acme.com (203.0.113.42)\n\nPlease reply immediately to claim a $5 million donation. https://evil.example/login`;
  function select(name, text, type = 'message/rfc822') {
    const file = new w.File([text], name, { type });
    const done = waitForAnalysis(w);
    setFileInput(w, file);
    return done;
  }

  await select('bad.eml', 'not an email');
  assert.match(w.document.querySelector('#state').textContent, /complete message header block/);
  await select('sample.eml', valid);
  assert.equal(w.document.querySelector('#report').classList.contains('hidden'), false);
  assert.match(w.document.querySelector('#findingGroups').textContent, /From \/ Reply-To mismatch/);
  assert.match(
    w.document.querySelector('#findingGroups').textContent,
    /Pressure to respond quickly/,
  );
  assert.match(w.document.querySelector('#linkDetails').textContent, /evil\.example/);

  w.document.querySelector('[data-import="source"]').click();
  w.document.querySelector('#pasteInput').value = valid;
  let done = waitForAnalysis(w);
  w.document.querySelector('#pasteAnalyze').click();
  await done;
  assert.equal(w.document.querySelector('#pasteInput').value, valid);
  w.document.querySelector('#copyButton').click();
  const exported = harness.waitForNextExport();
  const revoked = harness.waitForNextRevocation();
  w.document.querySelector('#exportButton').click();
  await exported;
  await revoked;
  assert.deepEqual(harness.createdObjectUrls, harness.revokedObjectUrls);
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
  Object.defineProperty(pendingFile, 'text', {
    value: () =>
      new Promise((resolve) => {
        releaseRead = resolve;
      }),
  });
  Object.defineProperty(w.document.querySelector('#fileInput'), 'files', {
    configurable: true,
    value: [pendingFile],
  });
  w.document.querySelector('#fileInput').dispatchEvent(new w.Event('change', { bubbles: true }));
  const staleReadFinished = waitForAnalysis(w);
  w.document.querySelector('#resetButton').click();
  releaseRead(valid);
  await staleReadFinished;
  assert.equal(w.document.querySelector('#report').classList.contains('hidden'), true);
  assert.equal(w.document.querySelector('#findingGroups').textContent, '');
  assert.equal(copied.length, 1);
  assert.equal(exports.length, 1);
  console.log(
    'PASS: malformed -> valid .eml -> report -> copy/export -> reset clears inputs and analysis state',
  );
});
