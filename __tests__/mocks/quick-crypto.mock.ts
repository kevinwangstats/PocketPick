/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require('crypto');

export const mockQuickCrypto = {
  randomBytes: (size: number): Buffer => crypto.randomBytes(size),
  pbkdf2Sync: (
    password: string | Buffer,
    salt: string | Buffer,
    iterations: number,
    keylen: number,
    digest: string,
  ): Buffer => crypto.pbkdf2Sync(password, salt, iterations, keylen, digest),
  createCipheriv: (algorithm: string, key: Buffer, iv: Buffer | null, options?: unknown) =>
    crypto.createCipheriv(algorithm, key, iv, options),
  createDecipheriv: (algorithm: string, key: Buffer, iv: Buffer | null, options?: unknown) =>
    crypto.createDecipheriv(algorithm, key, iv, options),
};

export default mockQuickCrypto;
