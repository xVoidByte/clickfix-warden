// The extension API as seen from code that the tests run inside the service worker.
declare const chrome: {
  storage: {
    local: {
      get(keys: string | string[]): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
};
