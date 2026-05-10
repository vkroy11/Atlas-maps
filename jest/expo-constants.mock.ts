/**
 * Jest module mock for `expo-constants`.
 * Wired up via `moduleNameMapper` in `jest.config.js`.
 *
 * Tests that need a different key value can override per-suite with `jest.doMock`,
 * but most just need the key to be present so `getMaptilerKey()` doesn't throw.
 */

const Constants = {
  expoConfig: {
    extra: {
      maptilerKey: 'test-maptiler-key',
    },
  },
};

export default Constants;
