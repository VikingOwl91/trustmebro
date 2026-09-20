(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const root = document.documentElement;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const state = { report: null, toastTimer: null, importMode: 'file', guideClient: 'gmail', helpOpen: false, locale: 'en' };

  const translations = {
    en: {
      'nav.home':'TRUSTMEBRO home','nav.local':'LOCAL-FIRST','nav.appearance':'Appearance','nav.language':'Language','nav.system':'System','nav.light':'Light','nav.dark':'Dark',
      'hero.eyebrow':'A privacy-first email reality check','hero.title':'Is this email','hero.titleAccent':'bullshit?','hero.lede':'Drop an .eml file. TRUSTMEBRO checks it in your browser and shows its work. No raw email upload. No opaque AI verdict.','drop.title':'Drop your .eml here','drop.choose':'or click to choose a file','drop.limit':'Analyzed locally · max 10 MB','demo.button':'Try a safe demo email →','privacy.local':'Nothing leaves this browser.','status.drag':'Drop to start a local analysis.','status.reading':'Reading locally…','status.parsing':'Parsing headers and extracting indicators locally…','status.complete':'Analysis complete. Everything stayed in this browser.','status.copied':'Copied locally','status.exported':'JSON export created locally',
      'how.title':'What happens to your email?','how.parse':'Parse locally','how.parseText':'MIME, headers, links and attachments stay on your device.','how.rules':'Apply rules','how.rulesText':'Deterministic checks connect evidence to stable rule IDs.','how.explain':'Explain findings','how.explainText':'You see what was observed, why it matters, and where it came from.','promise.title':'No trust required.','promise.text':'Every finding answers three questions: What did we observe? Why is it suspicious? Where did that information come from?','footer.open':'Open-source analyzer · v0.1','footer.joke':"Because the email certainly won't.",
      'import.label':'IMPORT OPTIONS','import.heading':'Got a suspicious email?','import.file':'Email file','import.source':'Paste original message/source','import.headers':'Paste headers','import.body':'Paste email text','import.help':'How do I get my email?','import.hint':'Original message/source gives the most complete analysis. Partial input is clearly marked as LIMITED.','paste.source':'Paste your email source','paste.headers':'Paste message headers','paste.body':'Paste email text/body','paste.placeholder':'Paste the original message, headers, or email text here…','paste.analyze':'Analyze pasted input','common.cancel':'Cancel','help.title':'How to get the original message','help.close':'Close','help.recommended':'Recommended: original message/source. It preserves the most forensic evidence and stays local in TRUSTMEBRO.','guide.gmail.1':'Open the message → ⋮ More → Show original.','guide.gmail.2':'Use Download original, then import the downloaded file.','guide.outlook.1':'Open the message → ⋯ More actions → View → View message details.','guide.outlook.2':'For the strongest source, use Save as / Download as .eml when available.','guide.thunderbird.1':'Open the message → More → View Source.','guide.thunderbird.2':'Save the source or use Save As to create an .eml file.','guide.apple.1':'Open the message → View → Message → All Headers.','guide.apple.2':'For full evidence, use File → Save As → Raw Message.','guide.other.1':'Look for “Show original”, “View source”, “Download message” or “Save as .eml”.','guide.other.2':'Forwarding is not equivalent: it can remove or alter useful headers.',
      'report.label':'ANALYSIS REPORT','report.waiting':'Waiting for an email','report.copy':'Copy report','report.export':'Export JSON','report.another':'Analyze another ↗','report.sections':'Report sections','report.overview':'Overview','report.findings':'Findings','report.headers':'Headers','report.links':'Links','report.attachments':'Attachments','report.raw':'Raw details','report.suspicious':'Likely suspicious','report.clean':'No obvious red flags','report.summary':'{file} · {date} · {summary}','report.source':'SOURCE COMPLETENESS','report.full':'Original message with headers and MIME source was analyzed locally.','report.limitedHeaders':'Headers were available; body, links and attachments were not evaluated.','report.limitedBody':'Only message text was available; sender, authentication, routing and attachments were not evaluated.','report.privacyTitle':'Your email stays here.','report.privacyText':'Raw email, message body and attachments were not uploaded. External requests: 0.','report.local':'LOCAL ONLY','report.power':'Power-user view · ','report.normalized':'normalized message metadata','report.extracted':'extracted URLs and domains','report.metadata':'metadata only','report.routing':'routing and rule metadata','report.noUrls':'No URLs extracted.','report.noAttachments':'No attachment metadata found.','report.noHeaders':'No matching headers found.','report.noRules':'No rule matched this message. That is not a guarantee of safety.','report.finding':'finding','report.findingsPlural':'findings','report.categories':'categories','report.linksFound':'links found',
      'error.oversized':'This file is larger than 10 MB. Nothing was read or uploaded.','error.msg':'Outlook .msg is not supported yet. Export the message as .eml or paste its original source instead. Nothing was uploaded.','error.unsupported':'Unsupported file. Choose an .eml email export. Nothing was read or uploaded.','error.read':'The file could not be read. It stayed local and was not uploaded.','error.invalid':'This does not look like a valid email source. It stayed local and was not uploaded.','error.failed':'Analysis failed safely: {error}','error.emptyPaste':'Paste some message material first.','error.tryAgain':'Try another .eml file',
      'finding.identity.title':'From / Reply-To mismatch','finding.identity.explanation':'The displayed sender and requested reply destination are different identities. That can be legitimate, but it is a common phishing signal.','finding.authSpf.title':'SPF is missing or inconclusive','finding.authSpf.explanation':'The message does not provide a passing SPF result tying the sending server to the sender domain.','finding.authDkim.title':'DKIM is missing or failed','finding.authDkim.explanation':'The message has no reliable cryptographic signature proving its claimed sending domain.','finding.finance.title':'Unsolicited financial or charity narrative','finding.finance.explanation':'The message uses an unexpected promise of money, donation, inheritance, or a charitable transfer.','finding.urgency.title':'Pressure to respond quickly','finding.urgency.explanation':'Urgency reduces the time available to verify an unusual request independently.','finding.external.title':'Request to continue the conversation externally','finding.external.explanation':'The message asks you to reply or contact someone in connection with a financial proposition.','finding.links.title':'Links found','finding.links.explanation':'Links are not automatically unsafe, but they should be inspected before opening.','finding.attachments.title':'Attachment metadata found','finding.attachments.explanation':'Attachments are treated as opaque bytes. TRUSTMEBRO does not execute or upload them.','evidence.show':'Show evidence','evidence.observed':'OBSERVED','evidence.rule':'RULE','evidence.source':'SOURCE','technical.copy':'copy'
    },
    de: {
      'nav.home':'TRUSTMEBRO Startseite','nav.local':'NUR LOKAL','nav.appearance':'Darstellung','nav.language':'Sprache','nav.system':'System','nav.light':'Hell','nav.dark':'Dunkel',
      'hero.eyebrow':'Der datensparsame Realitätscheck für E-Mails','hero.title':'Ist diese E-Mail','hero.titleAccent':'Bullshit?','hero.lede':'Lege eine .eml-Datei ab. TRUSTMEBRO prüft sie direkt im Browser und zeigt seine Arbeit. Kein Upload der Originalmail. Kein undurchsichtiges KI-Urteil.','drop.title':'E-Mail-Datei hier ablegen','drop.choose':'oder klicken, um eine Datei auszuwählen','drop.limit':'Lokal analysiert · maximal 10 MB','demo.button':'Sichere Demo-Mail ausprobieren →','privacy.local':'Nichts verlässt diesen Browser.','status.drag':'Zum Starten einer lokalen Analyse ablegen.','status.reading':'Lokal wird gelesen…','status.parsing':'Header werden gelesen und Indikatoren lokal extrahiert…','status.complete':'Analyse abgeschlossen. Alles blieb in diesem Browser.','status.copied':'Lokal kopiert','status.exported':'JSON-Export lokal erstellt',
      'how.title':'Was passiert mit deiner E-Mail?','how.parse':'Lokal parsen','how.parseText':'MIME, Header, Links und Anhänge bleiben auf deinem Gerät.','how.rules':'Regeln anwenden','how.rulesText':'Deterministische Prüfungen verbinden Belege mit stabilen Regel-IDs.','how.explain':'Befunde erklären','how.explainText':'Du siehst, was beobachtet wurde, warum es relevant ist und woher es stammt.','promise.title':'Vertrauen nicht erforderlich.','promise.text':'Jeder Befund beantwortet drei Fragen: Was wurde beobachtet? Warum ist es verdächtig? Woher stammen die Informationen?','footer.open':'Open-Source-Analyzer · v0.1','footer.joke':'Denn diese E-Mail wird es sicher nicht sein.',
      'import.label':'IMPORTOPTIONEN','import.heading':'Eine verdächtige E-Mail?','import.file':'E-Mail-Datei','import.source':'Originalnachricht/Quelle einfügen','import.headers':'Header einfügen','import.body':'E-Mail-Text einfügen','import.help':'Wie bekomme ich meine E-Mail?','import.hint':'Die Originalnachricht/Quelle ermöglicht die vollständigste Analyse. Teilaussagen werden als LIMITED markiert.','paste.source':'E-Mail-Quelle einfügen','paste.headers':'Nachrichten-Header einfügen','paste.body':'E-Mail-Text/-Inhalt einfügen','paste.placeholder':'Originalnachricht, Header oder E-Mail-Text hier einfügen…','paste.analyze':'Eingefügten Inhalt analysieren','common.cancel':'Abbrechen','help.title':'Originalnachricht erhalten','help.close':'Schließen','help.recommended':'Empfehlung: Originalnachricht/Quelle. Sie bewahrt die meisten forensischen Informationen und bleibt in TRUSTMEBRO lokal.','guide.gmail.1':'Nachricht öffnen → ⋮ Mehr → Original anzeigen.','guide.gmail.2':'Original herunterladen und die Datei importieren.','guide.outlook.1':'Nachricht öffnen → ⋯ Weitere Aktionen → Ansicht → Nachrichtendetails anzeigen.','guide.outlook.2':'Für die vollständigste Quelle, sofern verfügbar, Als .eml speichern/herunterladen.','guide.thunderbird.1':'Nachricht öffnen → Mehr → Quelltext anzeigen.','guide.thunderbird.2':'Quelltext speichern oder mit „Speichern unter“ als .eml ablegen.','guide.apple.1':'Nachricht öffnen → Darstellung → Nachricht → Alle Header.','guide.apple.2':'Für vollständige Belege: Ablage → Sichern unter → Raw Message.','guide.other.1':'Suche nach „Original anzeigen“, „Quelltext anzeigen“, „Nachricht herunterladen“ oder „Als .eml speichern“.','guide.other.2':'Weiterleiten ist nicht gleichwertig: Dabei können wichtige Header verändert oder entfernt werden.',
      'report.label':'ANALYSEBERICHT','report.waiting':'Warte auf eine E-Mail','report.copy':'Bericht kopieren','report.export':'JSON exportieren','report.another':'Andere analysieren ↗','report.sections':'Berichtsbereiche','report.overview':'Übersicht','report.findings':'Befunde','report.headers':'Header','report.links':'Links','report.attachments':'Anhänge','report.raw':'Rohdetails','report.suspicious':'Wahrscheinlich verdächtig','report.clean':'Keine offensichtlichen Warnsignale','report.summary':'{file} · {date} · {summary}','report.source':'QUELLVOLLSTÄNDIGKEIT','report.full':'Originalnachricht mit Headern und MIME-Quelle wurde lokal analysiert.','report.limitedHeaders':'Header waren verfügbar; Inhalt, Links und Anhänge wurden nicht ausgewertet.','report.limitedBody':'Nur der Nachrichtentext war verfügbar; Absender, Authentifizierung, Routing und Anhänge wurden nicht ausgewertet.','report.privacyTitle':'Deine E-Mail bleibt hier.','report.privacyText':'Originalmail, Inhalt und Anhänge wurden nicht hochgeladen. Externe Anfragen: 0.','report.local':'NUR LOKAL','report.power':'Power-User-Ansicht · ','report.normalized':'normalisierte Nachrichtenmetadaten','report.extracted':'extrahierte URLs und Domains','report.metadata':'nur Metadaten','report.routing':'Routing- und Regelmetadaten','report.noUrls':'Keine URLs extrahiert.','report.noAttachments':'Keine Anhang-Metadaten gefunden.','report.noHeaders':'Keine passenden Header gefunden.','report.noRules':'Keine Regel traf auf diese Nachricht zu. Das ist keine Sicherheitsgarantie.','report.finding':'Befund','report.findingsPlural':'Befunde','report.categories':'Kategorien','report.linksFound':'gefundene Links',
      'error.oversized':'Diese Datei ist größer als 10 MB. Nichts wurde gelesen oder hochgeladen.','error.msg':'Outlook-.msg wird noch nicht unterstützt. Exportiere die Nachricht als .eml oder füge ihre Originalquelle ein. Es wurde nichts hochgeladen.','error.unsupported':'Nicht unterstützte Datei. Wähle einen .eml-E-Mail-Export. Nichts wurde gelesen oder hochgeladen.','error.read':'Die Datei konnte nicht gelesen werden. Sie blieb lokal und wurde nicht hochgeladen.','error.invalid':'Das sieht nicht nach einer gültigen E-Mail-Quelle aus. Sie blieb lokal und wurde nicht hochgeladen.','error.failed':'Die Analyse ist sicher fehlgeschlagen: {error}','error.emptyPaste':'Füge zuerst etwas Nachrichtenmaterial ein.','error.tryAgain':'Andere .eml-Datei versuchen',
      'finding.identity.title':'Absender-/Reply-To-Abweichung','finding.identity.explanation':'Der angezeigte Absender und das Ziel für Antworten sind unterschiedliche Identitäten. Das kann legitim sein, ist aber ein häufiges Phishing-Signal.','finding.authSpf.title':'SPF fehlt oder ist nicht eindeutig','finding.authSpf.explanation':'Die Nachricht enthält kein bestandenes SPF-Ergebnis, das den sendenden Server mit der Absender-Domain verknüpft.','finding.authDkim.title':'DKIM fehlt oder ist fehlgeschlagen','finding.authDkim.explanation':'Die Nachricht hat keine verlässliche kryptografische Signatur, die ihre Absender-Domain bestätigt.','finding.finance.title':'Unaufgeforderte Finanz- oder Spenden-Erzählung','finding.finance.explanation':'Die Nachricht verspricht unerwartet Geld, eine Spende, Erbschaft oder einen wohltätigen Transfer.','finding.urgency.title':'Druck zu schneller Antwort','finding.urgency.explanation':'Zeitdruck verringert die Möglichkeit, eine ungewöhnliche Anfrage unabhängig zu prüfen.','finding.external.title':'Aufforderung zur externen Fortsetzung','finding.external.explanation':'Die Nachricht bittet dich im Zusammenhang mit einem finanziellen Angebot um Antwort oder Kontaktaufnahme.','finding.links.title':'Links gefunden','finding.links.explanation':'Links sind nicht automatisch unsicher, sollten aber vor dem Öffnen geprüft werden.','finding.attachments.title':'Anhang-Metadaten gefunden','finding.attachments.explanation':'Anhänge werden als undurchsichtige Bytes behandelt. TRUSTMEBRO führt sie nicht aus und lädt sie nicht hoch.','evidence.show':'Beleg anzeigen','evidence.observed':'BEOBACHTET','evidence.rule':'REGEL','evidence.source':'QUELLE','technical.copy':'kopieren'
    }
  };

  const t = (key, vars = {}) => { const value = translations[state.locale]?.[key] ?? translations.en[key]; if (value === undefined) { if (typeof console !== 'undefined') console.warn(`Missing translation: ${key}`); return `⟦${key}⟧`; } return value.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? ''); };

  function init() {
    const zone = $('#dropzone');
    const input = $('#fileInput');
    if (!zone || !input) return;

    initLocale();
    initTheme();
    initImportUI();
    zone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
    });
    zone.addEventListener('dragover', (event) => {
      event.preventDefault(); zone.classList.add('drag'); setState(t('status.drag'), 'drag');
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

  function initLocale() {
    const saved = localStorage.getItem('trustmebro-locale');
    const browser = navigator.languages?.[0] || navigator.language || '';
    setLocale(saved || (/^de(?:-|$)/i.test(browser) ? 'de' : 'en'), false);
    const tools = $('.nav-tools');
    if (tools && !$('#language')) { const control = document.createElement('div'); control.id = 'language'; control.className = 'language'; control.setAttribute('aria-label', t('nav.language')); control.innerHTML = '<button data-locale="de">DE</button><button data-locale="en">EN</button>'; tools.prepend(control); control.querySelectorAll('[data-locale]').forEach((button) => button.addEventListener('click', () => { localStorage.setItem('trustmebro-locale', button.dataset.locale); setLocale(button.dataset.locale); })); }
  }

  function setLocale(locale, persist = true) {
    state.locale = translations[locale] ? locale : 'en';
    if (persist) localStorage.setItem('trustmebro-locale', state.locale);
    root.lang = state.locale;
    localizeStatic();
    document.querySelectorAll('[data-locale]').forEach((button) => { button.setAttribute('aria-pressed', String(button.dataset.locale === state.locale)); });
    $('#importChoices')?.remove();
    initImportUI();
    if (state.report) render(state.report);
    if (state.helpOpen) showHelp(state.guideClient);
  }

  function localizeStatic() {
    const text = { '.status':'nav.local','.theme [data-theme-choice="system"]':'nav.system','.theme [data-theme-choice="light"]':'nav.light','.theme [data-theme-choice="dark"]':'nav.dark','.eyebrow':'hero.eyebrow','.hero h1':'hero.title','.lede':'hero.lede','#dropTitle':'drop.title','.drop span:not(.drop-icon)':'drop.choose','.drop small':'drop.limit','#demoButton':'demo.button','.demo-row span':'privacy.local','.how h2':'how.title','.steps > div:nth-child(1) strong':'how.parse','.steps > div:nth-child(1) p':'how.parseText','.steps > div:nth-child(2) strong':'how.rules','.steps > div:nth-child(2) p':'how.rulesText','.steps > div:nth-child(3) strong':'how.explain','.steps > div:nth-child(3) p':'how.explainText','.principles h2':'promise.title','.principles p':'promise.text','.report-head .section-no':'report.label','#verdict':'report.waiting','#copyButton':'report.copy','#exportButton':'report.export','#resetButton':'report.another','.report-nav a:nth-child(1)':'report.overview','.report-nav a:nth-child(2)':'report.findings','.report-nav a:nth-child(3)':'report.headers','.report-nav a:nth-child(4)':'report.links','.report-nav a:nth-child(5)':'report.attachments','.report-nav a:nth-child(6)':'report.raw','.completeness .section-no':'report.source','.privacy-card strong':'report.privacyTitle','.privacy-card p':'report.privacyText','.local-badge':'report.local','.section-heading h3':'report.findings','.forensic-view:nth-child(1) summary span':'report.headers','.forensic-view:nth-child(2) summary span':'report.links','.forensic-view:nth-child(3) summary span':'report.attachments','.forensic-view:nth-child(4) summary span':'report.raw','footer span:nth-child(2)':'footer.open','footer span:nth-child(3)':'footer.joke'};
    Object.entries(text).forEach(([selector, key]) => { const element = $(selector); if (element) element.textContent = t(key); });
    const brand = $('.brand'); if (brand) { brand.setAttribute('aria-label', t('nav.home')); brand.innerHTML = '<img class="mark" src="assets/brand-mark.svg" alt="" aria-hidden="true"> TRUSTMEBRO'; }
    const status = $('.status'); if (status) status.innerHTML = `<i></i>${t('nav.local')}`;
    const theme = $('.theme'); if (theme) theme.setAttribute('aria-label', t('nav.appearance'));
    const forensic = [...document.querySelectorAll('.forensic-view small')];
    ['report.normalized','report.extracted','report.metadata','report.routing'].forEach((key, index) => { if (forensic[index]) forensic[index].textContent = `${t('report.power')}${t(key)}`; });
    const heroTitle = $('.hero h1'); if (heroTitle) heroTitle.innerHTML = `${esc(t('hero.title'))}<br><em>${esc(t('hero.titleAccent'))}</em>`;
    const nav = $('.report-nav'); if (nav) nav.setAttribute('aria-label', t('report.sections'));
    const description = document.querySelector('meta[name="description"]'); if (description) description.content = state.locale === 'de' ? 'TRUSTMEBRO — lokale Analyse verdächtiger E-Mails.' : 'TRUSTMEBRO — local-first scam and phishing analysis.';
    document.title = `TRUSTMEBRO — ${t('hero.title')} ${t('hero.titleAccent')}`;
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
    if (file.size > MAX_FILE_SIZE) return fail(t('error.oversized'));
    if (/\.msg$/i.test(file.name)) return fail(t('error.msg'));
    if (!/\.eml$/i.test(file.name) && !/message\/rfc822|text\/plain/i.test(file.type)) return fail(t('error.unsupported'));
    state.importMode = 'file';
    state.inputMode = 'full';
    setState(t('status.reading'), 'busy');
    file.text().then((text) => analyze(file.name, text)).catch(() => fail(t('error.read')));
  }

  async function analyze(filename, text) {
    try {
      setState(t('status.parsing'), 'busy');
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (!text || (state.inputMode !== 'body' && !/^\s*[\w-]+:/m.test(text))) return fail(t('error.invalid'));
      const parsed = parse(text);
      const report = { schema: 'trustmebro.report/v0.1', analyzer: 'TRUSTMEBRO local analyzer', ruleVersion: '1', analyzedAt: new Date().toISOString(), filename, privacy: { rawEmailUploaded: false, messageUploaded: false, attachmentsUploaded: false, externalRequests: 0 }, metadata: { date: parsed.headers.date || null, subject: parsed.headers.subject || null }, headers: parsed.headers, received: parsed.received, urls: parsed.urls, attachments: parsed.attachments, findings: rules(text, parsed) };
      report.source = sourceProfile(state.inputMode || 'full');
      state.report = report; render(report); setState(t('status.complete'), 'success');
    } catch (error) { fail(t('error.failed', { error: error.message })); }
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
    const add = (id, title, why, evidence, category) => findings.push({ id, evidence, category: category.toLowerCase(), version: '1' });
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
    $('#verdict').textContent = report.findings.length ? t('report.suspicious') : t('report.clean');
    const date = new Date(report.analyzedAt).toLocaleString(state.locale === 'de' ? 'de-DE' : 'en-US');
    const summary = state.locale === 'de' ? `${report.findings.length} ${report.findings.length === 1 ? 'erklärbarer Befund' : 'erklärbare Befunde'}` : `${report.findings.length} explainable ${report.findings.length === 1 ? 'finding' : 'findings'}`;
    $('#summary').textContent = t('report.summary', { file: report.filename, date, summary });
    const completeness = $('.completeness'); if (completeness && report.source) { completeness.querySelector('strong').textContent = report.source.level; completeness.querySelector('span:last-child').textContent = report.source.level === 'FULL' ? t('report.full') : report.source.explanation.includes('body') ? t('report.limitedBody') : t('report.limitedHeaders'); }
    $('#stats').innerHTML = [[t('report.findings'), report.findings.length], [t('report.categories'), categories.size], [t('report.linksFound'), report.urls.length], [t('report.attachments'), report.attachments.length]].map(([label, value]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`).join('');
    const groups = {}; report.findings.forEach((finding) => (groups[finding.category] ??= []).push(finding));
    $('#findingGroups').innerHTML = Object.keys(groups).length ? Object.entries(groups).map(([category, findings]) => `<div class="finding-group"><div class="group-title">${categoryLabel(category)} · ${findings.length}</div>${findings.map(findingHtml).join('')}</div>`).join('') : `<p>${t('report.noRules')}</p>`;
    $('#headerDetails').innerHTML = rows(Object.entries(report.headers).filter(([key]) => ['from', 'to', 'reply-to', 'return-path', 'subject', 'date', 'message-id', 'authentication-results'].includes(key)));
    $('#linkDetails').innerHTML = report.urls.length ? report.urls.map(copyRow).join('') : `<span>${t('report.noUrls')}</span>`;
    $('#attachmentDetails').innerHTML = report.attachments.length ? report.attachments.map((item) => `<div class="tech-row"><span>${esc(item.name)}</span><span>${t('report.metadata')}</span></div>`).join('') : `<span>${t('report.noAttachments')}</span>`;
    $('#rawDetails').innerHTML = rows([[state.locale === 'de' ? 'Received-Hops' : 'received hops', report.received.length], ['rule IDs', report.findings.map((finding) => finding.id).join(', ') || 'none'], ['analyzer', report.analyzer], [state.locale === 'de' ? 'externe Anfragen' : 'external requests', 0]]);
  }

  function categoryLabel(category) { return ({ identity: state.locale === 'de' ? 'Identität' : 'Identity', authentication: state.locale === 'de' ? 'Authentifizierung' : 'Authentication', content: state.locale === 'de' ? 'Inhalt' : 'Content', links: state.locale === 'de' ? 'Links' : 'Links', attachments: state.locale === 'de' ? 'Anhänge' : 'Attachments', infrastructure: state.locale === 'de' ? 'Infrastruktur' : 'Infrastructure' }[category] || category); }

  function findingHtml(finding) { const key = { 'identity.from_replyto_mismatch':'identity', 'auth.spf_missing':'authSpf', 'auth.dkim_fail':'authDkim', 'content.unsolicited_financial_offer':'finance', 'content.urgency':'urgency', 'content.external_reply_request':'external', 'links.link_present':'links', 'attachments.metadata':'attachments' }[finding.id] || finding.id; return `<article class="finding"><div class="finding-top"><h4>${esc(t(`finding.${key}.title`))}</h4><span class="tag">${esc(finding.id)}@${finding.version}</span></div><p>${esc(t(`finding.${key}.explanation`))}</p><details><summary>${t('evidence.show')}</summary><pre class="evidence">${esc(finding.evidence)}</pre></details></article>`; }
  function rows(items) { return items.length ? items.map(([key, value]) => `<div class="tech-row"><b>${esc(key)}</b><span class="copyable"><span>${esc(value || '—')}</span>${value ? `<button class="copy-btn" data-copy="${esc(value)}">${t('technical.copy')}</button>` : ''}</span></div>`).join('') : `<span>${t('report.noHeaders')}</span>`; }
  function copyRow(value) { return `<div class="tech-row"><span class="copyable"><span>${esc(value)}</span><button class="copy-btn" data-copy="${esc(value)}">${t('technical.copy')}</button></span></div>`; }
  function handleCopyClick(event) { const button = event.target.closest('[data-copy]'); if (button) copyText(button.dataset.copy); }
  function copyText(value) { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(value); else { const area = document.createElement('textarea'); area.value = value; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); } toast(t('status.copied')); }
  function copyReport() { if (state.report) copyText(JSON.stringify(state.report, null, 2)); }
  function exportReport() { if (!state.report) return; const blob = new Blob([JSON.stringify(state.report, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'trustmebro-report.json'; link.click(); URL.revokeObjectURL(link.href); toast(t('status.exported')); }
  function handleShortcut(event) { if (event.target.matches('input, textarea, select, [contenteditable]') || event.ctrlKey || event.metaKey || event.altKey) return; if (event.key.toLowerCase() === 'o') { event.preventDefault(); $('#fileInput')?.click(); } if (event.key.toLowerCase() === 'n') $('#resetButton')?.click(); if (event.key === 'Escape') window.scrollTo({ top: 0 }); if (event.key.toLowerCase() === 'c') copyReport(); if (event.key.toLowerCase() === 'e') exportReport(); }
  function openReportView() { const target = location.hash ? document.querySelector(location.hash) : null; if (target?.tagName === 'DETAILS') target.open = true; }
  function sourceProfile(mode) { const profiles = { full: { level: 'FULL', explanation: 'Original message with headers and MIME source was analyzed locally.', capabilities: { headers: true, authentication: true, routing: true, body: true, urls: true, attachments: true, mime: true } }, source: { level: 'FULL', explanation: 'Original message/source was analyzed locally.', capabilities: { headers: true, authentication: true, routing: true, body: true, urls: true, attachments: true, mime: true } }, headers: { level: 'LIMITED', explanation: 'Headers were available; body, links and attachments were not evaluated.', capabilities: { headers: true, authentication: true, routing: true, body: false, urls: false, attachments: false, mime: false } }, body: { level: 'LIMITED', explanation: 'Only message text was available; sender, authentication, routing and attachments were not evaluated.', capabilities: { headers: false, authentication: false, routing: false, body: true, urls: true, attachments: false, mime: false } } }; return profiles[mode] || profiles.full; }
  function toast(message) { const element = $('#toast'); if (!element) return; element.textContent = message; element.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => element.classList.remove('show'), 1600); }
  function setState(message, kind = '') { const element = $('#state'); if (element) { element.textContent = message; element.dataset.kind = kind; } }
  function fail(message) { setState(message, 'error'); const title = $('#dropTitle'); if (title) title.textContent = t('error.tryAgain'); }
  function demoText() { return `From: Mrs. Elizabeth A. Johnson <deh@dehglobal.com>\nTo: you@example.com\nReply-To: elizabethjohnson059@gmail.com\nReturn-Path: <bounce@mailer.example.net>\nSubject: Urgent charity donation opportunity\nDate: Sat, 20 Sep 2026 15:42:00 +0000\nReceived: from mail.example.net (203.0.113.42)\nAuthentication-Results: mx; dkim=none; spf=none; dmarc=none\nContent-Type: text/plain\n\nI am a 78-year-old widow and wish to donate $5.6 million. Please reply immediately to arrange this charitable transfer.`; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
  function initImportUI() {
    const drop = $('#dropzone'); if (!drop || $('#importChoices')) return;
    $('#fileInput').setAttribute('accept', '.eml,.msg,message/rfc822,text/plain');
    const panel = document.createElement('div'); panel.id = 'importChoices'; panel.className = 'import-choices';
    panel.innerHTML = `<span class="section-no">${t('import.label')}</span><strong>${t('import.heading')}</strong><div class="import-buttons" role="tablist" aria-label="${t('import.heading')}"><button role="tab" aria-selected="false" data-import="file">${t('import.file')}</button><button role="tab" aria-selected="false" data-import="source">${t('import.source')}</button><button role="tab" aria-selected="false" data-import="headers">${t('import.headers')}</button><button role="tab" aria-selected="false" data-import="body">${t('import.body')}</button><button id="helpButton" type="button">${t('import.help')}</button></div><p class="import-hint">${t('import.hint')}</p><div class="paste-box hidden" id="pasteBox"><label for="pasteInput" id="pasteLabel">${t('paste.source')}</label><textarea id="pasteInput" rows="7" spellcheck="false" placeholder="${t('paste.placeholder')}"></textarea><div><button class="button" id="pasteAnalyze">${t('paste.analyze')}</button><button class="text-button" id="pasteCancel">${t('common.cancel')}</button></div></div><div class="help-box hidden" id="helpBox"><div class="help-heading"><strong>${t('help.title')}</strong><button class="text-button" id="helpCancel" type="button">${t('help.close')}</button></div><div class="guide-tabs" role="tablist" aria-label="${t('help.title')}"><button role="tab" aria-selected="false" data-guide="gmail">Gmail</button><button role="tab" aria-selected="false" data-guide="outlook">Outlook</button><button role="tab" aria-selected="false" data-guide="thunderbird">Thunderbird</button><button role="tab" aria-selected="false" data-guide="apple">Apple Mail</button><button role="tab" aria-selected="false" data-guide="other">Other</button></div><div id="guideText"></div></div>`;
    drop.after(panel); const file = $('#fileInput');
    const setActive = (selector, value, stateKey) => { state[stateKey] = value; panel.querySelectorAll(selector).forEach((button) => { const selected = state[stateKey] === (button.dataset.import || button.dataset.guide); button.setAttribute('aria-selected', String(selected)); button.classList.toggle('is-selected', selected); if (button.getAttribute('role') === 'tab') button.tabIndex = selected ? 0 : -1; }); };
    setActive('[data-import]', 'file', 'importMode');
    setActive('[data-guide]', 'gmail', 'guideClient');
    panel.querySelectorAll('[data-import]').forEach((button) => button.addEventListener('click', () => { const mode = button.dataset.import; if (mode === 'file') { setActive('[data-import]', 'file', 'importMode'); hidePanels(); file.click(); } else showPaste(mode); }));
    panel.querySelector('#helpButton').onclick = () => showHelp(state.guideClient);
    panel.querySelector('#helpCancel').onclick = hideHelp;
    panel.querySelector('#pasteCancel').onclick = () => $('#pasteBox').classList.add('hidden'); panel.querySelector('#pasteAnalyze').onclick = () => { const text = $('#pasteInput').value; const mode = panel.dataset.mode; if (!text.trim()) return setState(t('error.emptyPaste'), 'error'); state.inputMode = mode; analyze(`pasted-${mode}.txt`, text); };
    panel.querySelectorAll('[data-guide]').forEach((button) => button.onclick = () => showHelp(button.dataset.guide));
    function showPaste(mode) { panel.dataset.mode = mode; setActive('[data-import]', mode, 'importMode'); hideHelp(); $('#pasteBox').classList.remove('hidden'); $('#pasteLabel').textContent = mode === 'headers' ? 'Paste message headers' : mode === 'body' ? 'Paste email text/body' : 'Paste the complete original message/source'; $('#pasteInput').focus(); }
    function showHelp(client) { state.helpOpen = true; setActive('[data-guide]', client, 'guideClient'); $('#pasteBox').classList.add('hidden'); $('#helpBox').classList.remove('hidden'); const guides = { gmail:['guide.gmail.1','guide.gmail.2'], outlook:['guide.outlook.1','guide.outlook.2'], thunderbird:['guide.thunderbird.1','guide.thunderbird.2'], apple:['guide.apple.1','guide.apple.2'], other:['guide.other.1','guide.other.2'] }; $('#guideText').innerHTML = `<ol>${guides[client].map((key) => `<li>${esc(t(key))}</li>`).join('')}</ol><p class="muted">${t('help.recommended')}</p>`; }
    function hideHelp() { state.helpOpen = false; $('#helpBox').classList.add('hidden'); }
    function hidePanels() { hideHelp(); $('#pasteBox').classList.add('hidden'); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
