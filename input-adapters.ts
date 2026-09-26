import { InputAdapterError, type InputMode, type NormalizedAnalysisInput } from './input-types';

const fullCapabilities = {
  headers: true,
  authentication: true,
  routing: true,
  body: true,
  urls: true,
  attachments: true,
  mime: true,
} as const;

const headerCapabilities = {
  headers: true,
  authentication: true,
  routing: true,
  body: false,
  urls: false,
  attachments: false,
  mime: false,
} as const;

const bodyCapabilities = {
  headers: false,
  authentication: false,
  routing: false,
  body: true,
  urls: true,
  attachments: false,
  mime: false,
} as const;

function normalized(
  id: InputMode,
  inputKind: 'file' | 'paste' | 'demo',
  format: NormalizedAnalysisInput['adapter']['format'],
  displayName: string,
  content: string,
  level: NormalizedAnalysisInput['level'],
  capabilities: NormalizedAnalysisInput['capabilities'],
): NormalizedAnalysisInput {
  return {
    adapter: { id, version: '1', inputKind, format },
    displayName,
    content,
    level,
    capabilities,
  };
}

function hasHeaderBlock(source: string): boolean {
  const separator = source.search(/\r?\n\r?\n/);
  if (separator < 0) return false;
  const headers = source.slice(0, separator).split(/\r?\n/);
  return (
    headers.length > 0 &&
    headers.every((line, index) =>
      index > 0 && /^\s/.test(line) ? true : /^[\w-]+:\s*.*$/.test(line),
    )
  );
}

export function adaptEmlFile(content: string, filename: string): NormalizedAnalysisInput {
  if (/\.msg$/i.test(filename)) throw new InputAdapterError('unsupported-msg');
  if (!/\.eml$/i.test(filename)) throw new InputAdapterError('unsupported-file');
  if (!content.trim()) throw new InputAdapterError('empty');
  if (!hasHeaderBlock(content)) throw new InputAdapterError('malformed-source');
  return normalized(
    'eml-file',
    'file',
    'message/rfc822',
    filename,
    content,
    'FULL',
    fullCapabilities,
  );
}

export function adaptRawSource(content: string): NormalizedAnalysisInput {
  if (!content.trim()) throw new InputAdapterError('empty');
  if (!hasHeaderBlock(content)) throw new InputAdapterError('malformed-source');
  return normalized(
    'raw-source',
    'paste',
    'message/rfc822',
    'pasted-original-source.eml',
    content,
    'FULL',
    fullCapabilities,
  );
}

export function adaptHeaders(content: string): NormalizedAnalysisInput {
  if (!content.trim()) throw new InputAdapterError('empty');
  const lines = content.split(/\r?\n/);
  const block: string[] = [];
  for (const line of lines) {
    if (!line.trim()) break;
    if (/^\s/.test(line) && block.length) {
      block.push(line);
      continue;
    }
    if (!/^[\w-]+:\s*.*$/.test(line)) throw new InputAdapterError('malformed-headers');
    block.push(line);
  }
  if (!block.length) throw new InputAdapterError('malformed-headers');
  return normalized(
    'headers',
    'paste',
    'message-headers',
    'pasted-headers.txt',
    `${block.join('\r\n')}\r\n\r\n`,
    'LIMITED',
    headerCapabilities,
  );
}

export function adaptBody(content: string): NormalizedAnalysisInput {
  if (!content.trim()) throw new InputAdapterError('empty');
  const safeMessage = `MIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${content}`;
  return normalized(
    'body',
    'paste',
    'text/plain',
    'pasted-body.txt',
    safeMessage,
    'LIMITED',
    bodyCapabilities,
  );
}

export function adaptDemo(content: string): NormalizedAnalysisInput {
  const adapted = adaptRawSource(content);
  return {
    ...adapted,
    adapter: { ...adapted.adapter, inputKind: 'demo' },
    displayName: 'demo-advance-fee.eml',
  };
}
