import { deriveVaultKey, generateSalt, KEY_LENGTH_BYTES, SALT_LENGTH_BYTES } from '@/crypto/kdf';

describe('PBKDF2 Key Derivation Service (TDD)', () => {
  it('generates a 32-byte (256-bit) high-entropy cryptographic salt', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();

    expect(Buffer.isBuffer(salt1)).toBe(true);
    expect(salt1.length).toBe(SALT_LENGTH_BYTES);
    expect(salt2.length).toBe(SALT_LENGTH_BYTES);
    expect(salt1.equals(salt2)).toBe(false);
  });

  it('derives a deterministic 32-byte key for the same passphrase and salt', () => {
    const salt = generateSalt();
    const passphrase = 'Correct-Horse-Battery-Staple-2026!';

    const key1 = deriveVaultKey(passphrase, salt);
    const key2 = deriveVaultKey(passphrase, salt);

    expect(Buffer.isBuffer(key1)).toBe(true);
    expect(key1.length).toBe(KEY_LENGTH_BYTES);
    expect(key1.equals(key2)).toBe(true);
  });

  it('derives completely different keys for different passphrases with the same salt', () => {
    const salt = generateSalt();
    const key1 = deriveVaultKey('PassphraseOne123', salt);
    const key2 = deriveVaultKey('PassphraseTwo123', salt);

    expect(key1.equals(key2)).toBe(false);
  });

  it('derives completely different keys for the same passphrase with different salts', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const key1 = deriveVaultKey('SamePassphrase', salt1);
    const key2 = deriveVaultKey('SamePassphrase', salt2);

    expect(key1.equals(key2)).toBe(false);
  });

  it('throws an error if passphrase is empty', () => {
    const salt = generateSalt();
    expect(() => deriveVaultKey('', salt)).toThrow('Passphrase must be a non-empty string');
  });

  it('throws an error if salt length is under 16 bytes', () => {
    const shortSalt = Buffer.alloc(10);
    expect(() => deriveVaultKey('passphrase', shortSalt)).toThrow(
      'Salt must be at least 16 bytes for cryptographic security',
    );
  });
});
