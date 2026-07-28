import { createServer } from 'vite';
import { JSDOM } from 'jsdom';

// Minimal DOM shims so antd/module-load code doesn't explode on import.
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.localStorage = dom.window.localStorage;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  console.log('--- importing Profile page module ---');
  const mod = await server.ssrLoadModule('/src/pages/Profile.tsx');
  console.log('Profile module loaded OK. exports:', Object.keys(mod));
} catch (e) {
  console.log('!!! Profile module import FAILED:');
  console.log(e && e.stack ? e.stack : e);
}

await server.close();
