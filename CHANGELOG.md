# Changelog

All notable public milestones for TRUSTMEBRO are documented here.

## Unreleased — 2026-09-26

- migrated the browser app to TypeScript with Bun static build, watch, typecheck and test scripts
- added browser-bundled postal-mime MIME parsing and tldts Public Suffix List domain alignment
- self-hosted DM Mono and Space Grotesk fonts with OFL license files; removed Google Fonts requests
- ignored the local `test-mails/` fixture directory and retained fixture-free synthetic regression tests
- hardened MIME/header parsing, attachment deduplication, encoded header decoding and URL evidence
- split HELO and MAIL FROM SPF, with structured authentication and alignment observations
- clarified neutral finding labels and versioned local rule set (ruleVersion 3)
- added explainable, deterministic concern signal score, explicitly not a phishing probability
- expanded local regression tests, with optional private real-world fixtures kept out of Git
- revised local-first roadmap; network enrichment and sanitized sharing remain future work

## v0.1 — 2026-09-20

First public release.

### Added

- browser-local `.eml` parsing and analysis
- deterministic, versioned detection rules with stable rule IDs
- evidence-backed findings and forensic detail views
- FULL / LIMITED source-completeness model
- original-message/source, headers-only and body/text-only paste modes
- acquisition guidance for common mail clients
- reproducible JSON report export
- English and German localization
- Light, Dark and System appearance modes
- TRUSTMEBRO visual identity and favicon
- localized Imprint/Impressum and Privacy/Datenschutz surfaces
- public deployment at https://trustmebro.nachtigall.dev/

### Privacy model

- email analysis runs in the browser
- no analysis backend receives raw email content
- no remote reputation API participates in verdicts
- no LLM participates in email verdicts
- only locale and theme preferences are intentionally persisted by the app in localStorage

### Known limitations

- partial sources cannot support rules that require missing evidence
- `.msg` is not supported
- the analyzer is not a malware sandbox and a lack of findings is not proof of safety
- deployment-specific legal/privacy details still require final operator verification before being treated as final legal copy
