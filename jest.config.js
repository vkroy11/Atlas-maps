/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(test).ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/web-build/', '/ios/', '/android/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // Jest doesn't apply Metro's platform-suffix resolution, so .native.ts files
  // are never imported here — tests always target the default (web/Node) impls.
  modulePathIgnorePatterns: ['<rootDir>/.expo/'],
  moduleNameMapper: {
    // expo-constants ships ESM; supply a tiny mock so tests can import code that
    // reads runtime config without pulling in the full Expo native stack.
    '^expo-constants$': '<rootDir>/jest/expo-constants.mock.ts',
  },
};
