# TRUSTMEBRO

> **Is this email bullshit?**

Privacy-first, browser-local email scam and phishing analysis.

**Live:** https://trustmebro.nachtigall.dev/

TRUSTMEBRO inspects suspicious email material locally in your browser, applies deterministic and versioned rules, and shows the evidence behind every finding.

**No opaque AI verdict. No trust required.**

## Current version

**v0.1**

The current public release supports:

- local `.eml` analysis
- pasted original message/source
- headers-only and body/text-only analysis
- adapter provenance and per-source analysis capabilities in the JSON report
- explicit **FULL / LIMITED** source completeness
- MIME, header, URL and attachment extraction when the source contains them
- deterministic, versioned findings with stable rule IDs
- evidence-backed explanations
- structured SPF (HELO and MAIL FROM), DKIM and DMARC observations
- explainable, deterministic 0–100 signal score (not a phishing probability)
- URL sources, link destinations, visible link text and attachment metadata
- reproducible JSON report export
- English and German UI
- Light / Dark / System themes
- browser-local email analysis with no reputation API

Example rule ID:

`identity.from_replyto_mismatch@3`

Missing evidence is treated as unavailable, not as evidence that a message is safe. The signal score describes rule-based concern, not certainty that an email is phishing, a scam, or safe.

## How it works

```text
file or paste mode
      |
      v
input adapter -> normalized input
      |
      v
parse and analyze locally
      |
      v
explained report + evidence
```

Rules are deterministic and versioned. The report keeps the source completeness visible so a partial input cannot silently masquerade as a full analysis.

## Privacy model

Email analysis happens in the browser. Raw messages, headers, bodies, extracted URLs and attachments are not sent to an analysis service. Loading the hosted site is a separate request and may expose ordinary connection data to hosting and transport providers.

TRUSTMEBRO does not use a remote reputation service or an LLM to decide whether an email is suspicious. Theme and locale preferences are stored locally in the browser.

Normal requests required to load the hosted website are separate from email analysis. See the Privacy surface on the live site for the deployment-specific details and current review notes.

The analyzer is browser-side, deterministic and rule-based. It does not use an AI model to assess email.

## What TRUSTMEBRO is not

TRUSTMEBRO is not a guarantee that an email is safe, a malware sandbox, an attachment execution environment, a remote reputation service, or an AI-generated probability-of-scam score.

A **LIMITED** analysis may not contain enough source material to run rules that require headers, authentication results, routing information, MIME structure or attachment metadata.

### Input adapters

- `.eml` file and complete original-source paste use the same MIME parser and produce **FULL** input when a header block and message separator are present.
- Headers-only paste stops at the first blank line. It provides headers, authentication and routing; body, URLs, attachments and MIME body analysis are unavailable.
- Body-only paste is wrapped as plain text for parsing. It provides body and URL checks; lines such as `Subject:` and `Received:` remain body text and are not treated as headers.
- `.msg`, MBOX and provider-specific exports are not supported.

Each report records the adapter ID/version, input kind, supplied format, completeness and capability flags. The report schema remains `trustmebro.report/v0.1`; email contents are not included in the exported report.

## Development

The project uses TypeScript, Bun and a static browser build. MIME parsing, HTML-fragment inspection and Public Suffix List domain handling use `postal-mime`, `parse5` and `tldts`. Google Fonts are self-hosted in `assets/fonts/` with their OFL licenses. Bun is the package manager, script runner, build tool and normal test runtime.

Install the locked dependencies with Bun and run the CI validation suite:

```sh
bun install --frozen-lockfile
bun run check
bun run build
```

`bun run dev` watches and rebuilds the static site into `dist/`. `bun run test` builds the app and runs all tests through `bun test`; Bun's test preload registers Happy DOM, and the production bundle is exercised in isolated browser-like windows. Test helpers wait for an application completion event rather than sleeping for a fixed duration. Coverage includes adapter validation and provenance, locale rerendering, accessible import state, MIME nesting and transfer encoding, authentication alignment, score caps, reset/race behavior, hostile HTML inertness, URL scheme filtering, object URL cleanup and the static build. A narrow test-only Blob adapter normalizes cross-realm ArrayBuffers because Happy DOM currently mishandles those standard Blob parts in its VM; test expectations remain unchanged. Synthetic messages are committed in tests. The standard check never reads private fixtures. To opt in to local `.eml` checks under `upload/` and `test-mails/`, run `bun run test:local-fixtures`; both directories are ignored by Git.

Supported browsers are current evergreen releases of Chromium, Firefox and Safari, including their maintained mobile versions. The app relies on interoperable ES modules, `TextDecoder`, Clipboard API on secure contexts, native file controls and standard DOM/CSS behavior. Obsolete browsers and legacy polyfill bundles are out of scope. The Happy DOM suite is a regression environment, not a substitute for a manual cross-browser visual/accessibility audit; WCAG conformance is not claimed.

Available scripts: `dev`, `build`, `build:test`, `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `test`, `test:local-fixtures` and `check`. `check` runs formatting validation, lint, typechecking, the complete Bun test suite and a production build. TypeScript `strict` is enabled. `noImplicitAny` remains disabled for older unannotated functions in the monolithic UI/analyzer file; normalized adapters, report contracts, DOM query helper and input state have explicit types. `.msg` and MBOX are unsupported.

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## Release history

See [CHANGELOG.md](CHANGELOG.md).

## License

No license has been selected yet. Until that changes, no open-source license is granted by this repository.
