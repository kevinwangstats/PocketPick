import * as FileSystem from 'expo-file-system';
import QuickCrypto from 'react-native-quick-crypto';
import {
  encryptAndStoreImage,
  decryptImageBuffer,
  prepareVisionImageDataUri,
  computeImageHash,
} from '@/services/media/imagePipeline';
import { mockFileSystem } from '../mocks/file-system.mock';

describe('Optimized 1600px Private Image Pipeline (TDD)', () => {
  const sessionKey = QuickCrypto.randomBytes(32);

  beforeEach(async () => {
    mockFileSystem._reset();
    await FileSystem.writeAsStringAsync(
      '/mock/cache/raw_garment.jpg',
      Buffer.from('Raw unencrypted silk garment photo bytes').toString('base64'),
      { encoding: FileSystem.EncodingType.Base64 },
    );
  });

  it('encrypts optimized full + thumb files under sandbox bucket and shreds temp cache', async () => {
    const stored = await encryptAndStoreImage({
      sourceUri: '/mock/cache/raw_garment.jpg',
      id: 'img-001',
      bucket: 'photos',
      sessionKey,
      aad: 'img-001',
    });

    expect(stored.relativeFilePath).toBe('photos/img-001.enc');
    expect(stored.relativeThumbnailPath).toBe('photos/img-001_thumb.enc');
    expect(mockFileSystem._storage.has('/mock/documents/photos/img-001.enc')).toBe(true);
    expect(mockFileSystem._storage.has('/mock/documents/photos/img-001_thumb.enc')).toBe(true);
    expect(mockFileSystem._storage.has('/mock/cache/raw_garment.jpg')).toBe(false);

    const decrypted = await decryptImageBuffer({
      encryptedPath: stored.relativeFilePath,
      iv: stored.fileIv,
      tag: stored.fileTag,
      sessionKey,
      aad: 'img-001',
    });
    expect(decrypted.length).toBeGreaterThan(0);
  });

  it('rejects 1-byte tampered ciphertext during decryption', async () => {
    const stored = await encryptAndStoreImage({
      sourceUri: '/mock/cache/raw_garment.jpg',
      id: 'img-tamper',
      bucket: 'photos',
      sessionKey,
      aad: 'img-tamper',
    });

    const fullPath = '/mock/documents/photos/img-tamper.enc';
    const rawCipher = Buffer.from(mockFileSystem._storage.get(fullPath)!, 'base64');
    rawCipher[0] = rawCipher[0] ^ 0xff;
    mockFileSystem._storage.set(fullPath, rawCipher.toString('base64'));

    await expect(
      decryptImageBuffer({
        encryptedPath: stored.relativeFilePath,
        iv: stored.fileIv,
        tag: stored.fileTag,
        sessionKey,
        aad: 'img-tamper',
      }),
    ).rejects.toThrow();
  });

  it('prepares crisp 1024px vision data URI and shreds temporary cache files', async () => {
    const stored = await encryptAndStoreImage({
      sourceUri: '/mock/cache/raw_garment.jpg',
      id: 'img-vision',
      bucket: 'photos',
      sessionKey,
      aad: 'img-vision',
    });

    const dataUri = await prepareVisionImageDataUri({
      encryptedPath: stored.relativeFilePath,
      iv: stored.fileIv,
      tag: stored.fileTag,
      sessionKey,
      aad: 'img-vision',
    });

    expect(dataUri.startsWith('data:image/jpeg;base64,')).toBe(true);
    const lingeringCacheKeys = Array.from(mockFileSystem._storage.keys()).filter((k) =>
      k.startsWith('/mock/cache/vision_src_'),
    );
    expect(lingeringCacheKeys).toHaveLength(0);
  });

  it('computes deterministic HMAC-SHA256 blind index hash', () => {
    const buf = Buffer.from('Testing image content hash');
    const hash1 = computeImageHash(buf, sessionKey);
    const hash2 = computeImageHash(buf, sessionKey);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});
