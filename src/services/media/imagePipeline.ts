import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';
import { eq, and } from 'drizzle-orm';
import { getDatabase } from '../../db/client';
import { resources } from '../../db/schema';
import { encryptBuffer } from '../../crypto/cipher';
import { shredFile } from './fileShredder';

export interface IngestionResult {
  resourceId: string;
  vaultId: string;
  filePath: string;
  thumbnailPath: string;
  fileHash: string;
  isDuplicate?: boolean;
}

/**
 * Computes an HMAC-SHA256 blind index hash for an unencrypted image buffer using the vault key.
 * This guarantees content-based deduplication without revealing plaintext image hashes to the database.
 */
export function computeImageHash(imageBuffer: Buffer, vaultKey: Buffer): string {
  return QuickCrypto.createHmac('sha256', vaultKey).update(imageBuffer).digest('hex');
}

/**
 * Ingests a picked or captured image, generates a compressed thumbnail,
 * encrypts both full-res and thumbnail independently via AES-256-GCM,
 * writes them to .enc files in the vault folder, and shreds raw temporary files.
 *
 * If an identical image has already been ingested into the vault, skips duplicate
 * encryption and storage, shreds the temporary files, and returns isDuplicate: true.
 */
export async function ingestImage(
  sourceUri: string,
  vaultId: string,
  vaultKey: Buffer,
): Promise<IngestionResult> {
  const resourceId = QuickCrypto.randomBytes(16).toString('hex');
  let thumbUri: string | null = null;

  try {
    // 1. Read full-res bytes into Buffer and compute blind index hash
    const fullBase64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const fullBuffer = Buffer.from(fullBase64, 'base64');
    const fileHash = computeImageHash(fullBuffer, vaultKey);

    // 2. Content Deduplication Check: Check if this photo is already stored in this vault
    const db = await getDatabase();
    const existing = await db
      .select({ id: resources.id })
      .from(resources)
      .where(and(eq(resources.vaultId, vaultId), eq(resources.fileHash, fileHash)))
      .limit(1);

    if (existing.length > 0) {
      return {
        resourceId: existing[0].id,
        vaultId,
        filePath: '',
        thumbnailPath: '',
        fileHash,
        isDuplicate: true,
      };
    }

    // 3. Generate low-resolution 300x300 compressed thumbnail
    const manipulated = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: 300 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );
    thumbUri = manipulated.uri;

    const thumbBase64 = await FileSystem.readAsStringAsync(thumbUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const thumbBuffer = Buffer.from(thumbBase64, 'base64');

    // 4. Encrypt both binaries independently with unique random IVs
    const encryptedFull = encryptBuffer(fullBuffer, vaultKey, vaultId);
    const encryptedThumb = encryptBuffer(thumbBuffer, vaultKey, vaultId);

    // 5. Prepare target directory: {documentDirectory}vaults/{vaultId}/resources/
    const vaultDir = `${FileSystem.documentDirectory}vaults/${vaultId}/resources/`;
    await FileSystem.makeDirectoryAsync(vaultDir, { intermediates: true });

    const fullEncPath = `${vaultDir}${resourceId}.enc`;
    const thumbEncPath = `${vaultDir}${resourceId}_thumb.enc`;

    // 6. Write encrypted ciphertexts to disk
    await FileSystem.writeAsStringAsync(fullEncPath, encryptedFull.ciphertext, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(thumbEncPath, encryptedThumb.ciphertext, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 7. Record metadata, hash, and cipher parameters in SQLite
    await db.insert(resources).values({
      id: resourceId,
      vaultId,
      type: 'photo',
      weight: 1,
      encryptedFilePath: fullEncPath,
      fileIv: encryptedFull.iv,
      fileTag: encryptedFull.tag,
      fileHash,
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
      fileHash,
      isDuplicate: false,
    };
  } finally {
    // 8. STRICT ZERO-LEAK INVARIANT: Always shred raw picked and manipulated files
    if (thumbUri) {
      await shredFile(thumbUri);
    }
    // Also clean up picked source file if located in sandbox cache
    if (sourceUri && sourceUri.includes(FileSystem.cacheDirectory ?? '')) {
      await shredFile(sourceUri);
    }
  }
}
