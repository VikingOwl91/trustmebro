import assert from 'node:assert/strict';
import { adaptBody, adaptEmlFile, adaptHeaders, adaptRawSource } from '../input-adapters';
import { InputAdapterError } from '../input-types';

const source = [
  'From: sender@example.test',
  'Subject: Routine update',
  'Received: from mx.example.test',
  'Authentication-Results: mx; spf=pass smtp.mailfrom=example.test',
  '',
  'Hello from the message body.',
].join('\r\n');

const file = adaptEmlFile(source, 'message.eml');
const raw = adaptRawSource(source);
assert.deepEqual(file.content, raw.content);
assert.equal(file.adapter.id, 'eml-file');
assert.equal(raw.adapter.id, 'raw-source');
assert.equal(file.adapter.version, '1');
assert.equal(file.adapter.format, 'message/rfc822');
assert.equal(file.level, 'FULL');
assert.deepEqual(file.capabilities, {
  headers: true,
  authentication: true,
  routing: true,
  body: true,
  urls: true,
  attachments: true,
  mime: true,
});
assert.throws(
  () => adaptEmlFile(source, 'message.msg'),
  (error) => error instanceof InputAdapterError && error.code === 'unsupported-msg',
);
assert.throws(
  () => adaptEmlFile(source, 'message.txt'),
  (error) => error instanceof InputAdapterError && error.code === 'unsupported-file',
);
assert.throws(() => adaptRawSource('Subject: no blank separator'), InputAdapterError);
assert.throws(() => adaptRawSource('  '), InputAdapterError);

const headers = adaptHeaders(
  'From: sender@example.test\r\nSubject: Header sample\r\n\r\nReceived: forged.example\r\nmargin-top: 1px',
);
assert.equal(headers.level, 'LIMITED');
assert.equal(headers.adapter.format, 'message-headers');
assert.deepEqual(headers.capabilities, {
  headers: true,
  authentication: true,
  routing: true,
  body: false,
  urls: false,
  attachments: false,
  mime: false,
});
assert.doesNotMatch(headers.content, /forged|margin-top/);
assert.throws(
  () => adaptHeaders('From: sender@example.test\nbody-like non-header line'),
  InputAdapterError,
);
assert.throws(() => adaptHeaders(''), InputAdapterError);

const bodyText = 'Subject: stays body text\nReceived: forged route\nOpen https://example.test/path';
const body = adaptBody(bodyText);
assert.equal(body.level, 'LIMITED');
assert.equal(body.adapter.format, 'text/plain');
assert.deepEqual(body.capabilities, {
  headers: false,
  authentication: false,
  routing: false,
  body: true,
  urls: true,
  attachments: false,
  mime: false,
});
assert.equal(body.content.split(/\r?\n\r?\n/).at(-1), bodyText);
console.log('PASS: input adapters normalize format, completeness, capabilities and validation');
