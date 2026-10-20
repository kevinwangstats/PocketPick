import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';
import { EncryptedPayload, AuthenticationError } from './types';

export const GCM_IV_LENGTH_BYTES = 12; // 96 bits recommended for AES-GCM
export const GCM_TAG_LENGTH_BYTES = 16; // 128 bits authentication tag
export const CIPHER_ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts a binary buffer using AES-256-GCM authenticated encryption.
 * Automatically generates a unique 12-byte IV for every encryption call.
 */
export function encryptBuffer(plainBuffer: Buffer, key: Buffer, aad?: string): EncryptedPayload {
  if (!key || key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (256 bits)');
  }

  const iv = QuickCrypto.randomBytes(GCM_IV_LENGTH_BYTES);
  const cipher = QuickCrypto.createCipheriv(CIPHER_ALGORITHM, key, iv);

  if (aad) {
    cipher.setAAD(Buffer.from(aad, 'utf8'));
  }

  const encryptedPart1 = cipher.update(plainBuffer);
  const encryptedPart2 = cipher.final();
  const ciphertextBuffer = Buffer.concat([encryptedPart1, encryptedPart2]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertextBuffer.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload, strictly verifying the 16-byte authentication tag.
 * Throws an explicit AuthenticationError if 1 bit/byte of ciphertext, IV, or tag is tampered with.
 */
export function decryptBuffer(encrypted: EncryptedPayload, key: Buffer, aad?: string): Buffer {
  if (!key || key.length !== 32) {
    throw new Error('Decryption key must be exactly 32 bytes (256 bits)');
  }

  const iv = Buffer.from(encrypted.iv, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');

  if (iv.length !== GCM_IV_LENGTH_BYTES) {
    throw new AuthenticationError('Invalid IV length for AES-GCM');
  }

  if (tag.length !== GCM_TAG_LENGTH_BYTES) {
    throw new AuthenticationError('Invalid authentication tag length');
  }

  try {
    const decipher = QuickCrypto.createDecipheriv(CIPHER_ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    if (aad) {
      decipher.setAAD(Buffer.from(aad, 'utf8'));
    }

    const decryptedPart1 = decipher.update(ciphertext);
    const decryptedPart2 = decipher.final();
    return Buffer.concat([decryptedPart1, decryptedPart2]);
  } catch (err) {
    throw new AuthenticationError(
      `Decryption failed: auth tag verification failed or ciphertext tampered. Detail: ${(err as Error).message}`,
    );
  }
}

/**
 * Convenience helper to encrypt a UTF-8 string.
 */
export function encryptString(plaintext: string, key: Buffer, aad?: string): EncryptedPayload {
  const plainBuffer = Buffer.from(plaintext, 'utf8');
  return encryptBuffer(plainBuffer, key, aad);
}

/**
 * Convenience helper to decrypt an AES-256-GCM payload into a UTF-8 string.
 */
export function decryptString(encrypted: EncryptedPayload, key: Buffer, aad?: string): string {
  const decryptedBuffer = decryptBuffer(encrypted, key, aad);
  return decryptedBuffer.toString('utf8');
}
