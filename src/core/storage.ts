// A small async key-value store. The userscript backs it with GM.getValue and GM.setValue,
// the extension with browser.storage.local, and tests with the in-memory version below.

export interface Storage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  /** Calls listener with the new value whenever key is set in this page. Returns unsubscribe. */
  subscribe(key: string, listener: (value: unknown) => void): () => void;
}

// Real storage serialises values, so the memory version copies them to behave the same way.
function copy(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function createMemoryStorage(
  initial: Record<string, unknown> = {},
): Storage {
  const values = new Map<string, unknown>(
    Object.entries(initial).map(([key, value]) => [key, copy(value)]),
  );
  const listeners = new Map<string, Set<(value: unknown) => void>>();

  return {
    get: (key) => Promise.resolve(copy(values.get(key))),

    set(key, value) {
      values.set(key, copy(value));
      for (const listener of listeners.get(key) ?? []) {
        try {
          listener(copy(value));
        } catch (error) {
          // Report a listener's bug without failing the write or skipping other listeners.
          setTimeout(() => {
            throw error;
          });
        }
      }
      return Promise.resolve();
    },

    subscribe(key, listener) {
      const set = listeners.get(key) ?? new Set();
      set.add(listener);
      listeners.set(key, set);
      return () => set.delete(listener);
    },
  };
}
