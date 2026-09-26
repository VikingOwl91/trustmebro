import { describe, expect, test } from 'bun:test';
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

describe('input adapters', () => {
  test('normalizes full source and validates file formats', () => {
    const file = adaptEmlFile(source, 'message.eml');
    const raw = adaptRawSource(source);
    expect(file.content).toBe(raw.content);
    expect(file.adapter.id).toBe('eml-file');
    expect(raw.adapter.id).toBe('raw-source');
    expect(file.adapter.version).toBe('1');
    expect(file.adapter.format).toBe('message/rfc822');
    expect(file.level).toBe('FULL');
    expect(file.capabilities).toEqual({
      headers: true,
      authentication: true,
      routing: true,
      body: true,
      urls: true,
      attachments: true,
      mime: true,
    });
    expect(() => adaptEmlFile(source, 'message.msg')).toThrow(InputAdapterError);
    expect(() => adaptEmlFile(source, 'message.txt')).toThrow(InputAdapterError);
    expect(() => adaptRawSource('Subject: no blank separator')).toThrow(InputAdapterError);
    expect(() => adaptRawSource('  ')).toThrow(InputAdapterError);
  });

  test('limits headers paste to a valid header block', () => {
    const headers = adaptHeaders(
      'From: sender@example.test\r\nSubject: Header sample\r\n\r\nReceived: forged.example\r\nmargin-top: 1px',
    );
    expect(headers.level).toBe('LIMITED');
    expect(headers.adapter.format).toBe('message-headers');
    expect(headers.capabilities).toEqual({
      headers: true,
      authentication: true,
      routing: true,
      body: false,
      urls: false,
      attachments: false,
      mime: false,
    });
    expect(headers.content).not.toMatch(/forged|margin-top/);
    expect(() => adaptHeaders('From: sender@example.test\nbody-like non-header line')).toThrow(
      InputAdapterError,
    );
    expect(() => adaptHeaders('')).toThrow(InputAdapterError);
  });

  test('keeps header-like lines in body paste as message text', () => {
    const bodyText =
      'Subject: stays body text\nReceived: forged route\nOpen https://example.test/path';
    const body = adaptBody(bodyText);
    expect(body.level).toBe('LIMITED');
    expect(body.adapter.format).toBe('text/plain');
    expect(body.capabilities).toEqual({
      headers: false,
      authentication: false,
      routing: false,
      body: true,
      urls: true,
      attachments: false,
      mime: false,
    });
    expect(body.content.split(/\r?\n\r?\n/).at(-1)).toBe(bodyText);
  });
});
