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

jest.mock('expo-file-system', () => {
  const { mockFileSystem } = require('./mocks/file-system.mock');
  return {
    ...mockFileSystem,
    default: mockFileSystem,
  };
});

jest.mock('expo-file-system/legacy', () => {
  const { mockFileSystem } = require('./mocks/file-system.mock');
  return {
    ...mockFileSystem,
    default: mockFileSystem,
  };
});

jest.mock('expo-image-manipulator', () => {
  const { mockFileSystem } = require('./mocks/file-system.mock');
  return {
    SaveFormat: {
      JPEG: 'jpeg',
      PNG: 'png',
    },
    manipulateAsync: jest.fn(async (uri: string) => {
      const outputUri = `${uri}_manipulated.jpg`;
      mockFileSystem._storage.set(
        outputUri,
        Buffer.from('fake manipulated thumbnail bytes').toString('base64'),
      );
      return {
        uri: outputUri,
        width: 300,
        height: 300,
      };
    }),
  };
});

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: {
    Images: 'images',
  },
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: '/mock/picked_image.jpg' }],
  })),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
}));

jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: {
    recognize: jest.fn(async () => ({
      text: 'Extracted OCR Mock Text 12345',
      blocks: [],
    })),
  },
}));
