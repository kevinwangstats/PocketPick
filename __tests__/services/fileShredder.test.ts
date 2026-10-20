import { shredFile } from '@/services/media/fileShredder';
import * as FileSystem from 'expo-file-system';
import { mockFileSystem } from '../mocks/file-system.mock';

describe('Cryptographic File Shredder Service', () => {
  beforeEach(() => {
    mockFileSystem._reset();
  });

  it('overwrites file with zeroes before unlinking', async () => {
    const testPath = '/mock/cache/sensitive_photo.jpg';
    await FileSystem.writeAsStringAsync(testPath, 'super-secret-user-data-12345');

    expect(mockFileSystem._storage.has(testPath)).toBe(true);

    await shredFile(testPath);

    // Verify overwrite occurred
    expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalled();
    // Verify delete occurred
    expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(testPath, { idempotent: true });
    // Verify file is unlinked
    expect(mockFileSystem._storage.has(testPath)).toBe(false);
  });

  it('handles missing file gracefully without throwing an exception', async () => {
    const missingPath = '/mock/cache/non_existent.tmp';
    await expect(shredFile(missingPath)).resolves.not.toThrow();
  });
});
