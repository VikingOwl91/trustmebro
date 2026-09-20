# Roadmap

TRUSTMEBRO follows a local-first, evidence-first design: deterministic analysis, explicit source completeness and no opaque verdicts.

Roadmap items are directional, not commitments.

## v0.1 — current

The first public release establishes the core product:

- browser-local `.eml` analysis
- original-source, headers-only and body/text-only import paths
- FULL / LIMITED source completeness
- deterministic versioned rules with stable IDs
- evidence-backed findings
- JSON report export
- English and German localization
- Light / Dark / System themes
- public ChatGPT Sites deployment at https://trustmebro.nachtigall.dev/

## v0.2 — planned / under consideration

- deterministic **Concern Level** assessment without pretending to provide a probability
- additional phishing and scam rules
- larger fixture and regression corpus
- stronger source-capability/applicability coverage
- further report and evidence refinements
- continued accessibility and keyboard-navigation polish

Concern and source completeness should remain separate concepts: LIMITED input must not artificially make a suspicious message look safer.

## Later / exploratory

- `.msg` support if a robust browser-local parser is practical
- `.mbox` import
- additional forensic capabilities
- carefully designed optional reputation enrichment without silently weakening the local-first privacy model

## Non-goals

The project is not intended to become an opaque AI classifier, malware execution sandbox, or service that requires uploading raw email just to obtain a verdict.
