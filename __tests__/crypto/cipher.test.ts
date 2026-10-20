import {
  encryptBuffer,
  decryptBuffer,
  encryptString,
  decryptString,
  GCM_IV_LENGTH_BYTES,
  GCM_TAG_LENGTH_BYTES,
} from '@/crypto/cipher';
import { AuthenticationError } from '@/crypto/types';
import QuickCrypto from 'react-native-quick-crypto';

describe('AES-256-GCM Authenticated Cipher Service (TDD)', () => {
  const masterKey = QuickCrypto.randomBytes(32);
  const sampleText = 'PocketPick Confidential Note 🔒 — 100% On-Device Envelope Encryption!';
  const sampleBuffer = Buffer.from('Binary confidential file bytes \x00\x01\x02\xFF\xFE', 'binary');

  it('successfully encrypts and decrypts a binary buffer without corruption', () => {
    const encrypted = encryptBuffer(sampleBuffer, masterKey);

    expect(encrypted.ciphertext).toBeDefined();
    expect(Buffer.from(encrypted.iv, 'base64').length).toBe(GCM_IV_LENGTH_BYTES);
    expect(Buffer.from(encrypted.tag, 'base64').length).toBe(GCM_TAG_LENGTH_BYTES);

    const decrypted = decryptBuffer(encrypted, masterKey);
    expect(decrypted.equals(sampleBuffer)).toBe(true);
  });

  it('successfully encrypts and decrypts unicode string payloads', () => {
    const encrypted = encryptString(sampleText, masterKey);
    const decrypted = decryptString(encrypted, masterKey);

    expect(decrypted).toBe(sampleText);
  });

  it('generates a unique IV for every encryption call (semantic security)', () => {
    const encrypted1 = encryptString(sampleText, masterKey);
    const encrypted2 = encryptString(sampleText, masterKey);

    expect(encrypted1.iv).not.toBe(encrypted2.iv);
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
  });

  // CRITICAL INVARIANT: 1-byte ciphertext tampering test
  it('throws an explicit AuthenticationError when 1 single byte of ciphertext is tampered with', () => {
    const encrypted = encryptString(sampleText, masterKey);
    const cipherBuffer = Buffer.from(encrypted.ciphertext, 'base64');

    // Flip bits in the very first byte
    cipherBuffer[0] ^= 0x01;
    const tamperedPayload = {
      ...encrypted,
      ciphertext: cipherBuffer.toString('base64'),
    };

    expect(() => decryptString(tamperedPayload, masterKey)).toThrow(AuthenticationError);
  });

  // CRITICAL INVARIANT: 1-byte auth tag tampering test
  it('throws an explicit AuthenticationError when 1 byte of the authentication tag is altered', () => {
    const encrypted = encryptString(sampleText, masterKey);
    const tagBuffer = Buffer.from(encrypted.tag, 'base64');

    // Tamper the tag byte
    tagBuffer[tagBuffer.length - 1] ^= 0xff;
    const tamperedPayload = {
      ...encrypted,
      tag: tagBuffer.toString('base64'),
    };

    expect(() => decryptString(tamperedPayload, masterKey)).toThrow(AuthenticationError);
  });

  // CRITICAL INVARIANT: 1-byte IV tampering test
  it('throws an explicit AuthenticationError when IV is tampered with', () => {
    const encrypted = encryptString(sampleText, masterKey);
    const ivBuffer = Buffer.from(encrypted.iv, 'base64');

    ivBuffer[0] ^= 0x55;
    const tamperedPayload = {
      ...encrypted,
      iv: ivBuffer.toString('base64'),
    };

    expect(() => decryptString(tamperedPayload, masterKey)).toThrow(AuthenticationError);
  });

  it('supports Associated Authenticated Data (AAD) and rejects mismatched AAD', () => {
    const vaultId = 'vault-uuid-12345';
    const encrypted = encryptString(sampleText, masterKey, vaultId);

    // Decrypting with correct AAD succeeds
    const decrypted = decryptString(encrypted, masterKey, vaultId);
    expect(decrypted).toBe(sampleText);

    // Decrypting with wrong AAD fails
    expect(() => decryptString(encrypted, masterKey, 'wrong-vault-id')).toThrow(
      AuthenticationError,
    );
  });

  it('rejects keys that are not exactly 32 bytes (256 bits)', () => {
    const shortKey = QuickCrypto.randomBytes(16);
    expect(() => encryptString(sampleText, shortKey)).toThrow(
      'Encryption key must be exactly 32 bytes (256 bits)',
    );
  });
});
