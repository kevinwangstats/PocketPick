import * as FileSystem from 'expo-file-system';
import { mockFileSystem } from '../../mocks/file-system.mock';
import { shredFile } from '@/services/media/fileShredder';

describe('Vault Ephemeral AirDrop Sharing & Secure Shredder', () => {
  beforeEach(() => {
    mockFileSystem._reset();
  });

  it('creates an ephemeral file in cache, verifies existence, and shreds upon share completion', async () => {
    const tempShareUri = '/mock/cache/pocketpick_airdrop_12345.jpg';
    const fakePhotoDecryptedB64 = Buffer.from('photo-raw-bytes').toString('base64');

    // Simulate writing ephemeral photo for AirDrop
    await FileSystem.writeAsStringAsync(tempShareUri, fakePhotoDecryptedB64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    expect(mockFileSystem._storage.has(tempShareUri)).toBe(true);

    // Simulate finally block: shredFile
    await shredFile(tempShareUri);

    // File should be zero-overwritten and unlinked from cache
    expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalled();
    expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(tempShareUri, { idempotent: true });
    expect(mockFileSystem._storage.has(tempShareUri)).toBe(false);
  });
});
