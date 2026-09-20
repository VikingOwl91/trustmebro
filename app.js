(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const root = document.documentElement;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const state = { report: null, toastTimer: null, importMode: 'file', guideClient: 'gmail', helpOpen: false };

  function init() {
    const zone = $('#dropzone');
    const input = $('#fileInput');
    if (!zone || !input) return;

    initTheme();
    initImportUI();
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
    window.addEventListener('hashchange', openReportView);
    openReportView();
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
    if (/\.msg$/i.test(file.name)) return fail('Outlook .msg is not supported yet. Export the message as .eml or paste its original source instead. Nothing was uploaded.');
    if (!/\.eml$/i.test(file.name) && !/message\/rfc822|text\/plain/i.test(file.type)) return fail('Unsupported file. Choose an .eml email export. Nothing was read or uploaded.');
    state.importMode = 'file';
    state.inputMode = 'full';
    setState('Reading locally…', 'busy');
    file.text().then((text) => analyze(file.name, text)).catch(() => fail('The file could not be read. It stayed local and was not uploaded.'));
  }

  async function analyze(filename, text) {
    try {
      setState('Parsing headers and extracting indicators locally…', 'busy');
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (!text || (state.inputMode !== 'body' && !/^\s*[\w-]+:/m.test(text))) return fail('This does not look like a valid email source. It stayed local and was not uploaded.');
      const parsed = parse(text);
      const report = { schema: 'trustmebro.report/v0.1', analyzer: 'TRUSTMEBRO local analyzer', ruleVersion: '1', analyzedAt: new Date().toISOString(), filename, privacy: { rawEmailUploaded: false, messageUploaded: false, attachmentsUploaded: false, externalRequests: 0 }, metadata: { date: parsed.headers.date || null, subject: parsed.headers.subject || null }, headers: parsed.headers, received: parsed.received, urls: parsed.urls, attachments: parsed.attachments, findings: rules(text, parsed) };
      report.source = sourceProfile(state.inputMode || 'full');
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
    const lower = text.toLowerCase(); const findings = []; const capabilities = sourceProfile(state.inputMode || 'full').capabilities;
    const add = (id, title, why, evidence, category) => findings.push({ id, title, why, evidence, category, version: '1' });
    const address = (key) => parsed.headers[key]?.match(/<([^>]+)>/)?.[1] || parsed.headers[key];
    if (capabilities.headers && address('from') && address('reply-to') && address('from') !== address('reply-to')) add('identity.from_replyto_mismatch', 'From / Reply-To mismatch', 'The displayed sender and requested reply destination are different identities. That can be legitimate, but it is a common phishing signal.', `From: ${parsed.headers.from}\nReply-To: ${parsed.headers['reply-to']}`, 'Identity');
    if (capabilities.authentication) { if (/spf\s*=\s*(none|fail|softfail)/i.test(text) || !parsed.headers['authentication-results']) add('auth.spf_missing', 'SPF is missing or inconclusive', 'The message does not provide a passing SPF result tying the sending server to the sender domain.', parsed.headers['authentication-results'] || 'No Authentication-Results header found', 'Authentication'); if (/dkim\s*=\s*(none|fail)/i.test(text)) add('auth.dkim_fail', 'DKIM is missing or failed', 'The message has no reliable cryptographic signature proving its claimed sending domain.', parsed.headers['authentication-results'], 'Authentication'); }
    if (capabilities.body && /\$\s?[\d,.]+|million|inheritance|donat|widow|charity/.test(lower)) add('content.unsolicited_financial_offer', 'Unsolicited financial or charity narrative', 'The message uses an unexpected promise of money, donation, inheritance, or a charitable transfer.', snippet(text, /million|donat|inheritance|widow|charity/), 'Content');
    if (capabilities.body && /urgent|immediately|as soon as possible|act now/.test(lower)) add('content.urgency', 'Pressure to respond quickly', 'Urgency reduces the time available to verify an unusual request independently.', snippet(text, /urgent|immediately|act now/), 'Content');
    if (capabilities.body && capabilities.headers && /reply|contact|respond/.test(lower) && /donat|million|transfer|payment/.test(lower)) add('content.external_reply_request', 'Request to continue the conversation externally', 'The message asks you to reply or contact someone in connection with a financial proposition.', parsed.headers['reply-to'] || 'Reply instruction detected', 'Content');
    if (capabilities.urls && parsed.urls.length) add('links.link_present', 'Links found', 'Links are not automatically unsafe, but they should be inspected before opening.', parsed.urls.join('\n'), 'Links');
    if (capabilities.attachments && parsed.attachments.length) add('attachments.metadata', 'Attachment metadata found', 'Attachments are treated as opaque bytes. TRUSTMEBRO does not execute or upload them.', parsed.attachments.map((a) => a.name).join('\n'), 'Attachments');
    return findings;
  }

  function snippet(text, expression) { return text.match(new RegExp(`.{0,55}(${expression.source}).{0,80}`, 'i'))?.[0] || 'Pattern detected'; }

  function render(report) {
    $('#report')?.classList.remove('hidden'); $('#report')?.scrollIntoView?.({ behavior: 'smooth' });
    const categories = new Set(report.findings.map((finding) => finding.category));
    $('#verdict').textContent = report.findings.length ? 'Likely suspicious' : 'No obvious red flags';
    $('#summary').textContent = `${report.filename} · ${new Date(report.analyzedAt).toLocaleString()} · ${report.findings.length} explainable finding${report.findings.length === 1 ? '' : 's'}`;
    const completeness = $('.completeness'); if (completeness && report.source) { completeness.querySelector('strong').textContent = report.source.level; completeness.querySelector('span:last-child').textContent = report.source.explanation; }
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
  function openReportView() { const target = location.hash ? document.querySelector(location.hash) : null; if (target?.tagName === 'DETAILS') target.open = true; }
  function sourceProfile(mode) { const profiles = { full: { level: 'FULL', explanation: 'Original message with headers and MIME source was analyzed locally.', capabilities: { headers: true, authentication: true, routing: true, body: true, urls: true, attachments: true, mime: true } }, source: { level: 'FULL', explanation: 'Original message/source was analyzed locally.', capabilities: { headers: true, authentication: true, routing: true, body: true, urls: true, attachments: true, mime: true } }, headers: { level: 'LIMITED', explanation: 'Headers were available; body, links and attachments were not evaluated.', capabilities: { headers: true, authentication: true, routing: true, body: false, urls: false, attachments: false, mime: false } }, body: { level: 'LIMITED', explanation: 'Only message text was available; sender, authentication, routing and attachments were not evaluated.', capabilities: { headers: false, authentication: false, routing: false, body: true, urls: true, attachments: false, mime: false } } }; return profiles[mode] || profiles.full; }
  function toast(message) { const element = $('#toast'); if (!element) return; element.textContent = message; element.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => element.classList.remove('show'), 1600); }
  function setState(message, kind = '') { const element = $('#state'); if (element) { element.textContent = message; element.dataset.kind = kind; } }
  function fail(message) { setState(message, 'error'); const title = $('#dropTitle'); if (title) title.textContent = 'Try another .eml file'; }
  function demoText() { return `From: Mrs. Elizabeth A. Johnson <deh@dehglobal.com>\nTo: you@example.com\nReply-To: elizabethjohnson059@gmail.com\nReturn-Path: <bounce@mailer.example.net>\nSubject: Urgent charity donation opportunity\nDate: Sat, 20 Sep 2026 15:42:00 +0000\nReceived: from mail.example.net (203.0.113.42)\nAuthentication-Results: mx; dkim=none; spf=none; dmarc=none\nContent-Type: text/plain\n\nI am a 78-year-old widow and wish to donate $5.6 million. Please reply immediately to arrange this charitable transfer.`; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
  function initImportUI() {
    const drop = $('#dropzone'); if (!drop || $('#importChoices')) return;
    $('#fileInput').setAttribute('accept', '.eml,.msg,message/rfc822,text/plain');
    const panel = document.createElement('div'); panel.id = 'importChoices'; panel.className = 'import-choices';
    panel.innerHTML = `<span class="section-no">IMPORT OPTIONS</span><strong>Got a suspicious email?</strong><div class="import-buttons" role="tablist" aria-label="Email import method"><button role="tab" aria-selected="false" data-import="file">Email file</button><button role="tab" aria-selected="false" data-import="source">Paste original message/source</button><button role="tab" aria-selected="false" data-import="headers">Paste headers</button><button role="tab" aria-selected="false" data-import="body">Paste email text</button><button id="helpButton" type="button">How do I get my email?</button></div><p class="import-hint">Original message/source gives the most complete analysis. Partial input is clearly marked as LIMITED.</p><div class="paste-box hidden" id="pasteBox"><label for="pasteInput" id="pasteLabel">Paste your email source</label><textarea id="pasteInput" rows="7" spellcheck="false" placeholder="Paste the original message, headers, or email text here…"></textarea><div><button class="button" id="pasteAnalyze">Analyze pasted input</button><button class="text-button" id="pasteCancel">Cancel</button></div></div><div class="help-box hidden" id="helpBox"><div class="help-heading"><strong>How to get the original message</strong><button class="text-button" id="helpCancel" type="button">Close</button></div><div class="guide-tabs" role="tablist" aria-label="Email client guide"><button role="tab" aria-selected="false" data-guide="gmail">Gmail</button><button role="tab" aria-selected="false" data-guide="outlook">Outlook</button><button role="tab" aria-selected="false" data-guide="thunderbird">Thunderbird</button><button role="tab" aria-selected="false" data-guide="apple">Apple Mail</button><button role="tab" aria-selected="false" data-guide="other">Other</button></div><div id="guideText"></div></div>`;
    drop.after(panel); const file = $('#fileInput');
    const setActive = (selector, value, stateKey) => { state[stateKey] = value; panel.querySelectorAll(selector).forEach((button) => { const selected = state[stateKey] === (button.dataset.import || button.dataset.guide); button.setAttribute('aria-selected', String(selected)); button.classList.toggle('is-selected', selected); if (button.getAttribute('role') === 'tab') button.tabIndex = selected ? 0 : -1; }); };
    setActive('[data-import]', 'file', 'importMode');
    setActive('[data-guide]', 'gmail', 'guideClient');
    panel.querySelectorAll('[data-import]').forEach((button) => button.addEventListener('click', () => { const mode = button.dataset.import; if (mode === 'file') { setActive('[data-import]', 'file', 'importMode'); hidePanels(); file.click(); } else showPaste(mode); }));
    panel.querySelector('#helpButton').onclick = () => showHelp(state.guideClient);
    panel.querySelector('#helpCancel').onclick = hideHelp;
    panel.querySelector('#pasteCancel').onclick = () => $('#pasteBox').classList.add('hidden'); panel.querySelector('#pasteAnalyze').onclick = () => { const text = $('#pasteInput').value; const mode = panel.dataset.mode; if (!text.trim()) return setState('Paste some message material first.', 'error'); state.inputMode = mode; analyze(`pasted-${mode}.txt`, text); };
    panel.querySelectorAll('[data-guide]').forEach((button) => button.onclick = () => showHelp(button.dataset.guide));
    function showPaste(mode) { panel.dataset.mode = mode; setActive('[data-import]', mode, 'importMode'); hideHelp(); $('#pasteBox').classList.remove('hidden'); $('#pasteLabel').textContent = mode === 'headers' ? 'Paste message headers' : mode === 'body' ? 'Paste email text/body' : 'Paste the complete original message/source'; $('#pasteInput').focus(); }
    function showHelp(client) { state.helpOpen = true; setActive('[data-guide]', client, 'guideClient'); $('#pasteBox').classList.add('hidden'); $('#helpBox').classList.remove('hidden'); const guides = { gmail:['Open the message → ⋮ More → Show original.','Use Download original, then import the downloaded file.'], outlook:['Open the message → ⋯ More actions → View → View message details.','For the strongest source, use Save as / Download as .eml when available.'], thunderbird:['Open the message → More → View Source.','Save the source or use Save As to create an .eml file.'], apple:['Open the message → View → Message → All Headers.','For full evidence, use File → Save As → Raw Message.'], other:['Look for “Show original”, “View source”, “Download message” or “Save as .eml”.','Forwarding is not equivalent: it can remove or alter useful headers.'] }; $('#guideText').innerHTML = `<ol>${guides[client].map((line) => `<li>${esc(line)}</li>`).join('')}</ol><p class="muted">Recommended: original message/source. It preserves the most forensic evidence and stays local in TRUSTMEBRO.</p>`; }
    function hideHelp() { state.helpOpen = false; $('#helpBox').classList.add('hidden'); }
    function hidePanels() { hideHelp(); $('#pasteBox').classList.add('hidden'); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
