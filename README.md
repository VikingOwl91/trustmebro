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

Email analysis happens in the browser. Raw messages, headers, bodies, extracted URLs and attachments are not sent to an analysis service. Loading the hosted site is a separate request and may expose ordinary connection data to hosting and transport providers.

TRUSTMEBRO does not use a remote reputation service or an LLM to decide whether an email is suspicious. Theme and locale preferences are stored locally in the browser.

Normal requests required to load the hosted website are separate from email analysis. See the Privacy surface on the live site for the deployment-specific details and current review notes.

The analyzer is browser-side, deterministic and rule-based. It does not use an AI model to assess email.

## What TRUSTMEBRO is not

TRUSTMEBRO is not a guarantee that an email is safe, a malware sandbox, an attachment execution environment, a remote reputation service, or an AI-generated probability-of-scam score.

A **LIMITED** analysis may not contain enough source material to run rules that require headers, authentication results, routing information, MIME structure or attachment metadata.

## Development

The project uses TypeScript, Bun and a static browser build. MIME parsing and Public Suffix List domain handling use `postal-mime` and `tldts`. Google Fonts are self-hosted in `assets/fonts/` with their OFL licenses.

Install the locked dependencies and run the static build:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
```

`bun run dev` watches and rebuilds the static site into `dist/`. The tests use Node.js and JSDOM to exercise the compiled browser bundle. They cover locale detection/persistence, report re-rendering, import and guide state, MIME nesting and transfer encoding, authentication alignment, score caps, reset behavior, and the production build. Synthetic test messages are inline in the tests, so a clean checkout does not need private fixtures. The normal test command never reads private mails. To opt into additional checks of local `.eml` files under `upload/` or `test-mails/`, run `TRUSTMEBRO_RUN_LOCAL_FIXTURES=1 bun run test`. Both folders are ignored by Git.

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## Release history

See [CHANGELOG.md](CHANGELOG.md).

## License

No license has been selected yet. Until that changes, no open-source license is granted by this repository.
