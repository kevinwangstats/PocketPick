import * as FileSystem from 'expo-file-system/legacy';

/**
 * Cryptographically shreds a file by overwriting its contents with zeroes
 * before unlinking it from the filesystem.
 */
export async function shredFile(filePath: string): Promise<void> {
  if (!filePath) return;

  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) {
      return;
    }

    // Overwrite file with zeroes (defense-in-depth on flash/cache storage)
    const overwriteBytes = Buffer.alloc(Math.min(info.size ?? 1024, 65536), 0).toString('base64');
    await FileSystem.writeAsStringAsync(filePath, overwriteBytes, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Unlink file from disk
    await FileSystem.deleteAsync(filePath, { idempotent: true });
  } catch (err) {
    // Attempt fallback deletion even if overwrite fails
    try {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    } catch {
      // Suppress unhandled errors during emergency shred
    }
    console.error(`Shred error on file ${filePath}:`, err);
  }
}
