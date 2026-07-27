import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

window.requestAnimationFrame = (callback) => callback();
Element.prototype.scrollIntoView = () => {};
