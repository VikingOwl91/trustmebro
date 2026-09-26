import { Window } from 'happy-dom';
const sourceHtml = (await Bun.file('index.html').text()).replace(
  '<script type="module" src="./app.ts"></script>',
  '',
);
const appBundle = await Bun.file('.build/app.js').text();
const activeWindows = new Set<Window>();

export interface AppHarness {
  window: Window;
  exportedReports: string[];
  copiedText: string[];
  createdObjectUrls: string[];
  revokedObjectUrls: string[];
  waitForNextExport(): Promise<string>;
  waitForNextRevocation(): Promise<string>;
  close(): void;
}

export function bootApplication(
  options: {
    html?: string;
    language?: string;
    locale?: string;
    darkPreference?: boolean;
    bundle?: string;
  } = {},
): AppHarness {
  const browser = new Window({ url: 'https://trustmebro.test/', width: 1280, height: 900 });
  activeWindows.add(browser);
  browser.document.write(options.html ?? sourceHtml);
  Object.defineProperty(browser.navigator, 'language', {
    configurable: true,
    value: options.language ?? 'en-US',
  });
  Object.defineProperty(browser.navigator, 'languages', {
    configurable: true,
    value: [options.language ?? 'en-US'],
  });
  browser.matchMedia = (query: string) => ({
    matches: query.includes('prefers-color-scheme: dark') && (options.darkPreference ?? false),
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  });
  browser.scrollTo = () => {};
  browser.HTMLElement.prototype.scrollIntoView = () => {};
  const copiedText: string[] = [];
  Object.defineProperty(browser.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (value: string) => copiedText.push(value) },
  });
  const exportedReports: string[] = [];
  const exportWaiters: Array<(text: string) => void> = [];
  const createdObjectUrls: string[] = [];
  const revokedObjectUrls: string[] = [];
  const revocationWaiters: Array<(url: string) => void> = [];
  // Happy DOM's VM creates cross-realm ArrayBuffers that its Blob constructor
  // currently stringifies. Native Blob accepts these as binary BlobParts.
  const NativeBlob = browser.Blob;
  browser.Blob = class extends NativeBlob {
    constructor(parts: BlobPart[] = [], options?: BlobPropertyBag) {
      const normalizedParts = parts.map((part) =>
        Object.prototype.toString.call(part) === '[object ArrayBuffer]'
          ? new Uint8Array(part as ArrayBuffer)
          : part,
      );
      super(normalizedParts, options);
    }
  } as typeof Blob;
  browser.URL.createObjectURL = (blob: Blob) => {
    createdObjectUrls.push('blob:test');
    if (blob.type === 'application/json')
      void blob.text().then((text) => {
        exportedReports.push(text);
        exportWaiters.shift()?.(text);
      });
    return 'blob:test';
  };
  browser.URL.revokeObjectURL = (url: string) => {
    revokedObjectUrls.push(url);
    revocationWaiters.shift()?.(url);
  };
  browser.HTMLAnchorElement.prototype.click = function () {};
  if (options.locale) browser.localStorage.setItem('trustmebro-locale', options.locale);
  browser.eval(options.bundle ?? appBundle);
  browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
  return {
    window: browser,
    exportedReports,
    copiedText,
    createdObjectUrls,
    revokedObjectUrls,
    waitForNextExport: () => new Promise((resolve) => exportWaiters.push(resolve)),
    waitForNextRevocation: () => new Promise((resolve) => revocationWaiters.push(resolve)),
    close: () => {
      activeWindows.delete(browser);
      void browser.happyDOM.abort();
    },
  };
}

export async function afterAnalysis<T>(window: Window, action: () => T): Promise<T> {
  const completed = new Promise<void>((resolve) => {
    window.document.addEventListener('trustmebro:analysis-complete', () => resolve(), {
      once: true,
    });
  });
  const result = action();
  await completed;
  return result;
}

export const waitForAnalysis = (window: Window): Promise<void> =>
  new Promise((resolve) => {
    window.document.addEventListener('trustmebro:analysis-complete', () => resolve(), {
      once: true,
    });
  });

export async function closeAllWindows(): Promise<void> {
  await Promise.all([...activeWindows].map((browser) => browser.happyDOM.abort()));
  activeWindows.clear();
}

export function createEmailFile(window: Window, name: string, text: string): File {
  return new window.File([text], name, { type: 'message/rfc822' });
}

export function setFileInput(window: Window, file: File): void {
  const input = window.document.querySelector<HTMLInputElement>('#fileInput');
  if (!input) throw new Error('file input is missing');
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}

export async function exportReport(harness: AppHarness): Promise<unknown> {
  const exported = harness.waitForNextExport();
  const revoked = harness.waitForNextRevocation();
  harness.window.document.querySelector<HTMLButtonElement>('#exportButton')?.click();
  const report = JSON.parse(await exported);
  await revoked;
  return report;
}
