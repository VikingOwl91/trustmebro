# TRUSTMEBRO Roadmap

TRUSTMEBRO is a privacy-first `.eml` analyzer. Its guiding principle is:

> **Local by default → evidence over verdicts → network only by explicit action → sharing only sanitized + explicit consent → transparent data flows → zero ads**

This roadmap records the current product direction. It is intentionally staged: the local analysis foundation comes before network-assisted features, sharing, and community intelligence.

## 1. Finish the local analysis base

Make the privacy-first browser-local analyzer reliable and technically precise.

- Parse and model headers/authentication, routing, MIME structure, body content, URLs, and attachments.
- Keep findings explainable and reproducible.
- Keep committed parser regressions synthetic and fixture-independent; local private messages are optional, ignored, and only read by explicit opt-in.

## 2. Establish the evidence/report model

The report should show what was observed before it interprets what it may mean.

- Separate raw observations and evidence from derived findings and verdicts.
- Show the source, value, and reasoning for each notable observation.
- Avoid opaque risk percentages or “TRUSTMEBRO says 97% phishing” scoring.
- Make local processing and future network enrichment visibly distinct.
- Expose data-flow facts such as `rawEmailUploaded: false`, `attachmentsUploaded: false`, and `externalRequests: 0`.
- Add a deterministic, explainable concern assessment with category caps and weighted reasons. It is explicitly not a probability of phishing, scam, or safety.

## 3. Harden privacy UX and data-flow transparency

- Keep email analysis fully local by default.
- Make external requests and their purpose explicit whenever they exist.
- Add consent patterns that identify the exact data leaving the browser.
- For every optional network operation, show what is sent and what remains local.
- Keep the product free of advertising networks, tracking scripts, telemetry, and “disable your ad blocker” flows.

## 4. Add explicit network-assisted features

The first network feature should be optional URL reputation enrichment.

- Trigger it only through a separate, explicit user action.
- Show a consent dialog naming the exact URL sent to the backend.
- Keep the rest of the email local unless the user explicitly chooses otherwise.
- Label network-enriched results separately from local analysis in the report.

## 5. Build sanitized submit and share flows

- Accept only explicitly user-submitted, sanitized reports.
- Never upload the original email or attachments by default.
- Provide a sanitization preview with “will be transferred” and “will remain local” sections.
- Use the same sanitization pipeline for community submission and a future shareable/static report.
- Make sharing “share sanitized report”, never “share my email”.

## 6. Develop community threat intelligence

Submitted reports are observations, not automatic truths or verdicts.

Aggregate cautiously and transparently around:

- recurring domains and Reply-To infrastructure;
- campaigns and temporal clusters;
- subject patterns and provider characteristics;
- attachment and delivery patterns.

Keep provenance, uncertainty, and aggregation boundaries visible.

## 7. Publish capability transparency

Create a fair competitor/capability matrix based on verifiable evidence rather than marketing claims.

- Include sources, tested version, and test date.
- Document Trustmebro’s capabilities and limitations equally.
- Use `unknown` / `not documented` when a capability cannot be verified.
- Do not frame the comparison as “we can, everyone else cannot”.

## 8. Sustainable, non-invasive support

- Keep the product zero-ads.
- Offer optional, unobtrusive support through Ko-fi.
- Use the existing playful wording:

  > ☕ Feed the server hamsters — most analysis happens on your device, but the server hamsters still demand coffee.

## Completed local slice

The local parser fixes, structured authentication evidence, MIME parameter handling, URL source/visible-text evidence, neutral finding IDs, and regression coverage for local known-message patterns are implemented. Report rule version is `3`; the assessment is versioned independently as `2`.

The browser app now uses a Bun static build and TypeScript entry point. MIME parsing uses `postal-mime`, organizational-domain alignment uses `tldts`, and fonts are served from local assets. No API client or backend calls are part of this slice; a future Go API remains a separate integration.

## Current next slice

Before starting network, sharing, or community features, keep the local report contract stable and implement the explicit sanitization preview/consent flow for future submit and share actions.
