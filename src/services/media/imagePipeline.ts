import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import QuickCrypto from 'react-native-quick-crypto';
import { getDatabase } from '../../db/client';
import { resources } from '../../db/schema';
import { encryptBuffer } from '../../crypto/cipher';
import { shredFile } from './fileShredder';

export interface IngestionResult {
  resourceId: string;
  vaultId: string;
  filePath: string;
  thumbnailPath: string;
}

/**
 * Ingests a picked or captured image, generates a compressed thumbnail,
 * encrypts both full-res and thumbnail independently via AES-256-GCM,
 * writes them to .enc files in the vault folder, and shreds raw temporary files.
 */
export async function ingestImage(
  sourceUri: string,
  vaultId: string,
  vaultKey: Buffer,
): Promise<IngestionResult> {
  const resourceId = QuickCrypto.randomBytes(16).toString('hex');
  let thumbUri: string | null = null;

  try {
    // 1. Generate low-resolution 300x300 compressed thumbnail
    const manipulated = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: 300 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );
    thumbUri = manipulated.uri;

    // 2. Read full-res and thumbnail bytes into Buffers
    const fullBase64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const fullBuffer = Buffer.from(fullBase64, 'base64');

    const thumbBase64 = await FileSystem.readAsStringAsync(thumbUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const thumbBuffer = Buffer.from(thumbBase64, 'base64');

    // 3. Encrypt both binaries independently with unique random IVs
    const encryptedFull = encryptBuffer(fullBuffer, vaultKey, vaultId);
    const encryptedThumb = encryptBuffer(thumbBuffer, vaultKey, vaultId);

    // 4. Prepare target directory: {documentDirectory}vaults/{vaultId}/resources/
    const vaultDir = `${FileSystem.documentDirectory}vaults/${vaultId}/resources/`;
    await FileSystem.makeDirectoryAsync(vaultDir, { intermediates: true });

    const fullEncPath = `${vaultDir}${resourceId}.enc`;
    const thumbEncPath = `${vaultDir}${resourceId}_thumb.enc`;

    // 5. Write encrypted ciphertexts to disk
    await FileSystem.writeAsStringAsync(fullEncPath, encryptedFull.ciphertext, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(thumbEncPath, encryptedThumb.ciphertext, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 6. Record metadata and cipher parameters in SQLite
    const db = await getDatabase();
    await db.insert(resources).values({
      id: resourceId,
      vaultId,
      type: 'photo',
      weight: 1,
      encryptedFilePath: fullEncPath,
      fileIv: encryptedFull.iv,
      fileTag: encryptedFull.tag,
      encryptedThumbnailPath: thumbEncPath,
      thumbnailIv: encryptedThumb.iv,
      thumbnailTag: encryptedThumb.tag,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      resourceId,
      vaultId,
      filePath: fullEncPath,
      thumbnailPath: thumbEncPath,
    };
  } finally {
    // 7. STRICT ZERO-LEAK INVARIANT: Always shred raw picked and manipulated files
    if (thumbUri) {
      await shredFile(thumbUri);
    }
    // Also clean up picked source file if located in sandbox cache
    if (sourceUri && sourceUri.includes(FileSystem.cacheDirectory ?? '')) {
      await shredFile(sourceUri);
    }
  }
}
