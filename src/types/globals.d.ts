import { Buffer as RNCryptoBuffer } from '@craftzdog/react-native-buffer';

declare global {
  type Buffer = RNCryptoBuffer;
  const Buffer: typeof RNCryptoBuffer;
}
