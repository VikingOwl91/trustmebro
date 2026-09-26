import type { AdapterProvenance, Capabilities, SourceLevel } from './input-types';

export interface Finding {
  id: string;
  evidence: string;
  category: string;
  version: '3';
}

export interface AssessmentReason {
  id: string;
  category: string;
  rawWeight: number;
  contribution: number;
  categoryCap: number;
  labelKey: string;
}

export interface Assessment {
  version: '2';
  score: number;
  concernLevel: 'high' | 'elevated' | 'moderate' | 'limited';
  labelKey: string;
  reasons: AssessmentReason[];
  method: string;
}

export interface ReportSource {
  level: SourceLevel;
  explanation: string;
  adapter: AdapterProvenance;
  capabilities: Capabilities;
}

export interface AuthenticationEvidence {
  spf: {
    helo: string | null;
    heloDomain: string | null;
    mailFrom: string | null;
    mailFromDomain: string | null;
    results: Array<{ status: string; scope: string; domain: string | null; headerIndex: number }>;
  };
  dkim: Array<{ status: string; domain: string | null; headerIndex: number }>;
  dmarc: string | null;
  dmarcResults: Array<{ status: string; headerIndex: number }>;
  authResults: string[];
  alignment: {
    fromDomain: string | null;
    dkim: Array<{ domain: string | null; aligned: boolean | null }>;
    mailFrom: { domain: string | null; aligned: boolean | null };
  };
}

export interface AnalysisReport {
  schema: 'trustmebro.report/v0.1';
  analyzer: string;
  ruleVersion: '3';
  analyzedAt: string;
  filename: string;
  privacy: {
    rawEmailUploaded: false;
    messageUploaded: false;
    attachmentsUploaded: false;
    externalRequests: 0;
  };
  source: ReportSource;
  metadata: { date: string | null; subject: string | null };
  body: { status: 'readable' | 'unavailable'; textEvaluated: boolean };
  headers: Record<string, string>;
  received: string[];
  authentication: AuthenticationEvidence | null;
  urls: string[];
  urlDetails: Array<{
    url: string;
    host: string | null;
    kind: string;
    source: string;
    visibleText: string;
  }>;
  attachments: Array<{ name: string; hash: null; partIndex: number }>;
  findings: Finding[];
  assessment: Assessment;
}
