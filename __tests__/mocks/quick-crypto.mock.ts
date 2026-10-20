import crypto from 'crypto';

export const mockQuickCrypto = {
  randomBytes: (size: number): Buffer => crypto.randomBytes(size),
  pbkdf2Sync: (
    password: crypto.BinaryLike,
    salt: crypto.BinaryLike,
    iterations: number,
    keylen: number,
    digest: string,
  ): Buffer => crypto.pbkdf2Sync(password, salt, iterations, keylen, digest),
  createCipheriv: (
    algorithm: crypto.CipherGCMTypes,
    key: crypto.CipherKey,
    iv: crypto.BinaryLike | null,
    options?: crypto.CipherCCMOptions,
  ): crypto.CipherGCM =>
    crypto.createCipheriv(algorithm, key, iv, options) as unknown as crypto.CipherGCM,
  createDecipheriv: (
    algorithm: crypto.CipherGCMTypes,
    key: crypto.CipherKey,
    iv: crypto.BinaryLike | null,
    options?: crypto.CipherCCMOptions,
  ): crypto.DecipherGCM =>
    crypto.createDecipheriv(algorithm, key, iv, options) as unknown as crypto.DecipherGCM,
};

export default mockQuickCrypto;
