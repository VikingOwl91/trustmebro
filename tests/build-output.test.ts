import { afterEach, expect, test } from 'bun:test';
import { bootApplication, closeAllWindows, waitForAnalysis } from './helpers/dom';

afterEach(closeAllWindows);

test('runs the production bundle locally and includes no remote fonts', async () => {
  const output = await Bun.file('dist/index.html').text();
  expect(output).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/i);
  const cssPath = output.match(/href="([^"]+\.css)"/)?.[1];
  const scriptPath = output.match(/src="([^"]+\.js)"/)?.[1];
  expect(cssPath).toBeTruthy();
  expect(scriptPath).toBeTruthy();
  const css = await Bun.file(`dist/${cssPath}`).text();
  expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/i);
  expect(css).toMatch(/data:font\/woff2/);

  const html = output.replace(/<script\b[^>]*>[^<]*<\/script>/gi, '');
  const bundle = await Bun.file(`dist/${scriptPath}`).text();
  const harness = bootApplication({ html, bundle });
  const { window } = harness;
  const done = waitForAnalysis(window);
  window.document.querySelector<HTMLButtonElement>('#demoButton')?.click();
  await done;
  expect(window.document.querySelector('#report')?.classList.contains('hidden')).toBe(false);
  expect(window.document.documentElement.lang).toBe('en');
  expect(window.document.documentElement.innerHTML).not.toMatch(
    /fonts\.googleapis\.com|fonts\.gstatic\.com/i,
  );
});
