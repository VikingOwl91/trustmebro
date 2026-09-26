import { afterEach, describe, expect, test } from 'bun:test';
import {
  bootApplication,
  closeAllWindows,
  createEmailFile,
  setFileInput,
  waitForAnalysis,
} from './helpers/dom';

afterEach(closeAllWindows);

describe('accessible input controls and untrusted email boundaries', () => {
  test('uses labelled, keyboard-focusable native controls and moves focus predictably', () => {
    const { window } = bootApplication({ language: 'de-DE' });
    const fileInput = window.document.querySelector<HTMLInputElement>('#fileInput')!;
    const dropLabel = window.document.querySelector<HTMLLabelElement>('#dropzone')!;
    expect(dropLabel.control).toBe(fileInput);
    expect(fileInput.tabIndex).toBe(0);

    const group = window.document.querySelector('[data-import="file"]')?.parentElement;
    expect(group?.getAttribute('role')).toBe('group');
    const modeButtons = [...window.document.querySelectorAll<HTMLButtonElement>('[data-import]')];
    expect(modeButtons.every((button) => button.tagName === 'BUTTON' && button.tabIndex >= 0)).toBe(
      true,
    );
    expect(
      modeButtons.filter((button) => button.getAttribute('aria-pressed') === 'true'),
    ).toHaveLength(1);

    window.document.querySelector<HTMLButtonElement>('[data-import="body"]')?.click();
    const pasteInput = window.document.querySelector<HTMLTextAreaElement>('#pasteInput')!;
    expect(window.document.querySelector<HTMLLabelElement>('#pasteLabel')?.control).toBe(
      pasteInput,
    );
    expect(pasteInput.getAttribute('aria-describedby')).toBe('pasteHint');
    expect(window.document.activeElement).toBe(pasteInput);
    pasteInput.value = 'stale body text';
    window.document.querySelector<HTMLButtonElement>('[data-import="source"]')?.click();
    expect(pasteInput.value).toBe('');
    expect(
      window.document
        .querySelector<HTMLButtonElement>('[data-import="source"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');

    window.document.querySelector<HTMLButtonElement>('#helpButton')?.click();
    expect(window.document.querySelector('.guide-tabs')?.getAttribute('role')).toBe('group');
    expect([...window.document.querySelectorAll('[data-guide][aria-pressed="true"]')]).toHaveLength(
      1,
    );
    expect(window.document.activeElement).toBe(
      window.document.querySelector('[data-guide="gmail"]'),
    );
    window.document.querySelector<HTMLButtonElement>('#helpCancel')?.click();
    expect(window.document.activeElement).toBe(window.document.querySelector('#helpButton'));
    const helpBox = window.document.querySelector('#helpBox')!;
    expect(helpBox.classList.contains('hidden')).toBe(true);
    expect(helpBox.contains(window.document.activeElement)).toBe(false);

    window.document.querySelector<HTMLButtonElement>('[data-locale="en"]')?.click();
    expect(window.document.documentElement.lang).toBe('en');
    expect(
      window.document
        .querySelector<HTMLButtonElement>('[data-locale="en"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  test('keeps hostile HTML inert and rejects active URL schemes without network requests', async () => {
    const { window } = bootApplication();
    const externalRequests: string[] = [];
    window.fetch = async (input) => {
      externalRequests.push(String(input));
      return new window.Response('unexpected');
    };
    const html = [
      '<script>window.emailScriptRan = true</script>',
      '<style>body { background: url(https://tracker.example/pixel) }</style>',
      '<img src="https://tracker.example/image">',
      '<a href="javascript:alert(1)">unsafe scheme</a>',
      '<a href="data:text/html,evil">data scheme</a>',
      '<a href="https://safe.example/path">visible safe link</a>',
    ].join('');
    const source = [
      'From: sender@example.test',
      'Content-Type: text/html; charset=utf-8',
      '',
      html,
    ].join('\r\n');
    const complete = waitForAnalysis(window);
    setFileInput(window, createEmailFile(window, 'hostile.eml', source));
    await complete;

    expect((window as unknown as { emailScriptRan?: boolean }).emailScriptRan).toBeUndefined();
    expect(externalRequests).toEqual([]);
    expect(window.document.querySelector('#linkDetails')?.textContent).toContain(
      'https://safe.example/path',
    );
    expect(window.document.querySelector('#linkDetails')?.textContent).not.toMatch(
      /javascript:|data:text\/html|tracker\.example/,
    );
    expect(window.document.querySelector('#report script, #report img, #report style')).toBeNull();
    expect(window.document.querySelector('#report')?.getAttribute('aria-labelledby')).toBe(
      'verdict',
    );
    expect(window.document.querySelector('#findings h3')?.textContent).toBeTruthy();
  });
});
