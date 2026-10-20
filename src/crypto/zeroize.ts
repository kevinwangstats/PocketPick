import { Buffer } from '@craftzdog/react-native-buffer';

/**
 * Overwrites sensitive buffer contents in memory with zeroes.
 * Must be invoked whenever session keys, decrypted files, or secrets are decommissioned.
 */
export function zeroizeBuffer(buffer: Buffer | Uint8Array | null | undefined): void {
  if (!buffer) return;
  if (Buffer.isBuffer(buffer)) {
    buffer.fill(0);
  } else if (buffer instanceof Uint8Array) {
    buffer.fill(0);
  }
}
