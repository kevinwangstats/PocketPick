import { ingestImage } from '@/services/media/imagePipeline';
import * as FileSystem from 'expo-file-system';
import { mockFileSystem } from '../mocks/file-system.mock';
import QuickCrypto from 'react-native-quick-crypto';

describe('Secure Image Ingestion Pipeline (TDD)', () => {
  const vaultId = 'vault-media-001';
  const vaultKey = QuickCrypto.randomBytes(32);

  beforeEach(async () => {
    mockFileSystem._reset();
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

    // Verify .enc files were written to disk
    expect(mockFileSystem._storage.has(result.filePath)).toBe(true);
    expect(mockFileSystem._storage.has(result.thumbnailPath)).toBe(true);

    // CRITICAL SECURITY INVARIANT: Raw picked file must be shredded
    expect(mockFileSystem._storage.has('/mock/cache/picked_camera_photo.jpg')).toBe(false);
  });
});
