export interface EncryptedPayload {
  /** Base64-encoded AES-256-GCM ciphertext */
  ciphertext: string;
  /** Base64-encoded 12-byte (96-bit) initialization vector / nonce */
  iv: string;
  /** Base64-encoded 16-byte (128-bit) authentication tag */
  tag: string;
}

export interface EncryptedFileMetadata {
  filePath: string;
  iv: string;
  tag: string;
}

export class AuthenticationError extends Error {
  constructor(
    message = 'Ciphertext authentication tag verification failed. Data has been tampered with.',
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}
