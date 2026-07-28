const noop = () => {};
const mkEl = () => ({
  appendChild: noop, removeChild: noop, setAttribute: noop, removeAttribute: noop,
  style: {}, classList: { add: noop, remove: noop, contains: () => false },
  addEventListener: noop, removeEventListener: noop, contains: () => false,
  insertBefore: noop, setAttributeNS: noop, getAttribute: () => null,
  querySelectorAll: () => [], querySelector: () => null,
  ownerDocument: null, nodeType: 1, tagName: 'DIV',
});
global.document = {
  body: mkEl(), documentElement: mkEl(), head: mkEl(),
  createElement: mkEl, createElementNS: mkEl,
  getElementById: () => mkEl(), querySelector: () => null, querySelectorAll: () => [],
  addEventListener: noop, removeEventListener: noop,
};
global.window = {
  document: global.document, navigator: { userAgent: 'node', language: 'zh' },
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
  addEventListener: noop, removeEventListener: noop,
  getComputedStyle: () => ({}), requestAnimationFrame: noop, cancelAnimationFrame: noop,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
};
global.navigator = global.window.navigator;
global.HTMLElement = function () {};
global.getComputedStyle = global.window.getComputedStyle;
global.matchMedia = global.window.matchMedia;
global.localStorage = global.window.localStorage;
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };

const antd = require('antd');
try {
  console.log('calling Modal.confirm without <App>...');
  antd.Modal.confirm({ title: 't', content: 'c', okText: 'ok', cancelText: 'x' });
  console.log('Modal.confirm: NO THROW');
} catch (e) {
  console.log('Modal.confirm THREW:', e && e.message ? e.message : e);
}
try {
  console.log('calling message.error without <App>...');
  antd.message.error('hi');
  console.log('message.error: NO THROW');
} catch (e) {
  console.log('message.error THREW:', e && e.message ? e.message : e);
}
