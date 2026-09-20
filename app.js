(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const root = document.documentElement;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const state = { report: null, toastTimer: null };

  function init() {
    const zone = $('#dropzone');
    const input = $('#fileInput');
    if (!zone || !input) return;

    initTheme();
    zone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
    });
    zone.addEventListener('dragover', (event) => {
      event.preventDefault(); zone.classList.add('drag'); setState('Drop to start a local analysis.', 'drag');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', (event) => {
      event.preventDefault(); zone.classList.remove('drag');
      const file = event.dataTransfer?.files?.[0]; if (file) handleFile(file);
    });
    input.addEventListener('change', () => { const file = input.files?.[0]; if (file) { handleFile(file); input.value = ''; } });
    $('#demoButton')?.addEventListener('click', () => analyze('demo-advance-fee.eml', demoText()));
    $('#resetButton')?.addEventListener('click', () => { $('#report')?.classList.add('hidden'); $('#home')?.scrollIntoView?.(); });
    $('#copyButton')?.addEventListener('click', copyReport);
    $('#exportButton')?.addEventListener('click', exportReport);
    document.addEventListener('click', handleCopyClick);
    document.addEventListener('keydown', handleShortcut);
  }

  function initTheme() {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const saved = localStorage.getItem('trustmebro-theme') || 'system';
    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
      button.addEventListener('click', () => { localStorage.setItem('trustmebro-theme', button.dataset.themeChoice); setTheme(button.dataset.themeChoice); });
    });
    setTheme(saved);
    media?.addEventListener?.('change', () => { if (root.dataset.preference === 'system') setTheme('system'); });
  }

  function setTheme(preference) {
    const dark = preference === 'system' ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false) : preference === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light'; root.dataset.preference = preference;
    document.querySelectorAll('[data-theme-choice]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preference)));
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = dark ? '#0f1712' : '#f4f1e9';
  }

  function handleFile(file) {
    if (file.size > MAX_FILE_SIZE) return fail('This file is larger than 10 MB. Nothing was read or uploaded.');
    if (!/\.eml$/i.test(file.name) && !/message\/rfc822|text\/plain/i.test(file.type)) return fail('Unsupported file. Choose an .eml email export. Nothing was read or uploaded.');
    setState('Reading locally…', 'busy');
    file.text().then((text) => analyze(file.name, text)).catch(() => fail('The file could not be read. It stayed local and was not uploaded.'));
  }

  async function analyze(filename, text) {
    try {
      setState('Parsing headers and extracting indicators locally…', 'busy');
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (!text || !/^\s*[\w-]+:/m.test(text)) return fail('This does not look like a valid EML file. It stayed local and was not uploaded.');
      const parsed = parse(text);
      const report = { schema: 'trustmebro.report/v0.1', analyzer: 'TRUSTMEBRO local analyzer', ruleVersion: '1', analyzedAt: new Date().toISOString(), filename, privacy: { rawEmailUploaded: false, messageUploaded: false, attachmentsUploaded: false, externalRequests: 0 }, metadata: { date: parsed.headers.date || null, subject: parsed.headers.subject || null }, headers: parsed.headers, received: parsed.received, urls: parsed.urls, attachments: parsed.attachments, findings: rules(text, parsed) };
      state.report = report; render(report); setState('Analysis complete. Everything stayed in this browser.', 'success');
    } catch (error) { fail(`Analysis failed safely: ${error.message}`); }
  }

  function parse(text) {
    const headers = {}; let current = null;
    for (const line of text.split(/\r?\n/)) {
      if (/^\s/.test(line) && current) { headers[current] += ` ${line.trim()}`; continue; }
      const match = line.match(/^([\w-]+):\s*(.*)$/); if (!match) { current = null; continue; }
      current = match[1].toLowerCase(); headers[current] = headers[current] ? `${headers[current]} | ${match[2]}` : match[2];
    }
    const urls = [...text.matchAll(/https?:\/\/[^\s<>]+/gi)].map((match) => match[0].replace(/[),.;]+$/, ''));
    const received = [...text.matchAll(/^Received:\s*(.*)$/gim)].map((match) => match[1]);
    const attachments = [...text.matchAll(/(?:filename|name)\s*=\s*["']?([^\s"';]+)/gi)].map((match) => ({ name: match[1], hash: null }));
    return { headers, urls: [...new Set(urls)], received, attachments };
  }

  function rules(text, parsed) {
    const lower = text.toLowerCase(); const findings = [];
    const add = (id, title, why, evidence, category) => findings.push({ id, title, why, evidence, category, version: '1' });
    const address = (key) => parsed.headers[key]?.match(/<([^>]+)>/)?.[1] || parsed.headers[key];
    if (address('from') && address('reply-to') && address('from') !== address('reply-to')) add('identity.from_replyto_mismatch', 'From / Reply-To mismatch', 'The displayed sender and requested reply destination are different identities. That can be legitimate, but it is a common phishing signal.', `From: ${parsed.headers.from}\nReply-To: ${parsed.headers['reply-to']}`, 'Identity');
    if (/spf\s*=\s*(none|fail|softfail)/i.test(text) || !parsed.headers['authentication-results']) add('auth.spf_missing', 'SPF is missing or inconclusive', 'The message does not provide a passing SPF result tying the sending server to the sender domain.', parsed.headers['authentication-results'] || 'No Authentication-Results header found', 'Authentication');
    if (/dkim\s*=\s*(none|fail)/i.test(text)) add('auth.dkim_fail', 'DKIM is missing or failed', 'The message has no reliable cryptographic signature proving its claimed sending domain.', parsed.headers['authentication-results'], 'Authentication');
    if (/\$\s?[\d,.]+|million|inheritance|donat|widow|charity/.test(lower)) add('content.unsolicited_financial_offer', 'Unsolicited financial or charity narrative', 'The message uses an unexpected promise of money, donation, inheritance, or a charitable transfer.', snippet(text, /million|donat|inheritance|widow|charity/), 'Content');
    if (/urgent|immediately|as soon as possible|act now/.test(lower)) add('content.urgency', 'Pressure to respond quickly', 'Urgency reduces the time available to verify an unusual request independently.', snippet(text, /urgent|immediately|act now/), 'Content');
    if (/reply|contact|respond/.test(lower) && /donat|million|transfer|payment/.test(lower)) add('content.external_reply_request', 'Request to continue the conversation externally', 'The message asks you to reply or contact someone in connection with a financial proposition.', parsed.headers['reply-to'] || 'Reply instruction detected', 'Content');
    if (parsed.urls.length) add('links.link_present', 'Links found', 'Links are not automatically unsafe, but they should be inspected before opening.', parsed.urls.join('\n'), 'Links');
    if (parsed.attachments.length) add('attachments.metadata', 'Attachment metadata found', 'Attachments are treated as opaque bytes. TRUSTMEBRO does not execute or upload them.', parsed.attachments.map((a) => a.name).join('\n'), 'Attachments');
    return findings;
  }

  function snippet(text, expression) { return text.match(new RegExp(`.{0,55}(${expression.source}).{0,80}`, 'i'))?.[0] || 'Pattern detected'; }

  function render(report) {
    $('#report')?.classList.remove('hidden'); $('#report')?.scrollIntoView?.({ behavior: 'smooth' });
    const categories = new Set(report.findings.map((finding) => finding.category));
    $('#verdict').textContent = report.findings.length ? 'Likely suspicious' : 'No obvious red flags';
    $('#summary').textContent = `${report.filename} · ${new Date(report.analyzedAt).toLocaleString()} · ${report.findings.length} explainable finding${report.findings.length === 1 ? '' : 's'}`;
    $('#stats').innerHTML = [['findings', report.findings.length], ['categories', categories.size], ['links found', report.urls.length], ['attachments', report.attachments.length]].map(([label, value]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`).join('');
    const groups = {}; report.findings.forEach((finding) => (groups[finding.category] ??= []).push(finding));
    $('#findingGroups').innerHTML = Object.keys(groups).length ? Object.entries(groups).map(([category, findings]) => `<div class="finding-group"><div class="group-title">${category} · ${findings.length}</div>${findings.map(findingHtml).join('')}</div>`).join('') : '<p>No rule matched this message. That is not a guarantee of safety.</p>';
    $('#headerDetails').innerHTML = rows(Object.entries(report.headers).filter(([key]) => ['from', 'to', 'reply-to', 'return-path', 'subject', 'date', 'message-id', 'authentication-results'].includes(key)));
    $('#linkDetails').innerHTML = report.urls.length ? report.urls.map(copyRow).join('') : '<span>No URLs extracted.</span>';
    $('#attachmentDetails').innerHTML = report.attachments.length ? report.attachments.map((item) => `<div class="tech-row"><span>${esc(item.name)}</span><span>opaque · not uploaded</span></div>`).join('') : '<span>No attachment metadata found.</span>';
    $('#rawDetails').innerHTML = rows([['received hops', report.received.length], ['rule IDs', report.findings.map((finding) => finding.id).join(', ') || 'none'], ['analyzer', report.analyzer], ['external requests', 0]]);
  }

  function findingHtml(finding) { return `<article class="finding"><div class="finding-top"><h4>${esc(finding.title)}</h4><span class="tag">${esc(finding.id)}@${finding.version}</span></div><p>${esc(finding.why)}</p><details><summary>Show evidence</summary><pre class="evidence">${esc(finding.evidence)}</pre></details></article>`; }
  function rows(items) { return items.length ? items.map(([key, value]) => `<div class="tech-row"><b>${esc(key)}</b><span class="copyable"><span>${esc(value || '—')}</span>${value ? `<button class="copy-btn" data-copy="${esc(value)}">copy</button>` : ''}</span></div>`).join('') : '<span>No matching headers found.</span>'; }
  function copyRow(value) { return `<div class="tech-row"><span class="copyable"><span>${esc(value)}</span><button class="copy-btn" data-copy="${esc(value)}">copy</button></span></div>`; }
  function handleCopyClick(event) { const button = event.target.closest('[data-copy]'); if (button) copyText(button.dataset.copy); }
  function copyText(value) { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(value); else { const area = document.createElement('textarea'); area.value = value; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); } toast('Copied locally'); }
  function copyReport() { if (state.report) copyText(JSON.stringify(state.report, null, 2)); }
  function exportReport() { if (!state.report) return; const blob = new Blob([JSON.stringify(state.report, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'trustmebro-report.json'; link.click(); URL.revokeObjectURL(link.href); toast('JSON export created locally'); }
  function handleShortcut(event) { if (event.target.matches('input, textarea, select, [contenteditable]') || event.ctrlKey || event.metaKey || event.altKey) return; if (event.key.toLowerCase() === 'o') { event.preventDefault(); $('#fileInput')?.click(); } if (event.key.toLowerCase() === 'n') $('#resetButton')?.click(); if (event.key === 'Escape') window.scrollTo({ top: 0 }); if (event.key.toLowerCase() === 'c') copyReport(); if (event.key.toLowerCase() === 'e') exportReport(); }
  function toast(message) { const element = $('#toast'); if (!element) return; element.textContent = message; element.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => element.classList.remove('show'), 1600); }
  function setState(message, kind = '') { const element = $('#state'); if (element) { element.textContent = message; element.dataset.kind = kind; } }
  function fail(message) { setState(message, 'error'); const title = $('#dropTitle'); if (title) title.textContent = 'Try another .eml file'; }
  function demoText() { return `From: Mrs. Elizabeth A. Johnson <deh@dehglobal.com>\nTo: you@example.com\nReply-To: elizabethjohnson059@gmail.com\nReturn-Path: <bounce@mailer.example.net>\nSubject: Urgent charity donation opportunity\nDate: Sat, 20 Sep 2026 15:42:00 +0000\nReceived: from mail.example.net (203.0.113.42)\nAuthentication-Results: mx; dkim=none; spf=none; dmarc=none\nContent-Type: text/plain\n\nI am a 78-year-old widow and wish to donate $5.6 million. Please reply immediately to arrange this charitable transfer.`; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
