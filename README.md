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
email material
      |
      v
 parse locally
      |
      v
extract evidence
      |
      v
 apply rules
      |
      v
explain findings
      |
      v
 export report
```

Rules are deterministic and versioned. The report keeps the source completeness visible so a partial input cannot silently masquerade as a full analysis.

## Privacy model

Email analysis happens in the browser. Raw messages, headers, bodies, extracted URLs and attachments are not sent to an analysis backend.

TRUSTMEBRO does not use a remote reputation service or an LLM to decide whether an email is suspicious. Theme and locale preferences are stored locally in the browser.

Normal requests required to load the hosted website are separate from email analysis. See the Privacy surface on the live site for the deployment-specific details and current review notes.

## Built with ChatGPT Sites

The current web application was developed and deployed using **ChatGPT Sites**. The application source is maintained in this repository.

That does **not** mean an AI model analyzes your email: the analyzer itself is browser-side, deterministic and rule-based.

## What TRUSTMEBRO is not

TRUSTMEBRO is not a guarantee that an email is safe, a malware sandbox, an attachment execution environment, a remote reputation service, or an AI-generated probability-of-scam score.

A **LIMITED** analysis may not contain enough source material to run rules that require headers, authentication results, routing information, MIME structure or attachment metadata.

## Development

The project is intentionally small: HTML, CSS and browser-side JavaScript.

The current regression tests use Node.js and JSDOM:

```sh
node tests/i18n.test.js
node tests/import-state.test.js
node tests/parser-regressions.test.js
node regression-test.js
```

The tests cover locale detection/persistence, report re-rendering without re-analysis, import-mode state, acquisition-guide state, Light/Dark interaction behavior and parser/report regressions. They require JSDOM (`npm install --no-save jsdom`). Private real-world `.eml` fixtures can be placed in `upload/` for additional local checks; they are optional and are not committed.

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## Release history

See [CHANGELOG.md](CHANGELOG.md).

## License

No license has been selected yet. Until that changes, no open-source license is granted by this repository.
