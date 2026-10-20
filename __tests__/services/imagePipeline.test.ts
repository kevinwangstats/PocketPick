import { ingestImage, computeImageHash } from '@/services/media/imagePipeline';
import * as FileSystem from 'expo-file-system';
import { mockFileSystem } from '../mocks/file-system.mock';
import QuickCrypto from 'react-native-quick-crypto';
import { getDatabase } from '@/db/client';

describe('Secure Image Ingestion Pipeline (TDD)', () => {
  const vaultId = 'vault-media-001';
  const vaultKey = QuickCrypto.randomBytes(32);
  const storedResources: any[] = [];

  beforeEach(async () => {
    storedResources.length = 0;
    mockFileSystem._reset();

    const db = await getDatabase();
    jest.spyOn(db, 'insert').mockImplementation((_table: any) => {
      return {
        values: (val: any) => {
          storedResources.push(val);
          return Promise.resolve();
        },
      } as any;
    });

    jest.spyOn(db, 'select').mockImplementation((_fields?: any) => {
      return {
        from: (_table: any) => ({
          where: (_clause: any) => ({
            limit: (_count: number) => {
              return Promise.resolve(storedResources);
            },
          }),
        }),
      } as any;
    });

    // Prepare fake picked photo in cache
    await FileSystem.writeAsStringAsync(
      '/mock/cache/picked_camera_photo.jpg',
      Buffer.from('Fake raw unencrypted photo bytes').toString('base64'),
      { encoding: FileSystem.EncodingType.Base64 },
    );
  });

  it('generates encrypted full photo and thumbnail, and shreds temporary source', async () => {
    const result = await ingestImage('/mock/cache/picked_camera_photo.jpg', vaultId, vaultKey);

    expect(result.resourceId).toBeDefined();
    expect(result.filePath).toContain('.enc');
    expect(result.thumbnailPath).toContain('_thumb.enc');
    expect(result.isDuplicate).toBe(false);

    // Verify .enc files were written to disk
    expect(mockFileSystem._storage.has(result.filePath)).toBe(true);
    expect(mockFileSystem._storage.has(result.thumbnailPath)).toBe(true);

    // CRITICAL SECURITY INVARIANT: Raw picked file must be shredded
    expect(mockFileSystem._storage.has('/mock/cache/picked_camera_photo.jpg')).toBe(false);
  });

  it('detects and skips duplicate photos on second ingestion attempt', async () => {
    // 1st Ingestion: First time importing the photo
    const firstResult = await ingestImage('/mock/cache/picked_camera_photo.jpg', vaultId, vaultKey);
    expect(firstResult.isDuplicate).toBe(false);
    expect(storedResources).toHaveLength(1);

    // Prepare identical photo again in cache (simulating re-picking the same photo)
    await FileSystem.writeAsStringAsync(
      '/mock/cache/duplicate_camera_photo.jpg',
      Buffer.from('Fake raw unencrypted photo bytes').toString('base64'),
      { encoding: FileSystem.EncodingType.Base64 },
    );

    // 2nd Ingestion: Same bytes into same vault
    const secondResult = await ingestImage(
      '/mock/cache/duplicate_camera_photo.jpg',
      vaultId,
      vaultKey,
    );

    expect(secondResult.isDuplicate).toBe(true);
    expect(secondResult.resourceId).toBe(firstResult.resourceId);
    expect(secondResult.fileHash).toBe(firstResult.fileHash);
    expect(storedResources).toHaveLength(1); // No duplicate DB row inserted

    // Raw duplicate file must still be shredded
    expect(mockFileSystem._storage.has('/mock/cache/duplicate_camera_photo.jpg')).toBe(false);
  });

  it('allows importing different photos with unique contents', async () => {
    await FileSystem.writeAsStringAsync(
      '/mock/cache/photo_a.jpg',
      Buffer.from('Unique photo content A').toString('base64'),
      { encoding: FileSystem.EncodingType.Base64 },
    );
    await FileSystem.writeAsStringAsync(
      '/mock/cache/photo_b.jpg',
      Buffer.from('Unique photo content B').toString('base64'),
      { encoding: FileSystem.EncodingType.Base64 },
    );

    // Custom select spy for distinct hashes
    const db = await getDatabase();
    jest.spyOn(db, 'select').mockImplementation((_fields?: any) => {
      return {
        from: (_table: any) => ({
          where: (_clause: any) => ({
            limit: () => {
              return Promise.resolve([]); // No collision
            },
          }),
        }),
      } as any;
    });

    const resA = await ingestImage('/mock/cache/photo_a.jpg', vaultId, vaultKey);
    const resB = await ingestImage('/mock/cache/photo_b.jpg', vaultId, vaultKey);

    expect(resA.isDuplicate).toBe(false);
    expect(resB.isDuplicate).toBe(false);
    expect(resA.fileHash).not.toBe(resB.fileHash);
    expect(resA.resourceId).not.toBe(resB.resourceId);
  });

  it('computes deterministic HMAC-SHA256 blind index hash', () => {
    const buf = Buffer.from('Testing image content hash');
    const hash1 = computeImageHash(buf, vaultKey);
    const hash2 = computeImageHash(buf, vaultKey);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex string length
  });
});
