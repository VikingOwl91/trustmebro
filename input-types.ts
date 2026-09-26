export type InputMode = 'eml-file' | 'raw-source' | 'headers' | 'body';
export type InputKind = 'file' | 'paste' | 'demo';
export type SourceLevel = 'FULL' | 'LIMITED';

export interface Capabilities {
  headers: boolean;
  authentication: boolean;
  routing: boolean;
  body: boolean;
  urls: boolean;
  attachments: boolean;
  mime: boolean;
}

export interface AdapterProvenance {
  id: InputMode;
  version: '1';
  inputKind: InputKind;
  format: 'message/rfc822' | 'text/plain' | 'message-headers';
}

export interface NormalizedAnalysisInput {
  adapter: AdapterProvenance;
  displayName: string;
  content: string;
  level: SourceLevel;
  capabilities: Capabilities;
}

export type InputAdapterErrorCode =
  | 'empty'
  | 'malformed-source'
  | 'malformed-headers'
  | 'unsupported-file'
  | 'unsupported-msg';

export class InputAdapterError extends Error {
  constructor(readonly code: InputAdapterErrorCode) {
    super(code);
    this.name = 'InputAdapterError';
  }
}
