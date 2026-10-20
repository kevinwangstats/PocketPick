import QuickCrypto from 'react-native-quick-crypto';

export const PBKDF2_ITERATIONS = 100000;
export const KEY_LENGTH_BYTES = 32; // 256 bits
export const SALT_LENGTH_BYTES = 32;

/**
 * Generates a cryptographically secure 32-byte random salt for PBKDF2 key derivation.
 */
export function generateSalt(): Buffer {
  return QuickCrypto.randomBytes(SALT_LENGTH_BYTES);
}

/**
 * Derives a 256-bit symmetric encryption key from a user passphrase and salt
 * using PBKDF2-HMAC-SHA512 with 100,000 iterations.
 */
export function deriveVaultKey(passphrase: string, salt: Buffer | string): Buffer {
  if (!passphrase || passphrase.length === 0) {
    throw new Error('Passphrase must be a non-empty string');
  }

  const saltBuffer = typeof salt === 'string' ? Buffer.from(salt, 'base64') : salt;

  if (saltBuffer.length < 16) {
    throw new Error('Salt must be at least 16 bytes for cryptographic security');
  }

  return QuickCrypto.pbkdf2Sync(
    passphrase,
    saltBuffer,
    PBKDF2_ITERATIONS,
    KEY_LENGTH_BYTES,
    'sha512',
  );
}
