import { vi } from 'vitest';

// Mock Chrome extension APIs
const mockStorage: Record<string, unknown> = {};

const mockChromeStorage = {
  local: {
    get: vi.fn((keys: string | string[] | null) => {
      return new Promise((resolve) => {
        if (keys === null) {
          resolve(mockStorage);
        } else if (typeof keys === 'string') {
          resolve({ [keys]: mockStorage[keys] });
        } else if (Array.isArray(keys)) {
          const result: Record<string, unknown> = {};
          keys.forEach((key) => {
            result[key] = mockStorage[key];
          });
          resolve(result);
        }
      });
    }),
    set: vi.fn((items: Record<string, unknown>) => {
      return new Promise<void>((resolve) => {
        Object.assign(mockStorage, items);
        resolve();
      });
    }),
    remove: vi.fn((keys: string | string[]) => {
      return new Promise<void>((resolve) => {
        const keyArray = typeof keys === 'string' ? [keys] : keys;
        keyArray.forEach((key) => {
          delete mockStorage[key];
        });
        resolve();
      });
    }),
    clear: vi.fn(() => {
      return new Promise<void>((resolve) => {
        Object.keys(mockStorage).forEach((key) => {
          delete mockStorage[key];
        });
        resolve();
      });
    }),
  },
};

const mockChromeRuntime = {
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  connect: vi.fn(() => ({
    postMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onDisconnect: {
      addListener: vi.fn(),
    },
  })),
  getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
};

// Set up global chrome mock
(globalThis as unknown as { chrome: typeof chrome }).chrome = {
  storage: mockChromeStorage,
  runtime: mockChromeRuntime,
} as unknown as typeof chrome;

// Mock crypto.getRandomValues for Node.js environment
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        if (array) {
          const bytes = array as unknown as Uint8Array;
          for (let i = 0; i < bytes.length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
          }
        }
        return array;
      },
      subtle: {},
      randomUUID: () => 'mock-uuid-' + Math.random().toString(36).slice(2),
    },
  });
}

// Export mock storage for tests to access
export { mockStorage, mockChromeStorage, mockChromeRuntime };

// Reset mocks between tests
export function resetMocks() {
  Object.keys(mockStorage).forEach((key) => {
    delete mockStorage[key];
  });
  vi.clearAllMocks();
}
