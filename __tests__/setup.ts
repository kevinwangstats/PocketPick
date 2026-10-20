/* eslint-disable @typescript-eslint/no-require-imports */
// Jest setup file
import '@testing-library/react-native';

// Suppress known non-critical React Native warnings in Jest output
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Animated:') || args[0].includes('Sending `onAnimatedValueUpdate`'))
  ) {
    return;
  }
  originalWarn(...args);
};

jest.mock('expo-secure-store', () => {
  const { mockSecureStore } = require('./mocks/secure-store.mock');
  return {
    ...mockSecureStore,
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 2,
  };
});

jest.mock('react-native-quick-crypto', () => {
  const { mockQuickCrypto } = require('./mocks/quick-crypto.mock');
  return {
    __esModule: true,
    default: mockQuickCrypto,
    ...mockQuickCrypto,
  };
});

jest.mock('@op-engineering/op-sqlite', () => {
  const { open, MockDB } = require('./mocks/op-sqlite.mock');
  return {
    open,
    MockDB,
  };
});
