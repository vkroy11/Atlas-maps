/**
 * In-memory stand-in for `@react-native-async-storage/async-storage` so the
 * settings module can be exercised under Node Jest.
 */

const store = new Map<string, string>();

const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => store.get(key) ?? null,
  setItem: async (key: string, value: string): Promise<void> => {
    store.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    store.delete(key);
  },
  clear: async (): Promise<void> => {
    store.clear();
  },
  multiGet: async (keys: string[]): Promise<[string, string | null][]> =>
    keys.map((k) => [k, store.get(k) ?? null] as [string, string | null]),
};

export default AsyncStorage;
