# Changelog

All notable public milestones for TRUSTMEBRO are documented here.

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
