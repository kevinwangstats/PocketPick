import { Buffer } from '@craftzdog/react-native-buffer';
import QuickCrypto, { install } from 'react-native-quick-crypto';

// Polyfill global Buffer
const g: any = typeof globalThis !== 'undefined' ? globalThis : {};

if (typeof g.Buffer === 'undefined') {
  g.Buffer = Buffer;
}
if (typeof g.global !== 'undefined' && typeof g.global.Buffer === 'undefined') {
  g.global.Buffer = Buffer;
}

// Install quick-crypto globals (global.crypto, global.Buffer, global.base64ToArrayBuffer, etc.)
try {
  install();
} catch {
  // Ignore if already installed or in test environment
}

export { Buffer, QuickCrypto };
