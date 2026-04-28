import '@testing-library/jest-dom';

// Mock window globals that the app reads at startup
window.SENSITIVE_PROXY_ENDPOINT = 'https://mock-api.test/proxy';
window.GOOGLE_MAPS_API_KEY = '';
window.FIREBASE_CONFIG = {
  apiKey: 'test-key',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project',
  appId: 'test-app-id',
};

// Mock IntersectionObserver (not available in jsdom)
class MockIntersectionObserver {
  constructor() { this.observe = vi.fn(); this.unobserve = vi.fn(); this.disconnect = vi.fn(); }
}
globalThis.IntersectionObserver = MockIntersectionObserver;

// Mock ResizeObserver (not available in jsdom)
class MockResizeObserver {
  constructor() { this.observe = vi.fn(); this.unobserve = vi.fn(); this.disconnect = vi.fn(); }
}
globalThis.ResizeObserver = MockResizeObserver;

// Mock fetch globally
globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data: {} }),
    text: () => Promise.resolve('{}'),
  })
);
