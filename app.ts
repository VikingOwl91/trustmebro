import PostalMime from 'postal-mime';
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { getDomain, parse as parseDomain } from 'tldts';
import { adaptBody, adaptDemo, adaptEmlFile, adaptHeaders, adaptRawSource } from './input-adapters';
import { InputAdapterError, type Capabilities, type NormalizedAnalysisInput } from './input-types';
import type { AnalysisReport, Assessment, AuthenticationEvidence, Finding } from './report-types';

(() => {
  'use strict';

  const $ = <T extends Element = HTMLElement>(selector: string): T =>
    document.querySelector<T>(selector)!;
  const root = document.documentElement;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const state: {
    report: AnalysisReport | null;
    toastTimer: number | null;
    importMode: 'file' | 'source' | 'headers' | 'body';
    guideClient: 'gmail' | 'outlook' | 'thunderbird' | 'apple' | 'other';
    helpOpen: boolean;
    locale: string;
    analysisId: number;
  } = {
    report: null,
    toastTimer: null,
    importMode: 'file',
    guideClient: 'gmail',
    helpOpen: false,
    locale: 'en',
    analysisId: 0,
  };

  const translations = {
    en: {
      'nav.home': 'TRUSTMEBRO home',
      'nav.local': 'LOCAL EMAIL ANALYSIS',
      'nav.appearance': 'Appearance',
      'nav.language': 'Language',
      'nav.system': 'System',
      'nav.light': 'Light',
      'nav.dark': 'Dark',
      'hero.eyebrow': 'A privacy-first email reality check',
      'hero.title': 'Is this email',
      'hero.titleAccent': 'bullshit?',
      'hero.lede':
        'Drop an .eml file. TRUSTMEBRO checks it in your browser and shows its work. Email data is not sent to an analysis service.',
      'drop.title': 'Drop your .eml here',
      'drop.choose': 'or click to choose a file',
      'drop.limit': 'Analyzed locally · max 10 MB',
      'demo.button': 'Try a safe demo email →',
      'privacy.local': 'Email analysis stays local.',
      'status.drag': 'Drop to start a local analysis.',
      'status.reading': 'Reading locally…',
      'status.parsing': 'Parsing headers and extracting indicators locally…',
      'status.complete': 'Analysis complete. Email data was not transmitted.',
      'status.copied': 'Copied locally',
      'status.copyUnavailable': 'Clipboard access is unavailable in this browser context.',
      'status.exported': 'JSON export created locally',
      'how.title': 'What happens to your email?',
      'how.parse': 'Parse locally',
      'how.parseText': 'MIME, headers, links and attachments stay on your device.',
      'how.rules': 'Apply rules',
      'how.rulesText': 'Deterministic checks connect evidence to stable rule IDs.',
      'how.explain': 'Explain findings',
      'how.explainText': 'You see what was observed, why it matters, and where it came from.',
      'promise.title': 'No trust required.',
      'promise.text':
        'Every finding answers three questions: What did we observe? Why is it suspicious? Where did that information come from?',
      'footer.open': 'Open-source analyzer · v0.1',
      'footer.joke': "Because the email certainly won't.",
      'import.label': 'IMPORT OPTIONS',
      'import.heading': 'Got a suspicious email?',
      'import.file': 'Email file',
      'import.source': 'Paste original message/source',
      'import.headers': 'Paste headers',
      'import.body': 'Paste email text',
      'import.help': 'How do I get my email?',
      'import.hint':
        'Original message/source gives the most complete analysis. Partial input is clearly marked as LIMITED.',
      'paste.source': 'Paste your email source',
      'paste.headers': 'Paste message headers',
      'paste.body': 'Paste email text/body',
      'paste.placeholder': 'Paste the original message, headers, or email text here…',
      'paste.analyze': 'Analyze pasted input',
      'common.cancel': 'Cancel',
      'help.title': 'How to get the original message',
      'help.close': 'Close',
      'help.recommended':
        'Recommended: original message/source. It preserves the most forensic evidence and stays local in TRUSTMEBRO.',
      'guide.gmail.1': 'Open the message → ⋮ More → Show original.',
      'guide.gmail.2': 'Use Download original, then import the downloaded file.',
      'guide.outlook.1': 'Open the message → ⋯ More actions → View → View message details.',
      'guide.outlook.2': 'For the strongest source, use Save as / Download as .eml when available.',
      'guide.thunderbird.1': 'Open the message → More → View Source.',
      'guide.thunderbird.2': 'Save the source or use Save As to create an .eml file.',
      'guide.apple.1': 'Open the message → View → Message → All Headers.',
      'guide.apple.2': 'For full evidence, use File → Save As → Raw Message.',
      'guide.other.1':
        'Look for “Show original”, “View source”, “Download message” or “Save as .eml”.',
      'guide.other.2': 'Forwarding is not equivalent: it can remove or alter useful headers.',
      'report.label': 'ANALYSIS REPORT',
      'report.waiting': 'Waiting for an email',
      'report.copy': 'Copy report',
      'report.export': 'Export JSON',
      'report.another': 'Analyze another ↗',
      'report.sections': 'Report sections',
      'report.overview': 'Overview',
      'report.findings': 'Findings',
      'report.headers': 'Headers',
      'report.links': 'Links',
      'report.attachments': 'Attachments',
      'report.raw': 'Raw details',
      'report.suspicious': 'Likely suspicious',
      'report.review': 'Signals to review',
      'report.observations': 'Observations to review',
      'report.clean': 'No obvious red flags',
      'report.summary': '{file} · {date} · {summary}',
      'report.source': 'SOURCE COMPLETENESS',
      'report.full':
        'Original headers and supported MIME parts were parsed locally; attachments are represented as metadata only.',
      'report.noReadableBody':
        'No readable text body was available; message content was not evaluated.',
      'report.limitedHeaders':
        'Headers were available; body, links and attachments were not evaluated.',
      'report.limitedBody':
        'Only message text was available; sender, authentication, routing and attachments were not evaluated.',
      'report.privacyTitle': 'Email analysis stays local.',
      'report.privacyText':
        'Mail data is analyzed in this browser and is not sent to an analysis service. Loading the website may make separate requests, such as for its assets.',
      'report.local': 'LOCAL ANALYSIS',
      'report.power': 'Power-user view · ',
      'report.normalized': 'normalized message metadata',
      'report.extracted': 'extracted URLs and domains',
      'report.metadata': 'metadata only',
      'report.routing': 'routing and rule metadata',
      'report.noUrls': 'No URLs extracted.',
      'report.noAttachments': 'No attachment metadata found.',
      'report.noHeaders': 'No matching headers found.',
      'report.noRules': 'No rule matched this message. That is not a guarantee of safety.',
      'report.finding': 'finding',
      'report.findingsPlural': 'findings',
      'report.categories': 'categories',
      'report.linksFound': 'links found',
      'report.urlSource': 'source',
      'report.urlKind': 'type',
      'report.urlHost': 'host',
      'report.urlDestination': 'destination',
      'report.urlTracking': 'tracking',
      'report.urlMailto': 'mailto',
      'report.authEvidence': 'authentication evidence',
      'report.spfHelo': 'SPF HELO',
      'report.spfMailFrom': 'SPF MAIL FROM',
      'report.dkim': 'DKIM',
      'report.dmarc': 'DMARC',
      'assessment.heading': 'Signal assessment',
      'assessment.method':
        'Deterministic attention indicator; not a probability of phishing, scam, or safety.',
      'assessment.score': 'Signal score',
      'assessment.raw': 'raw',
      'assessment.applied': 'counted',
      'assessment.cap': 'category cap',
      'assessment.reasons': 'Why this score',
      'assessment.noReasons': 'No weighted concern signals matched.',
      'assessment.level.limited': 'Limited signals',
      'assessment.level.moderate': 'Review recommended',
      'assessment.level.elevated': 'Elevated concern',
      'assessment.level.high': 'High concern',
      'assessment.identity': 'From / Reply-To identities differ',
      'assessment.finance': 'Commercial or financial language',
      'assessment.urgency': 'Urgency language',
      'assessment.contact': 'Reply or contact instruction',
      'assessment.spf': 'MAIL FROM SPF is missing or inconclusive',
      'assessment.dkim': 'DKIM is missing or failed',
      'assessment.tracking': 'Tracking or redirect URL',
      'assessment.links': 'External link present',
      'assessment.attachment': 'Attachment metadata present',
      'error.oversized': 'This file is larger than 10 MB. Nothing was read or uploaded.',
      'error.msg':
        'Outlook .msg is not supported yet. Export the message as .eml or paste its original source instead. Nothing was uploaded.',
      'error.unsupported':
        'Unsupported file. Choose an .eml email export. Nothing was read or uploaded.',
      'error.read': 'The file could not be read. It stayed local and was not uploaded.',
      'error.invalid':
        'This does not look like a valid email source. It stayed local and was not uploaded.',
      'error.failed': 'Analysis failed safely: {error}',
      'error.emptyPaste': 'Paste some message material first.',
      'error.tryAgain': 'Try another .eml file',
      'finding.identity.title': 'From / Reply-To mismatch',
      'finding.identity.explanation':
        'The displayed sender and requested reply destination are different identities. That can be legitimate, but it is a common phishing signal.',
      'finding.authSpf.title': 'SPF is missing or inconclusive',
      'finding.authSpf.explanation':
        'The message does not provide a passing SPF result tying the sending server to the sender domain.',
      'finding.authDkim.title': 'DKIM is missing or inconclusive',
      'finding.authDkim.explanation':
        'The available message evidence does not show a passing DKIM result for every reported signature.',
      'finding.finance.title': 'Commercial or financial offer',
      'finding.finance.explanation':
        'The message contains a commercial or financial offer that should be verified in context.',
      'finding.urgency.title': 'Pressure to respond quickly',
      'finding.urgency.explanation':
        'Urgency reduces the time available to verify an unusual request independently.',
      'finding.external.title': 'Request to continue the conversation externally',
      'finding.external.explanation':
        'The message asks you to reply or contact someone in connection with a commercial or financial proposition.',
      'finding.links.title': 'Links found',
      'finding.links.explanation':
        'Links are not automatically unsafe, but they should be inspected before opening.',
      'finding.attachments.title': 'Attachment metadata found',
      'finding.attachments.explanation':
        'Attachments are treated as opaque bytes. TRUSTMEBRO does not execute or upload them.',
      'evidence.show': 'Show evidence',
      'evidence.observed': 'OBSERVED',
      'evidence.rule': 'RULE',
      'evidence.source': 'SOURCE',
      'technical.copy': 'copy',
    },
    de: {
      'nav.home': 'TRUSTMEBRO Startseite',
      'nav.local': 'MAILANALYSE LOKAL',
      'nav.appearance': 'Darstellung',
      'nav.language': 'Sprache',
      'nav.system': 'System',
      'nav.light': 'Hell',
      'nav.dark': 'Dunkel',
      'hero.eyebrow': 'Der datensparsame Realitätscheck für E-Mails',
      'hero.title': 'Ist diese E-Mail',
      'hero.titleAccent': 'Bullshit?',
      'hero.lede':
        'Lege eine .eml-Datei ab. TRUSTMEBRO prüft sie direkt im Browser und zeigt seine Arbeit. Maildaten werden nicht an einen Analysedienst gesendet.',
      'drop.title': 'E-Mail-Datei hier ablegen',
      'drop.choose': 'oder klicken, um eine Datei auszuwählen',
      'drop.limit': 'Lokal analysiert · maximal 10 MB',
      'demo.button': 'Sichere Demo-Mail ausprobieren →',
      'privacy.local': 'Die Mailanalyse bleibt lokal.',
      'status.drag': 'Zum Starten einer lokalen Analyse ablegen.',
      'status.reading': 'Lokal wird gelesen…',
      'status.parsing': 'Header werden gelesen und Indikatoren lokal extrahiert…',
      'status.complete': 'Analyse abgeschlossen. Maildaten wurden nicht übertragen.',
      'status.copied': 'Lokal kopiert',
      'status.copyUnavailable':
        'Zwischenablagezugriff ist in diesem Browserkontext nicht verfügbar.',
      'status.exported': 'JSON-Export lokal erstellt',
      'how.title': 'Was passiert mit deiner E-Mail?',
      'how.parse': 'Lokal parsen',
      'how.parseText': 'MIME, Header, Links und Anhänge bleiben auf deinem Gerät.',
      'how.rules': 'Regeln anwenden',
      'how.rulesText': 'Deterministische Prüfungen verbinden Belege mit stabilen Regel-IDs.',
      'how.explain': 'Befunde erklären',
      'how.explainText':
        'Du siehst, was beobachtet wurde, warum es relevant ist und woher es stammt.',
      'promise.title': 'Vertrauen nicht erforderlich.',
      'promise.text':
        'Jeder Befund beantwortet drei Fragen: Was wurde beobachtet? Warum ist es verdächtig? Woher stammen die Informationen?',
      'footer.open': 'Open-source analyzer · v0.1',
      'footer.joke': 'Denn diese E-Mail wird es sicher nicht sein.',
      'import.label': 'IMPORTOPTIONEN',
      'import.heading': 'Eine verdächtige E-Mail?',
      'import.file': 'E-Mail-Datei',
      'import.source': 'Originalnachricht/Quelle einfügen',
      'import.headers': 'Header einfügen',
      'import.body': 'E-Mail-Text einfügen',
      'import.help': 'Wie bekomme ich meine E-Mail?',
      'import.hint':
        'Die Originalnachricht/Quelle ermöglicht die vollständigste Analyse. Teilaussagen werden als LIMITED markiert.',
      'paste.source': 'E-Mail-Quelle einfügen',
      'paste.headers': 'Nachrichten-Header einfügen',
      'paste.body': 'E-Mail-Text/-Inhalt einfügen',
      'paste.placeholder': 'Originalnachricht, Header oder E-Mail-Text hier einfügen…',
      'paste.analyze': 'Eingefügten Inhalt analysieren',
      'common.cancel': 'Abbrechen',
      'help.title': 'Originalnachricht erhalten',
      'help.close': 'Schließen',
      'help.recommended':
        'Empfehlung: Originalnachricht/Quelle. Sie bewahrt die meisten forensischen Informationen und bleibt in TRUSTMEBRO lokal.',
      'guide.gmail.1': 'Nachricht öffnen → ⋮ Mehr → Original anzeigen.',
      'guide.gmail.2': 'Original herunterladen und die Datei importieren.',
      'guide.outlook.1':
        'Nachricht öffnen → ⋯ Weitere Aktionen → Ansicht → Nachrichtendetails anzeigen.',
      'guide.outlook.2':
        'Für die vollständigste Quelle, sofern verfügbar, Als .eml speichern/herunterladen.',
      'guide.thunderbird.1': 'Nachricht öffnen → Mehr → Quelltext anzeigen.',
      'guide.thunderbird.2': 'Quelltext speichern oder mit „Speichern unter“ als .eml ablegen.',
      'guide.apple.1': 'Nachricht öffnen → Darstellung → Nachricht → Alle Header.',
      'guide.apple.2': 'Für vollständige Belege: Ablage → Sichern unter → Raw Message.',
      'guide.other.1':
        'Suche nach „Original anzeigen“, „Quelltext anzeigen“, „Nachricht herunterladen“ oder „Als .eml speichern“.',
      'guide.other.2':
        'Weiterleiten ist nicht gleichwertig: Dabei können wichtige Header verändert oder entfernt werden.',
      'report.label': 'ANALYSEBERICHT',
      'report.waiting': 'Warte auf eine E-Mail',
      'report.copy': 'Bericht kopieren',
      'report.export': 'JSON exportieren',
      'report.another': 'Andere analysieren ↗',
      'report.sections': 'Berichtsbereiche',
      'report.overview': 'Übersicht',
      'report.findings': 'Befunde',
      'report.headers': 'Header',
      'report.links': 'Links',
      'report.attachments': 'Anhänge',
      'report.raw': 'Rohdetails',
      'report.suspicious': 'Auffällige Signale',
      'report.review': 'Signale zur Prüfung',
      'report.observations': 'Beobachtungen zur Prüfung',
      'report.clean': 'Keine offensichtlichen Warnsignale',
      'report.summary': '{file} · {date} · {summary}',
      'report.source': 'QUELLVOLLSTÄNDIGKEIT',
      'report.full':
        'Original-Header und unterstützte MIME-Teile wurden lokal geparst; Anhänge erscheinen nur als Metadaten.',
      'report.noReadableBody':
        'Kein lesbarer Text-Body vorhanden; der Nachrichteninhalt wurde nicht ausgewertet.',
      'report.limitedHeaders':
        'Header waren verfügbar; Inhalt, Links und Anhänge wurden nicht ausgewertet.',
      'report.limitedBody':
        'Nur der Nachrichtentext war verfügbar; Absender, Authentifizierung, Routing und Anhänge wurden nicht ausgewertet.',
      'report.privacyTitle': 'Die Mailanalyse bleibt lokal.',
      'report.privacyText':
        'Maildaten werden in diesem Browser analysiert und nicht an einen Analysedienst gesendet. Beim Laden der Website können separate Anfragen entstehen, etwa für lokale Assets.',
      'report.local': 'MAILANALYSE LOKAL',
      'report.power': 'Power-User-Ansicht · ',
      'report.normalized': 'normalisierte Nachrichtenmetadaten',
      'report.extracted': 'extrahierte URLs und Domains',
      'report.metadata': 'nur Metadaten',
      'report.routing': 'Routing- und Regelmetadaten',
      'report.noUrls': 'Keine URLs extrahiert.',
      'report.noAttachments': 'Keine Anhang-Metadaten gefunden.',
      'report.noHeaders': 'Keine passenden Header gefunden.',
      'report.noRules':
        'Keine Regel traf auf diese Nachricht zu. Das ist keine Sicherheitsgarantie.',
      'report.finding': 'Befund',
      'report.findingsPlural': 'Befunde',
      'report.categories': 'Kategorien',
      'report.linksFound': 'gefundene Links',
      'report.urlSource': 'Quelle',
      'report.urlKind': 'Typ',
      'report.urlHost': 'Host',
      'report.urlDestination': 'Ziel',
      'report.urlTracking': 'Tracking',
      'report.urlMailto': 'Mailto',
      'report.authEvidence': 'Authentifizierungs-Evidence',
      'report.spfHelo': 'SPF HELO',
      'report.spfMailFrom': 'SPF MAIL FROM',
      'report.dkim': 'DKIM',
      'report.dmarc': 'DMARC',
      'assessment.heading': 'Signalbewertung',
      'assessment.method':
        'Deterministischer Auffälligkeitsindikator; keine Wahrscheinlichkeit für Phishing, Betrug oder Sicherheit.',
      'assessment.score': 'Signal-Score',
      'assessment.reasons': 'Warum dieser Score',
      'assessment.noReasons': 'Keine gewichteten Auffälligkeitssignale gefunden.',
      'assessment.level.limited': 'Wenige Signale',
      'assessment.level.moderate': 'Prüfung empfohlen',
      'assessment.level.elevated': 'Erhöhte Auffälligkeit',
      'assessment.level.high': 'Hohe Auffälligkeit',
      'assessment.identity': 'From-/Reply-To-Identitäten unterscheiden sich',
      'assessment.finance': 'Kommerzielle oder finanzielle Sprache',
      'assessment.urgency': 'Dringlichkeitsformulierung',
      'assessment.contact': 'Antwort- oder Kontaktanweisung',
      'assessment.spf': 'MAIL-FROM-SPF fehlt oder ist nicht eindeutig',
      'assessment.dkim': 'DKIM fehlt oder ist fehlgeschlagen',
      'assessment.tracking': 'Tracking- oder Redirect-URL',
      'assessment.links': 'Externer Link vorhanden',
      'assessment.attachment': 'Anhang-Metadaten vorhanden',
      'error.oversized': 'Diese Datei ist größer als 10 MB. Nichts wurde gelesen oder hochgeladen.',
      'error.msg':
        'Outlook-.msg wird noch nicht unterstützt. Exportiere die Nachricht als .eml oder füge ihre Originalquelle ein. Es wurde nichts hochgeladen.',
      'error.unsupported':
        'Nicht unterstützte Datei. Wähle einen .eml-E-Mail-Export. Nichts wurde gelesen oder hochgeladen.',
      'error.read':
        'Die Datei konnte nicht gelesen werden. Sie blieb lokal und wurde nicht hochgeladen.',
      'error.invalid':
        'Das sieht nicht nach einer gültigen E-Mail-Quelle aus. Sie blieb lokal und wurde nicht hochgeladen.',
      'error.failed': 'Die Analyse ist sicher fehlgeschlagen: {error}',
      'error.emptyPaste': 'Füge zuerst etwas Nachrichtenmaterial ein.',
      'error.tryAgain': 'Andere .eml-Datei versuchen',
      'finding.identity.title': 'Absender-/Reply-To-Abweichung',
      'finding.identity.explanation':
        'Der angezeigte Absender und das Ziel für Antworten sind unterschiedliche Identitäten. Das kann legitim sein, ist aber ein häufiges Phishing-Signal.',
      'finding.authSpf.title': 'SPF fehlt oder ist nicht eindeutig',
      'finding.authSpf.explanation':
        'Die Nachricht enthält kein bestandenes SPF-Ergebnis, das den sendenden Server mit der Absender-Domain verknüpft.',
      'finding.authDkim.title': 'DKIM fehlt oder ist nicht eindeutig',
      'finding.authDkim.explanation':
        'Die verfügbaren Belege zeigen nicht für jede gemeldete Signatur ein bestandenes DKIM-Ergebnis.',
      'finding.finance.title': 'Kommerzielles oder finanzielles Angebot',
      'finding.finance.explanation':
        'Die Nachricht enthält ein kommerzielles oder finanzielles Angebot, das im Kontext geprüft werden sollte.',
      'finding.urgency.title': 'Druck zu schneller Antwort',
      'finding.urgency.explanation':
        'Zeitdruck verringert die Möglichkeit, eine ungewöhnliche Anfrage unabhängig zu prüfen.',
      'finding.external.title': 'Aufforderung zur externen Fortsetzung',
      'finding.external.explanation':
        'Die Nachricht bittet dich im Zusammenhang mit einem kommerziellen oder finanziellen Angebot um Antwort oder Kontaktaufnahme.',
      'finding.links.title': 'Links gefunden',
      'finding.links.explanation':
        'Links sind nicht automatisch unsicher, sollten aber vor dem Öffnen geprüft werden.',
      'finding.attachments.title': 'Anhang-Metadaten gefunden',
      'finding.attachments.explanation':
        'Anhänge werden als undurchsichtige Bytes behandelt. TRUSTMEBRO führt sie nicht aus und lädt sie nicht hoch.',
      'evidence.show': 'Beleg anzeigen',
      'evidence.observed': 'BEOBACHTET',
      'evidence.rule': 'REGEL',
      'evidence.source': 'QUELLE',
      'technical.copy': 'kopieren',
    },
  };

  const legalTranslations = {
    en: {
      label: 'LEGAL',
      privacyLabel: 'PRIVACY',
      back: '← Back to TRUSTMEBRO',
      impressumTitle: 'Imprint',
      privacyTitle: 'Privacy',
      impressumIntro: 'Provider information for this site.',
      operatorHeading: 'Operator details',
      nameLabel: 'Full legal name',
      nameValue: 'Christian Nachtigall',
      addressLabel: 'Postal address',
      addressValue: 'Karwendelstr. 21, 82061 Neuried, Germany',
      contactLabel: 'Email / contact',
      contactValue: 'contact@nachtigall.dev',
      representativeLabel: 'Authorised representative',
      representativeValue: 'None',
      registerLabel: 'Register / VAT details',
      registerValue: 'None',
      disputeHeading: 'Consumer dispute resolution',
      disputeText:
        '[MANUAL REVIEW REQUIRED — confirm whether any consumer-dispute information is required for this operator and service before publication.]',
      reviewNote:
        'This notice is a structural draft and is not legal advice. Confirm the remaining legal review items before public release.',
      privacyIntro:
        'This notice describes the data processing that can be established from the current TRUSTMEBRO implementation. It separates ordinary website delivery from local email analysis.',
      controllerHeading: 'Controller',
      controllerText:
        'Christian Nachtigall, Karwendelstr. 21, 82061 Neuried, Germany · contact@nachtigall.dev',
      hostingHeading: 'Website delivery and hosting',
      hostingText:
        'To deliver this hosted website, the hosting and transport providers necessarily process technical request data such as IP address, time, requested resource, browser/user-agent and possibly referrer information. The repository does not establish the hosting provider’s legal entity, log retention periods or international-transfer arrangements; confirm these details with the operator/provider before publication.',
      analysisHeading: 'Email analysis stays in the browser',
      analysisText:
        'Selected or pasted email material is parsed and analyzed locally by JavaScript in your browser. Raw messages, headers, bodies, extracted URLs and attachments are not uploaded by the analyzer. No backend, reputation lookup, analytics, telemetry or advertising tracker is implemented. Analysis data is held in runtime memory and is not written to cookies, sessionStorage or IndexedDB.',
      requestsHeading: 'External requests',
      requestsText:
        'The analyzer makes no external request with email content. When the page loads, the browser requests the hosted site and its bundled assets; these ordinary website requests are separate from email analysis and may expose normal connection data to hosting and transport providers.',
      storageHeading: 'Local storage and preferences',
      storageText:
        'The app uses localStorage only for explicit appearance preference (trustmebro-theme) and language preference (trustmebro-locale). No cookies, sessionStorage or IndexedDB are used by the current app. These preference entries remain on the device until cleared by the user or the app; the operator should confirm their treatment under § 25 TDDDG for the final deployment and document any required consent or exception.',
      retentionHeading: 'Retention and deletion',
      retentionText:
        'TRUSTMEBRO does not retain analyzed email material on an application server because it is not uploaded. In-memory analysis state is cleared when the user resets the analysis, reloads the page or closes it. Hosting/provider access-log retention is not specified by the repository and must be confirmed separately.',
      rightsHeading: 'Your rights',
      rightsText:
        'Depending on the applicable law and circumstances, you may have rights of access, rectification, erasure, restriction, objection and complaint to a supervisory authority. [PLACEHOLDER — add the verified controller contact and competent supervisory authority information before publication.]',
      privacyReview:
        'Publication review required: confirm hosting provider, log retention, international transfers, legal bases and local-storage treatment with the operator/legal adviser. Stand: [PLACEHOLDER — date].',
    },
    de: {
      label: 'RECHTLICHES',
      privacyLabel: 'DATENSCHUTZ',
      back: '← Zurück zu TRUSTMEBRO',
      impressumTitle: 'Impressum',
      privacyTitle: 'Datenschutz',
      impressumIntro:
        'Anbieterinformationen für diese Site. Die folgenden Angaben sind bewusst als Platzhalter markiert und müssen vor der Veröffentlichung ergänzt werden.',
      operatorHeading: 'Angaben zum Betreiber',
      nameLabel: 'Vollständiger Name',
      nameValue: '[PLATZHALTER — vollständigen rechtlichen Namen des Betreibers eintragen]',
      addressLabel: 'Anschrift',
      addressValue: '[PLATZHALTER — vollständige ladungsfähige Postanschrift eintragen]',
      contactLabel: 'E-Mail / Kontakt',
      contactValue: '[PLATZHALTER — Kontakt-E-Mail-Adresse eintragen]',
      representativeLabel: 'Vertretungsberechtigte Person',
      representativeValue: '[PLATZHALTER — nur soweit anwendbar ergänzen]',
      registerLabel: 'Register / Umsatzsteuer',
      registerValue:
        '[PLATZHALTER — Registergericht, Registernummer und USt-IdNr. nur soweit anwendbar]',
      disputeHeading: 'Verbraucherstreitbeilegung',
      disputeText:
        '[MANUELLE PRÜFUNG ERFORDERLICH — vor Veröffentlichung prüfen, ob für Betreiber und Angebot Angaben zur Verbraucherstreitbeilegung erforderlich sind.]',
      reviewNote:
        'Veröffentlichungsblocker: Alle Angaben in eckigen Klammern müssen durch geprüfte Betreiberinformationen ersetzt werden. Die Struktur orientiert sich an den Informationspflichten nach § 5 DDG; sie ist keine Rechtsberatung.',
      privacyIntro:
        'Diese Datenschutzerklärung beschreibt die Datenverarbeitung, die sich aus der aktuellen TRUSTMEBRO-Implementierung nachvollziehen lässt. Sie trennt die gewöhnliche Auslieferung der Site von der lokalen E-Mail-Analyse.',
      controllerHeading: 'Verantwortlicher',
      controllerText:
        '[PLATZHALTER — dieselbe geprüfte Betreiberidentität und Kontaktmöglichkeit wie im Impressum ergänzen.]',
      hostingHeading: 'Auslieferung und Hosting',
      hostingText:
        'Für die Auslieferung dieser gehosteten Site verarbeiten Hosting- und Transportanbieter notwendigerweise technische Anfragedaten wie IP-Adresse, Zeitpunkt, angeforderte Ressource, Browser/User-Agent und möglicherweise Referrer. Das Repository belegt weder die rechtliche Identität des Hostinganbieters noch Protokollaufbewahrungsfristen oder internationale Datenübermittlungen; diese Angaben müssen vor Veröffentlichung mit Betreiber/Anbieter geklärt werden.',
      analysisHeading: 'E-Mail-Analyse bleibt im Browser',
      analysisText:
        'Ausgewählte oder eingefügte E-Mail-Daten werden durch JavaScript lokal in deinem Browser geparst und analysiert. Originalnachrichten, Header, Inhalte, extrahierte URLs und Anhänge werden durch den Analyzer nicht hochgeladen. Es gibt kein Backend, keine Reputationsabfrage, keine Analyse- oder Werbetracker und keine Telemetrie. Analysedaten liegen nur im Arbeitsspeicher und werden nicht in Cookies, sessionStorage oder IndexedDB geschrieben.',
      requestsHeading: 'Externe Anfragen',
      requestsText:
        'Der Analyzer stellt keine externe Anfrage mit E-Mail-Inhalten. Beim Laden der Seite fordert der Browser die gehostete Site und ihre gebündelten Assets an; diese gewöhnlichen Website-Anfragen sind von der E-Mail-Analyse getrennt und können Hosting- und Transportanbietern normale Verbindungsdaten übermitteln.',
      storageHeading: 'Lokaler Speicher und Einstellungen',
      storageText:
        'Die App nutzt localStorage ausschließlich für die ausdrücklich gewählte Darstellung (trustmebro-theme) und Sprache (trustmebro-locale). Die aktuelle App verwendet keine Cookies, kein sessionStorage und kein IndexedDB. Diese Einstellungen bleiben auf dem Gerät, bis der Nutzer sie löscht oder die App sie entfernt; ihre Behandlung nach § 25 TDDDG und eine etwa erforderliche Einwilligung/Ausnahme muss für die endgültige Bereitstellung geprüft und dokumentiert werden.',
      retentionHeading: 'Aufbewahrung und Löschung',
      retentionText:
        'TRUSTMEBRO bewahrt analysierte E-Mail-Daten nicht auf einem Anwendungsserver auf, weil sie nicht hochgeladen werden. Der Analysezustand im Arbeitsspeicher wird beim Zurücksetzen der Analyse, Neuladen oder Schließen der Seite gelöscht. Die Aufbewahrung von Zugriffsprotokollen beim Hosting-/Transportanbieter ist im Repository nicht festgelegt und muss separat geklärt werden.',
      rightsHeading: 'Deine Rechte',
      rightsText:
        'Je nach anwendbarem Recht und Situation bestehen möglicherweise Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Beschwerde bei einer Aufsichtsbehörde. [PLATZHALTER — geprüfte Kontaktdaten des Verantwortlichen und die zuständige Aufsichtsbehörde vor Veröffentlichung ergänzen.]',
      privacyReview:
        'Prüfung vor Veröffentlichung erforderlich: Hostinganbieter, Protokollaufbewahrung, Drittlandübermittlungen, Verantwortlicher, Rechtsgrundlagen und Behandlung des lokalen Speichers mit Betreiber/Rechtsberatung klären. Stand: [PLATZHALTER — Datum].',
    },
  };

  Object.assign(translations.en, {
    'import.fileHint':
      'Choose an .eml export. FULL analysis can inspect headers, authentication, routing, MIME, body text, URLs and attachment metadata. Outlook .msg, MBOX and provider exports are not supported.',
    'paste.local': 'Pasted content stays in this browser and is never uploaded.',
    'paste.sourceHint':
      'Paste the complete original message, including its headers and the blank line before the body. FULL analysis includes MIME, authentication, routing, body, URLs and attachment metadata.',
    'paste.headersHint':
      'Paste only the message headers. Analysis stops at the first blank line. LIMITED analysis includes headers, authentication and routing; no body, URLs, attachments or MIME body parts are analyzed.',
    'paste.bodyHint':
      'Paste only the message text. LIMITED analysis checks body text and URLs; sender, authentication, routing and attachments are unavailable. Lines such as “Subject:” remain body text.',
    'error.emptyPaste': 'Paste some message material first.',
    'error.rawSource':
      'This does not contain a complete message header block and separator. Paste the original source or choose another mode.',
    'error.headers':
      'Paste valid message headers, one per line. Body and CSS text are not accepted in this mode.',
  });
  Object.assign(translations.de, {
    'import.fileHint':
      'Wähle einen .eml-Export. FULL kann Header, Authentifizierung, Routing, MIME, Nachrichtentext, URLs und Anhang-Metadaten prüfen. Outlook-.msg, MBOX und Anbieter-Exporte werden nicht unterstützt.',
    'paste.local': 'Eingefügter Inhalt bleibt in diesem Browser und wird nie hochgeladen.',
    'paste.sourceHint':
      'Füge die vollständige Originalnachricht ein, einschließlich Header und Leerzeile vor dem Inhalt. FULL umfasst MIME, Authentifizierung, Routing, Text, URLs und Anhang-Metadaten.',
    'paste.headersHint':
      'Füge nur Nachrichten-Header ein. Die Analyse endet an der ersten Leerzeile. LIMITED umfasst Header, Authentifizierung und Routing; Inhalt, URLs, Anhänge und MIME-Teile werden nicht analysiert.',
    'paste.bodyHint':
      'Füge nur den Nachrichtentext ein. LIMITED prüft Text und URLs; Absender, Authentifizierung, Routing und Anhänge sind nicht verfügbar. Zeilen wie „Subject:“ bleiben Nachrichtentext.',
    'error.emptyPaste': 'Füge zuerst Nachrichteninhalt ein.',
    'error.rawSource':
      'Vollständiger Nachrichten-Headerblock und Trennzeile fehlen. Füge die Originalquelle ein oder wähle einen anderen Modus.',
    'error.headers':
      'Füge gültige Nachrichten-Header ein, jeweils einen pro Zeile. Inhalt und CSS werden in diesem Modus nicht akzeptiert.',
  });

  Object.assign(legalTranslations.en, {
    rightsText:
      'Depending on the applicable law and circumstances, you may have rights of access, rectification, erasure, restriction, objection and complaint to a supervisory authority. Controller contact: Christian Nachtigall, Karwendelstr. 21, 82061 Neuried, Germany · contact@nachtigall.dev',
  });
  Object.assign(legalTranslations.de, {
    nameValue: 'Christian Nachtigall',
    addressValue: 'Karwendelstr. 21, 82061 Neuried, Deutschland',
    contactValue: 'contact@nachtigall.dev',
    representativeValue: 'Keine',
    registerValue: 'Keine',
    controllerText:
      'Christian Nachtigall, Karwendelstr. 21, 82061 Neuried, Deutschland · contact@nachtigall.dev',
    rightsText:
      'Je nach anwendbarem Recht und Situation bestehen möglicherweise Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Beschwerde bei einer Aufsichtsbehörde. Kontakt zum Verantwortlichen: Christian Nachtigall, Karwendelstr. 21, 82061 Neuried, Deutschland · contact@nachtigall.dev',
  });

  const t = (key, vars = {}) => {
    const value = translations[state.locale]?.[key] ?? translations.en[key];
    if (value === undefined) {
      if (typeof console !== 'undefined') console.warn(`Missing translation: ${key}`);
      return `⟦${key}⟧`;
    }
    return value.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
  };

  function init() {
    const zone = $('#dropzone');
    const input = $<HTMLInputElement>('#fileInput');
    if (!zone || !input) return;

    initLocale();
    initTheme();
    initLegalSurface();
    initImportUI();
    zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      zone.classList.add('drag');
      setState(t('status.drag'), 'drag');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('drag');
      const file = event.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) {
        handleFile(file);
        input.value = '';
      }
    });
    $('#demoButton')?.addEventListener('click', () => {
      clearReportView();
      analyzeInput(adaptDemo(demoText()));
    });
    $('#resetButton')?.addEventListener('click', resetAnalysis);
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
    if (tools && !$('#language')) {
      const control = document.createElement('div');
      control.id = 'language';
      control.className = 'language';
      control.setAttribute('role', 'group');
      control.setAttribute('aria-label', t('nav.language'));
      control.innerHTML =
        '<button data-locale="de">DE</button><button data-locale="en">EN</button>';
      tools.prepend(control);
      control.querySelectorAll<HTMLElement>('[data-locale]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.locale === state.locale));
        button.addEventListener('click', () => {
          const locale = button.dataset.locale || 'en';
          localStorage.setItem('trustmebro-locale', locale);
          setLocale(locale);
        });
      });
    }
  }

  function setLocale(locale, persist = true) {
    state.locale = translations[locale] ? locale : 'en';
    if (persist) localStorage.setItem('trustmebro-locale', state.locale);
    root.lang = state.locale;
    localizeStatic();
    document.querySelectorAll<HTMLElement>('[data-locale]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.locale === state.locale));
    });
    $('#importChoices')?.remove();
    initImportUI();
    if (state.report) render(state.report);
    if (state.helpOpen) $('#helpButton')?.click();
  }

  function localizeStatic() {
    const text = {
      '.status': 'nav.local',
      '.theme [data-theme-choice="system"]': 'nav.system',
      '.theme [data-theme-choice="light"]': 'nav.light',
      '.theme [data-theme-choice="dark"]': 'nav.dark',
      '.eyebrow': 'hero.eyebrow',
      '.hero h1': 'hero.title',
      '.lede': 'hero.lede',
      '#dropTitle': 'drop.title',
      '.drop span:not(.drop-icon)': 'drop.choose',
      '.drop small': 'drop.limit',
      '#demoButton': 'demo.button',
      '.demo-row span': 'privacy.local',
      '.how h2': 'how.title',
      '.steps > div:nth-child(1) strong': 'how.parse',
      '.steps > div:nth-child(1) p': 'how.parseText',
      '.steps > div:nth-child(2) strong': 'how.rules',
      '.steps > div:nth-child(2) p': 'how.rulesText',
      '.steps > div:nth-child(3) strong': 'how.explain',
      '.steps > div:nth-child(3) p': 'how.explainText',
      '.principles h2': 'promise.title',
      '.principles p': 'promise.text',
      '.report-head .section-no': 'report.label',
      '#verdict': 'report.waiting',
      '#copyButton': 'report.copy',
      '#exportButton': 'report.export',
      '#resetButton': 'report.another',
      '.report-nav a:nth-child(1)': 'report.overview',
      '.report-nav a:nth-child(2)': 'report.findings',
      '.report-nav a:nth-child(3)': 'report.headers',
      '.report-nav a:nth-child(4)': 'report.links',
      '.report-nav a:nth-child(5)': 'report.attachments',
      '.report-nav a:nth-child(6)': 'report.raw',
      '.completeness .section-no': 'report.source',
      '.privacy-card strong': 'report.privacyTitle',
      '.privacy-card p': 'report.privacyText',
      '.local-badge': 'report.local',
      '.section-heading h3': 'report.findings',
      '.forensic-view:nth-child(1) summary span': 'report.headers',
      '.forensic-view:nth-child(2) summary span': 'report.links',
      '.forensic-view:nth-child(3) summary span': 'report.attachments',
      '.forensic-view:nth-child(4) summary span': 'report.raw',
      'footer span:nth-child(2)': 'footer.open',
      'footer span:nth-child(3)': 'footer.joke',
    };
    Object.entries(text).forEach(([selector, key]) => {
      const element = $(selector);
      if (element) element.textContent = t(key);
    });
    const footerOpen = $('footer span:nth-child(2)');
    if (footerOpen)
      footerOpen.innerHTML = `<a class="footer-open-link" href="https://github.com/VikingOwl91/trustmebro" target="_blank" rel="noopener noreferrer">${t('footer.open').replace(' · v0.1', '')}</a> · v0.1`;
    const brand = $('.brand');
    if (brand) brand.setAttribute('aria-label', t('nav.home'));
    const status = $('.status');
    if (status) status.innerHTML = `<i></i>${t('nav.local')}`;
    const theme = $('.theme');
    if (theme) theme.setAttribute('aria-label', t('nav.appearance'));
    const forensic = [...document.querySelectorAll<HTMLElement>('.forensic-view small')];
    ['report.normalized', 'report.extracted', 'report.metadata', 'report.routing'].forEach(
      (key, index) => {
        if (forensic[index]) forensic[index].textContent = `${t('report.power')}${t(key)}`;
      },
    );
    const heroTitle = $('.hero h1');
    if (heroTitle)
      heroTitle.innerHTML = `${esc(t('hero.title'))}<br><em>${esc(t('hero.titleAccent'))}</em>`;
    const nav = $('.report-nav');
    if (nav) nav.setAttribute('aria-label', t('report.sections'));
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description)
      description.content =
        state.locale === 'de'
          ? 'TRUSTMEBRO — lokale Analyse verdächtiger E-Mails.'
          : 'TRUSTMEBRO — local-first scam and phishing analysis.';
    document.title = `TRUSTMEBRO — ${t('hero.title')} ${t('hero.titleAccent')}`;
    localizeLegal();
    updateLegalSurface();
  }

  function initLegalSurface() {
    const footer = document.querySelector('footer');
    if (footer && !footer.querySelector('.legal-links'))
      footer.insertAdjacentHTML(
        'beforeend',
        '<span class="legal-links"><a href="#impressum" data-i18n="footer.impressum">Imprint</a><span aria-hidden="true">·</span><a href="#privacy" data-i18n="footer.privacy">Privacy</a></span>',
      );
    const main = $('#top');
    if (!main || $('#impressum')) return;
    main.insertAdjacentHTML(
      'afterend',
      '<section class="legal-page hidden" id="impressum" aria-labelledby="impressumTitle"><a class="legal-back" href="#top" data-i18n="legal.back"></a><span class="section-no" data-legal-key="label"></span><h1 id="impressumTitle" data-legal-key="impressumTitle"></h1><p class="legal-intro" data-legal-key="impressumIntro"></p><h2 data-legal-key="operatorHeading"></h2><dl class="legal-facts"><dt data-legal-key="nameLabel"></dt><dd data-legal-key="nameValue"></dd><dt data-legal-key="addressLabel"></dt><dd data-legal-key="addressValue"></dd><dt data-legal-key="contactLabel"></dt><dd data-legal-key="contactValue"></dd><dt data-legal-key="representativeLabel"></dt><dd data-legal-key="representativeValue"></dd><dt data-legal-key="registerLabel"></dt><dd data-legal-key="registerValue"></dd></dl><h2 data-legal-key="disputeHeading"></h2><p data-legal-key="disputeText"></p><p class="legal-review" data-legal-key="reviewNote"></p></section><section class="legal-page hidden" id="privacy" aria-labelledby="privacyTitle"><a class="legal-back" href="#top" data-i18n="legal.back"></a><span class="section-no" data-legal-key="privacyLabel"></span><h1 id="privacyTitle" data-legal-key="privacyTitle"></h1><p class="legal-intro" data-legal-key="privacyIntro"></p><h2 data-legal-key="controllerHeading"></h2><p data-legal-key="controllerText"></p><h2 data-legal-key="hostingHeading"></h2><p data-legal-key="hostingText"></p><h2 data-legal-key="analysisHeading"></h2><p data-legal-key="analysisText"></p><h2 data-legal-key="requestsHeading"></h2><p data-legal-key="requestsText"></p><h2 data-legal-key="storageHeading"></h2><p data-legal-key="storageText"></p><h2 data-legal-key="retentionHeading"></h2><p data-legal-key="retentionText"></p><h2 data-legal-key="rightsHeading"></h2><p data-legal-key="rightsText"></p><p class="legal-review" data-legal-key="privacyReview"></p></section>',
    );
    localizeLegal();
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.addEventListener('hashchange', updateLegalSurface);
    window.addEventListener('popstate', updateLegalSurface);
    document.addEventListener('click', (event) => {
      const link = (event.target as Element).closest('.legal-links a, .legal-back');
      if (!link) return;
      event.preventDefault();
      history.pushState({}, '', link.getAttribute('href'));
      updateLegalSurface();
    });
    updateLegalSurface();
  }

  function localizeLegal() {
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
      if (element.dataset.i18n === 'footer.impressum')
        element.textContent = state.locale === 'de' ? 'Impressum' : 'Imprint';
      if (element.dataset.i18n === 'footer.privacy')
        element.textContent = state.locale === 'de' ? 'Datenschutz' : 'Privacy';
      if (element.dataset.i18n === 'legal.back')
        element.textContent = legalTranslations[state.locale].back;
    });
    document.querySelectorAll<HTMLElement>('[data-legal-key]').forEach((element) => {
      const key = element.dataset.legalKey;
      if (key)
        element.textContent =
          legalTranslations[state.locale][key] || legalTranslations.en[key] || '';
    });
  }

  function updateLegalSurface() {
    const page = location.hash.slice(1);
    const legal = page === 'impressum' || page === 'privacy';
    $('#top')?.classList.toggle('hidden', legal);
    document
      .querySelectorAll<HTMLElement>('.legal-page')
      .forEach((element) => element.classList.toggle('hidden', element.id !== page));
    if (legal) {
      document.title = `TRUSTMEBRO — ${legalTranslations[state.locale][page === 'impressum' ? 'impressumTitle' : 'privacyTitle']}`;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } else if (page === 'top' || !page) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }

  function initTheme() {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const saved = localStorage.getItem('trustmebro-theme') || 'system';
    document.querySelectorAll<HTMLElement>('[data-theme-choice]').forEach((button) => {
      button.addEventListener('click', () => {
        const preference = button.dataset.themeChoice || 'system';
        localStorage.setItem('trustmebro-theme', preference);
        setTheme(preference);
      });
    });
    setTheme(saved);
    media?.addEventListener?.('change', () => {
      if (root.dataset.preference === 'system') setTheme('system');
    });
  }

  function setTheme(preference) {
    const dark =
      preference === 'system'
        ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
        : preference === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.preference = preference;
    document
      .querySelectorAll<HTMLElement>('[data-theme-choice]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preference)),
      );
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#0f1712' : '#f4f1e9';
  }

  function handleFile(file: File) {
    clearReportView();
    if (file.size > MAX_FILE_SIZE) return fail(t('error.oversized'));
    const analysisId = ++state.analysisId;
    state.importMode = 'file';
    setState(t('status.reading'), 'busy');
    file
      .text()
      .then((text) => {
        if (analysisId === state.analysisId) {
          try {
            analyzeInput(adaptEmlFile(text, file.name), analysisId);
          } catch (error) {
            fail(adapterErrorMessage(error));
          }
        } else {
          document.dispatchEvent(
            new CustomEvent('trustmebro:analysis-complete', {
              detail: { analysisId, cancelled: true },
            }),
          );
        }
      })
      .catch(() => {
        if (analysisId === state.analysisId) fail(t('error.read'));
      });
  }

  async function analyzeInput(input: NormalizedAnalysisInput, analysisId = ++state.analysisId) {
    try {
      setState(t('status.parsing'), 'busy');
      if (analysisId !== state.analysisId) return;
      const parsed = await parse(input);
      if (analysisId !== state.analysisId) return;
      const findings = rules(parsed.bodyText, parsed, input.capabilities);
      const report: AnalysisReport = {
        schema: 'trustmebro.report/v0.1',
        analyzer: 'TRUSTMEBRO local analyzer',
        ruleVersion: '3',
        analyzedAt: new Date().toISOString(),
        filename: input.displayName,
        privacy: {
          rawEmailUploaded: false,
          messageUploaded: false,
          attachmentsUploaded: false,
          externalRequests: 0,
        },
        metadata: { date: parsed.headers.date || null, subject: parsed.headers.subject || null },
        body: {
          status: parsed.bodyStatus,
          textEvaluated: input.capabilities.body && parsed.bodyStatus === 'readable',
        },
        headers: parsed.headers,
        received: parsed.received,
        authentication: input.capabilities.authentication ? parsed.authentication : null,
        urls: parsed.urls,
        urlDetails: parsed.urlDetails,
        attachments: parsed.attachments,
        findings,
        assessment: assess(findings, parsed),
        source: {
          level: input.level,
          explanation:
            input.level === 'FULL'
              ? t('report.full')
              : input.capabilities.body
                ? t('report.limitedBody')
                : t('report.limitedHeaders'),
          adapter: input.adapter,
          capabilities: input.capabilities,
        },
      };
      state.report = report;
      render(report);
      setState(t('status.complete'), 'success');
    } catch (error) {
      fail(t('error.failed', { error: error instanceof Error ? error.message : String(error) }));
    } finally {
      document.dispatchEvent(
        new CustomEvent('trustmebro:analysis-complete', { detail: { analysisId } }),
      );
    }
  }

  async function parse(input: NormalizedAnalysisInput) {
    const text = input.content;
    const headers: Record<string, string> = {};
    let current: string | null = null;
    let inHeaders = true;
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (inHeaders && line.trim() === '') {
        inHeaders = false;
        current = null;
        continue;
      }
      if (!inHeaders) continue;
      if (/^\s/.test(line) && current) {
        headers[current] += ` ${line.trim()}`;
        continue;
      }
      const match = line.match(/^([\w-]+):\s*(.*)$/);
      if (!match) {
        current = null;
        continue;
      }
      current = match[1].toLowerCase();
      headers[current] = headers[current] ? `${headers[current]} | ${match[2]}` : match[2];
    }
    for (const key of Object.keys(headers)) headers[key] = decodeHeaderValue(headers[key]);
    const email = await PostalMime.parse(text, {
      maxNestingDepth: 40,
      maxHeadersSize: 256 * 1024,
      maxRfc822NestingDepth: 5,
      forceRfc822Attachments: true,
      attachmentEncoding: 'arraybuffer',
    });
    const received = email.headerLines
      .filter((header) => header.key.toLowerCase() === 'received')
      .map((header) => header.line.replace(/^Received:\s*/i, '').replace(/\r?\n[ \t]+/g, ' '));
    const plainText = email.text || '';
    const htmlText = email.html || '';
    const bodyText = plainText || stripHtml(htmlText);
    const attachments = email.attachments.map((attachment, partIndex) => ({
      name: attachment.filename || attachment.contentId || `unnamed-${partIndex + 1}`,
      hash: null,
      partIndex,
    }));
    const urlDetails = extractUrlDetails(bodyText, htmlText);
    const urls = urlDetails.map((item) => item.url);
    const authHeaders = email.headerLines
      .filter((header) => header.key.toLowerCase() === 'authentication-results')
      .map((header) =>
        header.line.replace(/^Authentication-Results:\s*/i, '').replace(/\r?\n[ \t]+/g, ' '),
      );
    const visibleHeaders = input.capabilities.headers ? headers : {};
    return {
      headers: visibleHeaders,
      urls,
      urlDetails,
      received,
      attachments,
      bodyText,
      bodyStatus: bodyText.trim() ? ('readable' as const) : ('unavailable' as const),
      authentication: authEvidence(authHeaders, visibleHeaders),
    };
  }

  function decodeHeaderValue(value: string) {
    return value
      .replace(/\?=\s+(?==\?)/g, '?=')
      .replace(
        /=\?([^?]+)\?([bq])\?([^?]*)\?=/gi,
        (_: string, charset: string, encoding: string, payload: string) => {
          try {
            if (encoding.toLowerCase() === 'b') {
              const bytes = Uint8Array.from(atob(payload), (char: string) => char.charCodeAt(0));
              return new TextDecoder(charset).decode(bytes);
            }
            const bytes = Uint8Array.from(
              payload
                .replace(/_/g, ' ')
                .replace(/=([\da-f]{2})/gi, (_match: string, hex: string) =>
                  String.fromCharCode(parseInt(hex, 16)),
                ),
              (char: string) => char.charCodeAt(0),
            );
            return new TextDecoder(charset).decode(bytes);
          } catch {
            return payload;
          }
        },
      );
  }
  function stripHtml(value) {
    return value
      .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function authEvidence(authHeaders: string[], headers: Record<string, string> = {}) {
    const clauses = authHeaders.flatMap((header, headerIndex) =>
      header
        .split(';')
        .slice(1)
        .map((clause) => ({ clause, headerIndex })),
    );
    const spfResults = clauses.flatMap(({ clause, headerIndex }) => {
      const result = clause.match(
        /\bspf\s*=\s*(none|fail|softfail|pass|neutral|temperror|permerror)\b/i,
      );
      if (!result) return [];
      const scope = /\bsmtp\.mailfrom\s*=/i.test(clause)
        ? 'mailfrom'
        : /\bsmtp\.helo\s*=/i.test(clause)
          ? 'helo'
          : 'unknown';
      const domain =
        clause.match(
          scope === 'mailfrom'
            ? /\bsmtp\.mailfrom\s*=\s*([^;\s]+)/i
            : /\bsmtp\.helo\s*=\s*([^;\s]+)/i,
        )?.[1] || null;
      return [{ status: result[1].toLowerCase(), scope, domain, headerIndex }];
    });
    const dkim = clauses.flatMap(({ clause, headerIndex }) => {
      const result = clause.match(/\bdkim\s*=\s*(pass|none|fail|neutral|temperror|permerror)\b/i);
      return result
        ? [
            {
              status: result[1].toLowerCase(),
              domain: clause.match(/\bheader\.d\s*=\s*([^;\s]+)/i)?.[1] || null,
              headerIndex,
            },
          ]
        : [];
    });
    const dmarcResults = clauses.flatMap(({ clause, headerIndex }) => {
      const result = clause.match(/\bdmarc\s*=\s*(pass|none|fail|neutral|temperror|permerror)\b/i);
      return result ? [{ status: result[1].toLowerCase(), headerIndex }] : [];
    });
    const scoped = (scope) => {
      const matches = spfResults.filter((result) => result.scope === scope);
      return matches.length === 1 ? matches[0] : null;
    };
    const mailFrom = scoped('mailfrom');
    const helo = scoped('helo');
    const fromAddresses = [
      ...(headers.from || '').matchAll(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi),
    ].map((match) => normalizeDomain(match[1]));
    const fromDomain = fromAddresses.length === 1 ? fromAddresses[0] : null;
    const aligned = (domain) => {
      const candidate = normalizeDomain(domain);
      if (!fromDomain || !candidate) return null;
      const fromOrg = orgDomain(fromDomain);
      const candidateOrg = orgDomain(candidate);
      return fromOrg && candidateOrg ? fromOrg === candidateOrg : null;
    };
    return {
      spf: {
        helo: helo?.status || null,
        heloDomain: helo?.domain || null,
        mailFrom: mailFrom?.status || null,
        mailFromDomain: mailFrom?.domain || null,
        results: spfResults,
      },
      dkim,
      dmarc: dmarcResults.length === 1 ? dmarcResults[0].status : null,
      dmarcResults,
      authResults: authHeaders,
      alignment: {
        fromDomain,
        dkim: dkim.map((item) => ({ domain: item.domain, aligned: aligned(item.domain) })),
        mailFrom: { domain: mailFrom?.domain || null, aligned: aligned(mailFrom?.domain || null) },
      },
    };
  }
  function normalizeDomain(value) {
    if (!value || typeof value !== 'string') return null;
    let domain = value.trim().replace(/^<|>$/g, '').toLowerCase();
    if ((domain.match(/@/g) || []).length > 1) return null;
    if (domain.includes('@')) {
      const [local, host] = domain.split('@');
      if (!local || !host) return null;
      domain = host;
    }
    domain = domain.replace(/\.$/, '');
    if (!domain || /[^a-z0-9.-]/i.test(domain) || domain.includes('..')) return null;
    const parsed = parseDomain(domain, { detectSpecialUse: true });
    if (parsed.isIp || !parsed.hostname || parsed.hostname !== domain || !parsed.publicSuffix)
      return null;
    return domain;
  }
  function orgDomain(domain) {
    const normalized = normalizeDomain(domain);
    if (!normalized) return null;
    const options = { detectSpecialUse: true, allowPrivateDomains: true };
    const details = parseDomain(normalized, options);
    if (details.isSpecialUse || (details.isIcann !== true && details.isPrivate !== true))
      return null;
    return getDomain(normalized, options) || null;
  }
  function extractUrlDetails(value: string, html = '') {
    type UrlEvidence = {
      url: string;
      sources: string[];
      visibleTexts: string[];
      host: string | null;
      kind: 'mailto' | 'tracking' | 'destination';
    };
    const found: UrlEvidence[] = [];
    const add = (raw: string, source: string, visibleText: string | null = null) => {
      const url = (raw.startsWith('www.') ? `http://${raw}` : raw).replace(/[),.;:!?]+$/, '');
      let item = found.find((entry) => entry.url === url);
      if (!item) {
        let parsed: URL | null = null;
        try {
          parsed = new URL(url);
        } catch {}
        const host = parsed?.hostname?.toLowerCase() || null;
        item = {
          url,
          sources: [],
          visibleTexts: [],
          host,
          kind: /^mailto:/i.test(url)
            ? 'mailto'
            : /(?:awstrack\.me|sendgrid\.net|mandrillapp\.com|mailchimp\.com)/i.test(host || '') ||
                /(?:utm_|\/track|\/click|\/redirect)/i.test(url)
              ? 'tracking'
              : 'destination',
        };
        found.push(item);
      }
      if (!item.sources.includes(source)) item.sources.push(source);
      if (visibleText && !item.visibleTexts.includes(visibleText))
        item.visibleTexts.push(visibleText);
    };
    if (html) {
      // Treat message HTML as inert parser input. It is never attached to the live DOM.
      const fragment = parseFragment(html);
      type HtmlNode = DefaultTreeAdapterMap['node'];
      const children = (node: HtmlNode) => ('childNodes' in node ? node.childNodes : []);
      const tagName = (node: HtmlNode) => ('tagName' in node ? node.tagName : '');
      const textContent = (node: HtmlNode): string =>
        'value' in node
          ? node.value
          : ['script', 'style'].includes(tagName(node))
            ? ''
            : children(node).map(textContent).join(' ');
      const visit = (node: HtmlNode, blocked = false) => {
        const tag = tagName(node);
        const ignoreContent = blocked || ['script', 'style'].includes(tag);
        if ('value' in node && !ignoreContent) {
          for (const match of node.value.matchAll(/(?:https?:\/\/|www\.)[^\s<>"']+/gi))
            add(match[0], 'body');
        }
        if (tag === 'a' && 'attrs' in node) {
          const href =
            node.attrs.find((attribute) => attribute.name === 'href')?.value?.trim() || '';
          if (/^(?:https?:\/\/|mailto:|www\.)/i.test(href))
            add(href, 'html', textContent(node).replace(/\s+/g, ' ').trim() || null);
        }
        children(node).forEach((child) => visit(child, ignoreContent));
      };
      visit(fragment);
    }
    for (const match of value.matchAll(/(?:https?:\/\/|www\.)[^\s<>"']+/gi)) add(match[0], 'body');
    return found.map((item) => ({
      ...item,
      source: item.sources.join(' + '),
      visibleText: item.visibleTexts.join(' | '),
    }));
  }

  function rules(text, parsed, capabilities: Capabilities): Finding[] {
    const lower = text.toLowerCase();
    const findings: Finding[] = [];
    const add = (id, title, why, evidence, category) =>
      findings.push({ id, evidence, category: category.toLowerCase(), version: '3' });
    const address = (key) => parsed.headers[key]?.match(/<([^>]+)>/)?.[1] || parsed.headers[key];
    if (
      capabilities.headers &&
      address('from') &&
      address('reply-to') &&
      address('from') !== address('reply-to')
    )
      add(
        'identity.from_replyto_mismatch',
        'From / Reply-To mismatch',
        'The displayed sender and requested reply destination are different identities. That can be legitimate, but it is a common phishing signal.',
        `From: ${parsed.headers.from}\nReply-To: ${parsed.headers['reply-to']}`,
        'Identity',
      );
    if (capabilities.authentication) {
      const auth = parsed.headers['authentication-results'] || '';
      const mailFromSpf = parsed.authentication.spf.mailFrom;
      const heloSpf = parsed.authentication.spf.helo;
      const mailFromSpfMissing =
        !auth ||
        !mailFromSpf ||
        ['none', 'fail', 'softfail', 'neutral', 'temperror', 'permerror'].includes(mailFromSpf);
      if (mailFromSpfMissing) {
        const scope = mailFromSpf
          ? 'MAIL FROM SPF'
          : heloSpf
            ? 'MAIL FROM SPF not reported; HELO SPF was reported'
            : 'SPF scope not reported';
        add(
          'auth.spf_missing',
          'SPF is missing or inconclusive',
          'The message does not provide a passing MAIL FROM SPF result tying the sending server to the sender domain.',
          `${auth || 'No Authentication-Results header found'}\nScope: ${scope}`,
          'Authentication',
        );
      }
      if (
        !parsed.authentication.dkim.length ||
        parsed.authentication.dkim.some((result) => result.status !== 'pass')
      )
        add(
          'auth.dkim_fail',
          'DKIM is missing or inconclusive',
          'The available message evidence does not show a passing DKIM result for every reported signature.',
          auth || 'No Authentication-Results header found',
          'Authentication',
        );
    }
    if (
      capabilities.body &&
      /\$\s?[\d,.]+|million|inheritance|donat|widow|charity|verwertungs?verfahren|laufenden? bestand|katalog|(?:\d[\d.,]*)\s*(?:€|euro)|direkten? erwerb|einzelverkauf|fahrzeug|maschinen?/.test(
        lower,
      )
    )
      add(
        'content.commercial_financial_offer',
        'Commercial or financial offer',
        'The message contains a commercial or financial offer that should be verified in context.',
        snippet(
          text,
          /million|donat|inheritance|donat|verwertungs?verfahren|katalog|preis|euro|einzelverkauf|fahrzeug|maschinen?/,
        ),
        'Content',
      );
    if (capabilities.body && /urgent|immediately|as soon as possible|act now/.test(lower))
      add(
        'content.urgency',
        'Pressure to respond quickly',
        'Urgency reduces the time available to verify an unusual request independently.',
        snippet(text, /urgent|immediately|act now/),
        'Content',
      );
    if (
      capabilities.body &&
      capabilities.headers &&
      /reply|contact|respond|rückmeldung|rückfragen|bei interesse|antworten/.test(lower) &&
      /donat|million|transfer|payment|verwertungs?verfahren|katalog|verkauf|angebot|fahrzeug|maschinen?/.test(
        lower,
      )
    )
      add(
        'content.contact_or_reply_instruction',
        'Request to continue the conversation externally',
        'The message asks you to reply or contact someone in connection with a commercial or financial proposition.',
        parsed.headers['reply-to'] ||
          snippet(text, /reply|contact|respond|rückmeldung|rückfragen|bei interesse|antworten/),
        'Content',
      );
    if (capabilities.urls && parsed.urls.length)
      add(
        'links.extracted',
        'Links found',
        'Links are not automatically unsafe, but they should be inspected before opening.',
        parsed.urls.join('\n'),
        'Links',
      );
    if (capabilities.attachments && parsed.attachments.length)
      add(
        'attachments.metadata',
        'Attachment metadata found',
        'Attachments are treated as opaque bytes. TRUSTMEBRO does not execute or upload them.',
        parsed.attachments.map((a) => a.name).join('\n'),
        'Attachments',
      );
    return findings;
  }

  function assess(findings: Finding[], parsed): Assessment {
    const caps = { identity: 25, content: 25, authentication: 25, links: 20, attachments: 5 };
    const signals: Array<{ id: string; category: string; weight: number; key: string }> = [];
    const signal = (id, category, weight, key) => {
      if (!signals.some((item) => item.id === id)) signals.push({ id, category, weight, key });
    };
    findings.forEach((finding) => {
      if (finding.id === 'identity.from_replyto_mismatch')
        signal(finding.id, 'identity', 20, 'assessment.identity');
      if (finding.id === 'content.commercial_financial_offer')
        signal(finding.id, 'content', 15, 'assessment.finance');
      if (finding.id === 'content.urgency') signal(finding.id, 'content', 10, 'assessment.urgency');
      if (finding.id === 'content.contact_or_reply_instruction')
        signal(finding.id, 'content', 5, 'assessment.contact');
      if (finding.id === 'auth.spf_missing')
        signal(finding.id, 'authentication', 15, 'assessment.spf');
      if (finding.id === 'auth.dkim_fail')
        signal(finding.id, 'authentication', 10, 'assessment.dkim');
      if (finding.id === 'links.extracted') {
        const tracking = parsed.urlDetails.filter((item) => item.kind === 'tracking').length;
        if (tracking)
          signal('links.tracking', 'links', Math.min(10, tracking * 5), 'assessment.tracking');
        if (parsed.urlDetails.some((item) => item.kind === 'destination'))
          signal('links.destination', 'links', 5, 'assessment.links');
      }
      if (finding.id === 'attachments.metadata')
        signal(finding.id, 'attachments', 5, 'assessment.attachment');
    });
    const categoryTotals: Record<string, number> = {};
    let pointsLeft = 100;
    const reasons = signals.map(({ id, category, weight, key }) => {
      const categoryCap = caps[category] || 0;
      const categoryRemaining = Math.max(0, categoryCap - (categoryTotals[category] || 0));
      const contribution = Math.min(weight, categoryRemaining, pointsLeft);
      categoryTotals[category] = (categoryTotals[category] || 0) + contribution;
      pointsLeft -= contribution;
      return { id, category, rawWeight: weight, contribution, categoryCap, labelKey: key };
    });
    const score = reasons.reduce((sum, reason) => sum + reason.contribution, 0);
    const concernLevel =
      score >= 70 ? 'high' : score >= 45 ? 'elevated' : score >= 20 ? 'moderate' : 'limited';
    return {
      version: '2',
      score,
      concernLevel,
      labelKey: `assessment.level.${concernLevel}`,
      reasons,
      method: 'deterministic attention indicator; not a probability of phishing, scam, or safety',
    };
  }

  function snippet(text, expression) {
    return (
      text.match(new RegExp(`.{0,55}(${expression.source}).{0,80}`, 'i'))?.[0] || 'Pattern detected'
    );
  }

  // Dynamic templates are application-owned; all message-derived values go through esc().
  function render(report: AnalysisReport) {
    $('#report')?.classList.remove('hidden');
    $('#report')?.scrollIntoView?.({ behavior: 'smooth' });
    const categories = new Set(report.findings.map((finding) => finding.category));
    const substantiveFindings = report.findings.some(
      (finding) => !['links.extracted', 'attachments.metadata'].includes(finding.id),
    );
    $('#verdict').textContent = !report.findings.length
      ? t('report.clean')
      : !substantiveFindings
        ? t('report.observations')
        : report.assessment.score >= 20
          ? t('report.suspicious')
          : t('report.review');
    const date = new Date(report.analyzedAt).toLocaleString(
      state.locale === 'de' ? 'de-DE' : 'en-US',
    );
    const summary =
      state.locale === 'de'
        ? `${report.findings.length} ${report.findings.length === 1 ? 'erklärbarer Befund' : 'erklärbare Befunde'}`
        : `${report.findings.length} explainable ${report.findings.length === 1 ? 'finding' : 'findings'}`;
    $('#summary').textContent = t('report.summary', { file: report.filename, date, summary });
    const completeness = $('.completeness');
    if (completeness && report.source) {
      completeness.querySelector<HTMLElement>('strong')!.textContent = report.source.level;
      const sourceText =
        report.source.level === 'FULL'
          ? t('report.full')
          : report.source.capabilities.body
            ? t('report.limitedBody')
            : t('report.limitedHeaders');
      completeness.querySelector<HTMLElement>('span:last-child')!.textContent =
        report.body?.status === 'unavailable'
          ? `${sourceText} ${t('report.noReadableBody')}`
          : sourceText;
    }
    $('#stats').innerHTML = [
      [t('report.findings'), report.findings.length],
      [t('report.categories'), categories.size],
      [t('report.linksFound'), report.urls.length],
      [t('report.attachments'), report.attachments.length],
    ]
      .map(([label, value]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`)
      .join('');
    const assessment = report.assessment || {
      score: 0,
      concernLevel: 'limited',
      labelKey: 'assessment.level.limited',
      reasons: [],
    };
    let assessmentCard = $('#assessment');
    if (!assessmentCard) {
      assessmentCard = document.createElement('div');
      assessmentCard.id = 'assessment';
      assessmentCard.className = 'assessment-card hidden';
      assessmentCard.innerHTML =
        '<div class="assessment-head"><div><span class="section-no" data-i18n="assessment.heading"></span><strong data-assessment-level></strong></div><b data-assessment-score></b></div><div class="assessment-bar"><i data-assessment-bar></i></div><p data-assessment-method></p><h4 data-i18n="assessment.reasons"></h4><ul data-assessment-reasons></ul>';
      $('.privacy-card')?.after(assessmentCard);
    }
    if (assessmentCard) {
      assessmentCard.classList.remove('hidden');
      assessmentCard.querySelector<HTMLElement>('[data-assessment-score]')!.textContent =
        `${t('assessment.score')}: ${assessment.score}/100`;
      assessmentCard.querySelector<HTMLElement>('[data-assessment-level]')!.textContent = t(
        assessment.labelKey,
      );
      assessmentCard.querySelector<HTMLElement>('[data-i18n="assessment.heading"]')!.textContent =
        t('assessment.heading');
      assessmentCard.querySelector<HTMLElement>('[data-assessment-method]')!.textContent =
        t('assessment.method');
      assessmentCard.querySelector<HTMLElement>('[data-i18n="assessment.reasons"]')!.textContent =
        t('assessment.reasons');
      assessmentCard.querySelector<HTMLElement>('[data-assessment-reasons]')!.innerHTML = assessment
        .reasons.length
        ? assessment.reasons
            .map(
              (reason) =>
                `<li>${esc(t(reason.labelKey))} <span>${t('assessment.raw')} +${reason.rawWeight}; ${t('assessment.applied')} +${reason.contribution}; ${t('assessment.cap')} ${reason.categoryCap}</span></li>`,
            )
            .join('')
        : `<li>${t('assessment.noReasons')}</li>`;
      assessmentCard.querySelector<HTMLElement>('[data-assessment-bar]')!.style.width =
        `${assessment.score}%`;
    }
    const groups: Record<string, Finding[]> = {};
    report.findings.forEach((finding) => (groups[finding.category] ??= []).push(finding));
    $('#findingGroups').innerHTML = Object.keys(groups).length
      ? Object.entries(groups)
          .map(
            ([category, findings]) =>
              `<div class="finding-group"><div class="group-title">${categoryLabel(category)} · ${findings.length}</div>${findings.map(findingHtml).join('')}</div>`,
          )
          .join('')
      : `<p>${t('report.noRules')}</p>`;
    $('#headerDetails').innerHTML = rows(
      Object.entries(report.headers).filter(([key]) =>
        [
          'from',
          'to',
          'reply-to',
          'return-path',
          'subject',
          'date',
          'message-id',
          'authentication-results',
        ].includes(key),
      ),
    );
    $('#linkDetails').innerHTML = report.urlDetails?.length
      ? report.urlDetails.map(urlRow).join('')
      : report.urls.length
        ? report.urls.map(copyRow).join('')
        : `<span>${t('report.noUrls')}</span>`;
    $('#attachmentDetails').innerHTML = report.attachments.length
      ? report.attachments
          .map(
            (item) =>
              `<div class="tech-row"><span>${esc(item.name)}</span><span>${t('report.metadata')}</span></div>`,
          )
          .join('')
      : `<span>${t('report.noAttachments')}</span>`;
    $('#rawDetails').innerHTML =
      rows([
        [state.locale === 'de' ? 'Received-Hops' : 'received hops', report.received.length],
        ['rule IDs', report.findings.map((finding) => finding.id).join(', ') || 'none'],
        ['analyzer', report.analyzer],
        [
          'assessment',
          report.assessment
            ? `${report.assessment.score}/100 · ${report.assessment.concernLevel}`
            : 'none',
        ],
        [
          state.locale === 'de' ? 'externe Anfragen' : 'external requests',
          report.privacy.externalRequests,
        ],
      ]) +
      (report.authentication
        ? `<div class="tech-row"><b>${t('report.authEvidence')}</b><span> </span></div>${authenticationRows(report.authentication)}`
        : '');
  }

  function categoryLabel(category) {
    return (
      {
        identity: state.locale === 'de' ? 'Identität' : 'Identity',
        authentication: state.locale === 'de' ? 'Authentifizierung' : 'Authentication',
        content: state.locale === 'de' ? 'Inhalt' : 'Content',
        links: state.locale === 'de' ? 'Links' : 'Links',
        attachments: state.locale === 'de' ? 'Anhänge' : 'Attachments',
        infrastructure: state.locale === 'de' ? 'Infrastruktur' : 'Infrastructure',
      }[category] || category
    );
  }

  function findingHtml(finding) {
    const key =
      {
        'identity.from_replyto_mismatch': 'identity',
        'auth.spf_missing': 'authSpf',
        'auth.dkim_fail': 'authDkim',
        'content.commercial_financial_offer': 'finance',
        'content.urgency': 'urgency',
        'content.contact_or_reply_instruction': 'external',
        'links.extracted': 'links',
        'attachments.metadata': 'attachments',
      }[finding.id] || finding.id;
    return `<article class="finding"><div class="finding-top"><h4>${esc(t(`finding.${key}.title`))}</h4><span class="tag">${esc(finding.id)}@${finding.version}</span></div><p>${esc(t(`finding.${key}.explanation`))}</p><details><summary>${t('evidence.show')}</summary><pre class="evidence">${esc(finding.evidence)}</pre></details></article>`;
  }
  function rows(items: Array<[string, unknown]>) {
    return items.length
      ? items
          .map(([key, value]) => {
            const present = value !== null && value !== undefined && value !== '';
            return `<div class="tech-row"><b>${esc(key)}</b><span class="copyable"><span>${esc(present ? value : '—')}</span>${present ? `<button class="copy-btn" data-copy="${esc(value)}">${t('technical.copy')}</button>` : ''}</span></div>`;
          })
          .join('')
      : `<span>${t('report.noHeaders')}</span>`;
  }
  function copyRow(value) {
    return `<div class="tech-row"><span class="copyable"><span>${esc(value)}</span><button class="copy-btn" data-copy="${esc(value)}">${t('technical.copy')}</button></span></div>`;
  }
  function urlRow(item) {
    const kind =
      item.kind === 'tracking'
        ? t('report.urlTracking')
        : item.kind === 'mailto'
          ? t('report.urlMailto')
          : t('report.urlDestination');
    const meta = `${t('report.urlKind')}: ${kind} · ${t('report.urlSource')}: ${item.source || '—'}${item.host ? ` · ${t('report.urlHost')}: ${item.host}` : ''}${item.visibleText ? ` · visible: ${item.visibleText}` : ''}`;
    return `<div class="tech-row"><span><span class="copyable"><span>${esc(item.url)}</span><button class="copy-btn" data-copy="${esc(item.url)}">${t('technical.copy')}</button></span><small>${esc(meta)}</small></span></div>`;
  }
  function authenticationRows(authentication: AuthenticationEvidence) {
    const alignment = authentication.alignment
      ? authentication.alignment.dkim
          .map(
            (item) =>
              `${item.domain || '—'}: ${item.aligned === null ? 'unknown' : item.aligned ? 'aligned' : 'not aligned'}`,
          )
          .join(' | ')
      : null;
    const rowsData: Array<[string, unknown]> = [
      [
        t('report.spfHelo'),
        [authentication.spf?.helo, authentication.spf?.heloDomain].filter(Boolean).join(' · '),
      ],
      [
        t('report.spfMailFrom'),
        [authentication.spf?.mailFrom, authentication.spf?.mailFromDomain]
          .filter(Boolean)
          .join(' · '),
      ],
      [
        t('report.dkim'),
        authentication.dkim
          ?.map((item) => [item.status, item.domain].filter(Boolean).join(' · '))
          .join(' | '),
      ],
      [t('report.dmarc'), authentication.dmarc],
      ['From domain', authentication.alignment?.fromDomain],
      ['DKIM alignment', alignment],
      [
        'MAIL FROM alignment',
        authentication.alignment?.mailFrom?.aligned === null
          ? 'unknown'
          : authentication.alignment?.mailFrom?.aligned
            ? 'aligned'
            : 'not aligned',
      ],
    ];
    return rows(rowsData);
  }
  function handleCopyClick(event: MouseEvent) {
    const button = (event.target as Element).closest('[data-copy]') as HTMLElement | null;
    if (button) copyText(button.dataset.copy || '');
  }
  async function copyText(value: string) {
    if (!navigator.clipboard?.writeText) {
      toast(t('status.copyUnavailable'));
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast(t('status.copied'));
    } catch {
      toast(t('status.copyUnavailable'));
    }
  }
  function copyReport() {
    if (state.report) copyText(JSON.stringify(state.report, null, 2));
  }
  function exportReport() {
    if (!state.report) return;
    const blob = new Blob([JSON.stringify(state.report, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = 'trustmebro-report.json';
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    toast(t('status.exported'));
  }
  function resetAnalysis() {
    state.analysisId += 1;
    clearReportView();
    const fileInput = $<HTMLInputElement>('#fileInput');
    if (fileInput) fileInput.value = '';
    const pasteInput = $<HTMLTextAreaElement>('#pasteInput');
    if (pasteInput) pasteInput.value = '';
    $('#pasteBox')?.classList.add('hidden');
    state.importMode = 'file';
    document.querySelectorAll<HTMLElement>('[data-import]').forEach((button) => {
      const selected = button.dataset.import === 'file';
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-selected', selected);
    });
    const dropTitle = $('#dropTitle');
    if (dropTitle) dropTitle.textContent = t('drop.title');
    setState('');
    $('#home')?.scrollIntoView?.();
  }
  function clearReportView() {
    state.report = null;
    $('#report')?.classList.add('hidden');
    [
      '#stats',
      '#findingGroups',
      '#headerDetails',
      '#linkDetails',
      '#attachmentDetails',
      '#rawDetails',
      '#assessment',
    ].forEach((selector) => {
      const element = $(selector);
      if (element) element.replaceChildren();
    });
    const verdict = $('#verdict');
    if (verdict) verdict.textContent = t('report.waiting');
    const summary = $('#summary');
    if (summary) summary.textContent = '';
    const completeness = $('.completeness');
    if (completeness) {
      completeness.querySelector<HTMLElement>('strong')!.textContent = '—';
      completeness.querySelector<HTMLElement>('span:last-child')!.textContent = '';
    }
    const dropTitle = $('#dropTitle');
    if (dropTitle) dropTitle.textContent = t('drop.title');
    setState('');
  }
  function handleShortcut(event) {
    if (
      event.target.matches('input, textarea, select, [contenteditable]') ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    if (event.key.toLowerCase() === 'o') {
      event.preventDefault();
      $('#fileInput')?.click();
    }
    if (event.key.toLowerCase() === 'n') $('#resetButton')?.click();
    if (event.key === 'Escape') window.scrollTo({ top: 0 });
    if (event.key.toLowerCase() === 'c') copyReport();
    if (event.key.toLowerCase() === 'e') exportReport();
  }
  function openReportView() {
    const target = location.hash
      ? (document.querySelector(location.hash) as HTMLDetailsElement | null)
      : null;
    if (target?.tagName === 'DETAILS') target.open = true;
  }
  function adapterErrorMessage(error: unknown) {
    if (!(error instanceof InputAdapterError)) return t('error.invalid');
    if (error.code === 'empty') return t('error.emptyPaste');
    if (error.code === 'malformed-headers') return t('error.headers');
    if (error.code === 'malformed-source') return t('error.rawSource');
    if (error.code === 'unsupported-msg') return t('error.msg');
    return t('error.unsupported');
  }
  function toast(message) {
    const element = $('#toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(state.toastTimer ?? undefined);
    state.toastTimer = setTimeout(() => element.classList.remove('show'), 1600);
  }
  function setState(message, kind = '') {
    const element = $('#state');
    if (element) {
      element.textContent = message;
      element.dataset.kind = kind;
    }
  }
  function fail(message) {
    setState(message, 'error');
    const title = $('#dropTitle');
    if (title) title.textContent = t('error.tryAgain');
    document.dispatchEvent(new CustomEvent('trustmebro:analysis-complete'));
  }
  function demoText() {
    return `From: Mrs. Elizabeth A. Johnson <deh@dehglobal.com>\nTo: you@example.com\nReply-To: elizabethjohnson059@gmail.com\nReturn-Path: <bounce@mailer.example.net>\nSubject: Urgent charity donation opportunity\nDate: Sat, 20 Sep 2026 15:42:00 +0000\nReceived: from mail.example.net (203.0.113.42)\nAuthentication-Results: mx; dkim=none; spf=none; dmarc=none\nContent-Type: text/plain\n\nI am a 78-year-old widow and wish to donate $5.6 million. Please reply immediately to arrange this charitable transfer.`;
  }
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character] || character;
    });
  }
  function initImportUI() {
    const drop = $('#dropzone');
    if (!drop || $('#importChoices')) return;
    $('#fileInput').setAttribute('accept', '.eml,message/rfc822');
    const panel = document.createElement('div');
    panel.id = 'importChoices';
    panel.className = 'import-choices';
    panel.innerHTML = `<span class="section-no">${t('import.label')}</span><h3 class="import-heading">${t('import.heading')}</h3><div class="import-buttons" role="group" aria-label="${t('import.heading')}" aria-describedby="importHint"><button type="button" aria-pressed="false" data-import="file">${t('import.file')}</button><button type="button" aria-pressed="false" data-import="source">${t('import.source')}</button><button type="button" aria-pressed="false" data-import="headers">${t('import.headers')}</button><button type="button" aria-pressed="false" data-import="body">${t('import.body')}</button><button id="helpButton" type="button">${t('import.help')}</button></div><p class="import-hint" id="importHint">${t('import.fileHint')}</p><div class="paste-box hidden" id="pasteBox"><label for="pasteInput" id="pasteLabel">${t('paste.source')}</label><textarea id="pasteInput" rows="7" spellcheck="false" placeholder="${t('paste.placeholder')}" aria-describedby="pasteHint"></textarea><p class="import-hint" id="pasteHint"></p><div><button class="button" id="pasteAnalyze">${t('paste.analyze')}</button><button class="text-button" id="pasteCancel">${t('common.cancel')}</button></div></div><div class="help-box hidden" id="helpBox"><div class="help-heading"><h3>${t('help.title')}</h3><button class="text-button" id="helpCancel" type="button">${t('help.close')}</button></div><div class="guide-tabs" role="group" aria-label="${t('help.title')}"><button type="button" aria-pressed="false" data-guide="gmail">Gmail</button><button type="button" aria-pressed="false" data-guide="outlook">Outlook</button><button type="button" aria-pressed="false" data-guide="thunderbird">Thunderbird</button><button type="button" aria-pressed="false" data-guide="apple">Apple Mail</button><button type="button" aria-pressed="false" data-guide="other">Other</button></div><div id="guideText" aria-live="polite"></div></div>`;
    panel.querySelector<HTMLButtonElement>('#helpButton')?.setAttribute('aria-controls', 'helpBox');
    panel.querySelector<HTMLButtonElement>('#helpButton')?.setAttribute('aria-expanded', 'false');
    panel.querySelectorAll<HTMLButtonElement>('[data-import]').forEach((button) => {
      button.setAttribute(
        'aria-controls',
        button.dataset.import === 'file' ? 'fileInput' : 'pasteBox',
      );
      button.setAttribute('aria-expanded', 'false');
    });
    drop.after(panel);
    const file = $('#fileInput');
    const setActive = (selector, value, stateKey) => {
      state[stateKey] = value;
      panel.querySelectorAll<HTMLElement>(selector).forEach((button) => {
        const selected = state[stateKey] === (button.dataset.import || button.dataset.guide);
        button.setAttribute('aria-pressed', String(selected));
        if (button.dataset.import)
          button.setAttribute(
            'aria-expanded',
            String(selected && button.dataset.import !== 'file'),
          );
        button.classList.toggle('is-selected', selected);
      });
    };
    setActive('[data-import]', 'file', 'importMode');
    setActive('[data-guide]', 'gmail', 'guideClient');
    panel.querySelectorAll<HTMLButtonElement>('[data-import]').forEach((button) =>
      button.addEventListener('click', () => {
        const mode = button.dataset.import;
        state.analysisId += 1;
        clearReportView();
        if (mode === 'file') {
          setActive('[data-import]', 'file', 'importMode');
          $('#importHint').textContent = t('import.fileHint');
          $<HTMLTextAreaElement>('#pasteInput').value = '';
          delete panel.dataset.mode;
          hidePanels();
          file.click();
        } else showPaste(mode);
      }),
    );
    panel.querySelector<HTMLButtonElement>('#helpButton')!.onclick = () =>
      showHelp(state.guideClient);
    panel.querySelector<HTMLButtonElement>('#helpCancel')!.onclick = () => {
      hideHelp();
      panel.querySelector<HTMLButtonElement>('#helpButton')?.focus();
    };
    panel.querySelector<HTMLButtonElement>('#pasteCancel')!.onclick = () => {
      $<HTMLTextAreaElement>('#pasteInput').value = '';
      delete panel.dataset.mode;
      $('#pasteBox').classList.add('hidden');
      panel.querySelector<HTMLButtonElement>('[data-import][aria-pressed="true"]')?.focus();
    };
    panel.querySelector<HTMLButtonElement>('#pasteAnalyze')!.onclick = () => {
      const text = $<HTMLTextAreaElement>('#pasteInput').value;
      const mode = panel.dataset.mode;
      try {
        const input =
          mode === 'source'
            ? adaptRawSource(text)
            : mode === 'headers'
              ? adaptHeaders(text)
              : adaptBody(text);
        analyzeInput(input);
      } catch (error) {
        setState(adapterErrorMessage(error), 'error');
      }
    };
    panel
      .querySelectorAll<HTMLElement>('[data-guide]')
      .forEach((button) => (button.onclick = () => showHelp(button.dataset.guide || 'gmail')));
    function showPaste(mode) {
      const changed = panel.dataset.mode !== mode;
      panel.dataset.mode = mode;
      setActive('[data-import]', mode, 'importMode');
      hideHelp();
      $('#importHint').textContent = t('import.hint');
      $('#pasteBox').classList.remove('hidden');
      $('#pasteLabel').textContent = t(
        mode === 'headers' ? 'paste.headers' : mode === 'body' ? 'paste.body' : 'paste.source',
      );
      $('#pasteHint').textContent =
        `${t(mode === 'headers' ? 'paste.headersHint' : mode === 'body' ? 'paste.bodyHint' : 'paste.sourceHint')} ${t('paste.local')}`;
      if (changed) {
        $<HTMLTextAreaElement>('#pasteInput').value = '';
        setState('');
      }
      $<HTMLTextAreaElement>('#pasteInput').focus();
    }
    function showHelp(client) {
      state.helpOpen = true;
      panel.querySelector<HTMLButtonElement>('#helpButton')?.setAttribute('aria-expanded', 'true');
      setActive('[data-guide]', client, 'guideClient');
      $('#pasteBox').classList.add('hidden');
      $('#helpBox').classList.remove('hidden');
      const guides = {
        gmail: ['guide.gmail.1', 'guide.gmail.2'],
        outlook: ['guide.outlook.1', 'guide.outlook.2'],
        thunderbird: ['guide.thunderbird.1', 'guide.thunderbird.2'],
        apple: ['guide.apple.1', 'guide.apple.2'],
        other: ['guide.other.1', 'guide.other.2'],
      };
      $('#guideText').innerHTML =
        `<ol>${guides[client].map((key) => `<li>${esc(t(key))}</li>`).join('')}</ol><p class="muted">${t('help.recommended')}</p>`;
      panel.querySelector<HTMLButtonElement>('[data-guide][aria-pressed="true"]')?.focus();
    }
    function hideHelp() {
      state.helpOpen = false;
      panel.querySelector<HTMLButtonElement>('#helpButton')?.setAttribute('aria-expanded', 'false');
      $('#helpBox').classList.add('hidden');
    }
    function hidePanels() {
      hideHelp();
      $('#pasteBox').classList.add('hidden');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
