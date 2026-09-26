import { afterEach, describe, expect, test } from 'bun:test';
import { bootApplication, closeAllWindows, waitForAnalysis } from './helpers/dom';

afterEach(closeAllWindows);

describe('locale detection and rerendering', () => {
  test('detects supported locales, falls back to English, and respects saved choice', () => {
    expect(bootApplication({ language: 'de-DE' }).window.document.documentElement.lang).toBe('de');
    expect(bootApplication({ language: 'en-US' }).window.document.documentElement.lang).toBe('en');
    expect(bootApplication({ language: 'fr-FR' }).window.document.documentElement.lang).toBe('en');
    expect(
      bootApplication({ language: 'en-US', locale: 'de' }).window.document.documentElement.lang,
    ).toBe('de');
  });

  test('updates visible controls and report language without rerunning analysis', async () => {
    const harness = bootApplication({ language: 'de-DE' });
    const { window } = harness;
    for (const [lang, label] of [
      ['de', 'TRUSTMEBRO Startseite'],
      ['en', 'TRUSTMEBRO home'],
    ]) {
      if (window.document.documentElement.lang !== lang) {
        window.document.querySelector<HTMLButtonElement>(`[data-locale="${lang}"]`)?.click();
      }
      expect(window.document.querySelector('.brand')?.textContent.replace(/\s+/g, ' ').trim()).toBe(
        'TRUSTMEBRO',
      );
      expect(window.document.querySelector('.brand')?.getAttribute('aria-label')).toBe(label);
      expect(window.document.querySelector('.brand .mark')?.getAttribute('aria-hidden')).toBe(
        'true',
      );
    }
    expect(window.document.documentElement.lang).toBe('en');
    window.document.querySelector<HTMLButtonElement>('[data-locale="de"]')?.click();
    expect(window.document.documentElement.lang).toBe('de');
    expect(window.localStorage.getItem('trustmebro-locale')).toBe('de');
    const analysisDone = waitForAnalysis(window);
    window.document.querySelector<HTMLButtonElement>('#demoButton')?.click();
    await analysisDone;

    const ids = [...window.document.querySelectorAll('.finding .tag')].map(
      (node) => node.textContent,
    );
    const evidence = [...window.document.querySelectorAll('.evidence')].map(
      (node) => node.textContent,
    );
    const germanFinding = window.document.querySelector('.finding h4')?.textContent;
    const firstExport = harness.waitForNextExport();
    const firstRevocation = harness.waitForNextRevocation();
    window.document.querySelector<HTMLButtonElement>('#exportButton')?.click();
    const firstReport = await firstExport;
    await firstRevocation;
    window.document.querySelector<HTMLButtonElement>('[data-locale="en"]')?.click();
    expect(window.document.documentElement.lang).toBe('en');
    expect(window.document.querySelector('.finding h4')?.textContent).not.toBe(germanFinding);
    expect(
      [...window.document.querySelectorAll('.finding .tag')].map((node) => node.textContent),
    ).toEqual(ids);
    expect(
      [...window.document.querySelectorAll('.evidence')].map((node) => node.textContent),
    ).toEqual(evidence);
    expect(window.document.querySelector('#verdict')?.textContent).toBe('Likely suspicious');
    const secondExport = harness.waitForNextExport();
    const secondRevocation = harness.waitForNextRevocation();
    window.document.querySelector<HTMLButtonElement>('#exportButton')?.click();
    const secondReport = await secondExport;
    await secondRevocation;
    expect(harness.exportedReports).toHaveLength(2);
    expect(harness.createdObjectUrls).toEqual(harness.revokedObjectUrls);
    expect(firstReport).toBe(secondReport);
    const report = JSON.parse(firstReport);
    expect(report.assessment.version).toBe('2');
    expect(report.assessment.reasons.reduce((sum, reason) => sum + reason.contribution, 0)).toBe(
      report.assessment.score,
    );
    const points = new Map<string, number>();
    const caps = new Map<string, number>();
    for (const reason of report.assessment.reasons) {
      points.set(reason.category, (points.get(reason.category) || 0) + reason.contribution);
      caps.set(reason.category, reason.categoryCap);
    }
    for (const [category, score] of points) expect(score).toBeLessThanOrEqual(caps.get(category)!);
    expect(report.body.status).toBe('readable');
  });
});
