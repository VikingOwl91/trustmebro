import { afterEach, describe, expect, test } from 'bun:test';
import { bootApplication, closeAllWindows } from './helpers/dom';

afterEach(closeAllWindows);

describe('import and acquisition-guide state', () => {
  for (const darkPreference of [false, true]) {
    test(`keeps selected state accessible with dark preference ${darkPreference}`, () => {
      const { window } = bootApplication({ darkPreference });
      const buttons = [...window.document.querySelectorAll<HTMLButtonElement>('[data-import]')];
      const modes = buttons.filter((button) => button.dataset.import !== 'help');
      expect(window.document.querySelector('.import-buttons')?.getAttribute('role')).toBe('group');
      expect(modes.every((button) => button.getAttribute('role') !== 'tab')).toBe(true);

      for (const mode of ['file', 'source', 'headers', 'body', 'file']) {
        window.document.querySelector<HTMLButtonElement>(`[data-import="${mode}"]`)?.click();
        const selected = modes.filter((button) => button.classList.contains('is-selected'));
        expect(selected).toHaveLength(1);
        expect(selected[0]?.dataset.import).toBe(mode);
        expect(selected[0]?.getAttribute('aria-pressed')).toBe('true');
        expect(
          modes.filter((button) => button.getAttribute('aria-pressed') === 'true'),
        ).toHaveLength(1);
        expect(window.document.querySelector('#pasteBox')?.classList.contains('hidden')).toBe(
          mode === 'file',
        );
        if (mode !== 'file') {
          expect(window.document.querySelector('#pasteLabel')?.textContent).toMatch(
            mode === 'headers' ? /headers/i : mode === 'body' ? /text\/body/i : /email source/i,
          );
        }
      }

      window.document.querySelector<HTMLButtonElement>('[data-import="headers"]')?.click();
      window.document.querySelector<HTMLButtonElement>('#helpButton')?.click();
      expect(modes.find((button) => button.classList.contains('is-selected'))?.dataset.import).toBe(
        'headers',
      );
      const guideButtons = [...window.document.querySelectorAll<HTMLButtonElement>('[data-guide]')];
      const guideText: Record<string, RegExp> = {
        gmail: /Show original/,
        outlook: /View message details/,
        thunderbird: /View Source/,
        apple: /All Headers/,
        other: /Save as \.eml/,
      };
      for (const client of ['gmail', 'outlook', 'thunderbird', 'apple', 'other', 'gmail']) {
        window.document.querySelector<HTMLButtonElement>(`[data-guide="${client}"]`)?.click();
        const selected = guideButtons.filter((button) => button.classList.contains('is-selected'));
        expect(selected).toHaveLength(1);
        expect(selected[0]?.dataset.guide).toBe(client);
        expect(selected[0]?.getAttribute('aria-pressed')).toBe('true');
        expect(
          guideButtons.filter((button) => button.getAttribute('aria-pressed') === 'true'),
        ).toHaveLength(1);
        expect(window.document.querySelector('#guideText')?.textContent).toMatch(
          guideText[client]!,
        );
      }
      window.document.querySelector<HTMLButtonElement>('#helpCancel')?.click();
      expect(modes.find((button) => button.classList.contains('is-selected'))?.dataset.import).toBe(
        'headers',
      );
    });
  }
});
