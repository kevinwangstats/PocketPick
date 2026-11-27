import { toRelativeResourcePath, resolveResourcePath } from './pathResolver';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';
import { eq, and } from 'drizzle-orm';
import { getDatabase } from '../../db/client';
import { resources } from '../../db/schema';
import { encryptBuffer, decryptBuffer } from '../../crypto/cipher';
import { shredFile } from './fileShredder';

export const FULL_IMAGE_MAX_WIDTH = 1600;
export const THUMBNAIL_WIDTH = 320;
export const VISION_IMAGE_MAX_WIDTH = 1024;

export type MediaBucket = 'photos' | 'avatars';

export interface StoredEncryptedImage {
  id: string;
  filePath: string;
  relativeFilePath: string;
  fileIv: string;
  fileTag: string;
  thumbnailPath: string;
  relativeThumbnailPath: string;
  thumbnailIv: string;
  thumbnailTag: string;
  fileHash: string;
}

/**
 * Computes an HMAC-SHA256 blind index hash for an unencrypted image buffer using the session key.
 */
export function computeImageHash(imageBuffer: Buffer, sessionKey: Buffer): string {
  return QuickCrypto.createHmac('sha256', sessionKey).update(imageBuffer).digest('hex');
}

/**
 * Optimizes a source image (max 1600px full + 320px thumbnail), encrypts both with AES-256-GCM,
 * stores them under `{documentDirectory}{bucket}/`, and shreds all temporary unencrypted files.
 */
export async function encryptAndStoreImage(params: {
  sourceUri: string;
  id: string;
  bucket: MediaBucket;
  sessionKey: Buffer;
  aad: string;
}): Promise<StoredEncryptedImage> {
  const { sourceUri, id, bucket, sessionKey, aad } = params;
  let optimizedFullUri: string | null = null;
  let thumbUri: string | null = null;

  try {
    const rawBase64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const rawBuffer = Buffer.from(rawBase64, 'base64');
    const fileHash = computeImageHash(rawBuffer, sessionKey);

    const fullManipulated = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: FULL_IMAGE_MAX_WIDTH } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    optimizedFullUri = fullManipulated.uri;

    const fullBase64 = await FileSystem.readAsStringAsync(optimizedFullUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const fullBuffer = Buffer.from(fullBase64, 'base64');

    const thumbManipulated = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: THUMBNAIL_WIDTH } }],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
    );
    thumbUri = thumbManipulated.uri;

    const thumbBase64 = await FileSystem.readAsStringAsync(thumbUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const thumbBuffer = Buffer.from(thumbBase64, 'base64');

    const encryptedFull = encryptBuffer(fullBuffer, sessionKey, aad);
    const encryptedThumb = encryptBuffer(thumbBuffer, sessionKey, aad);

    const targetDir = `${FileSystem.documentDirectory}${bucket}/`;
    await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });

    const fullEncPath = `${targetDir}${id}.enc`;
    const thumbEncPath = `${targetDir}${id}_thumb.enc`;

    await FileSystem.writeAsStringAsync(fullEncPath, encryptedFull.ciphertext, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(thumbEncPath, encryptedThumb.ciphertext, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return {
      id,
      filePath: fullEncPath,
      relativeFilePath: toRelativeResourcePath(fullEncPath),
      fileIv: encryptedFull.iv,
      fileTag: encryptedFull.tag,
      thumbnailPath: thumbEncPath,
      relativeThumbnailPath: toRelativeResourcePath(thumbEncPath),
      thumbnailIv: encryptedThumb.iv,
      thumbnailTag: encryptedThumb.tag,
      fileHash,
    };
  } finally {
    if (optimizedFullUri && optimizedFullUri !== sourceUri) {
      await shredFile(optimizedFullUri);
    }
    if (thumbUri && thumbUri !== sourceUri) {
      await shredFile(thumbUri);
    }
    if (sourceUri && sourceUri.includes(FileSystem.cacheDirectory ?? '')) {
      await shredFile(sourceUri);
    }
  }
}

/**
 * Decrypts an encrypted `.enc` file into memory after verifying its GCM authentication tag.
 */
export async function decryptImageBuffer(params: {
  encryptedPath: string;
  iv: string;
  tag: string;
  sessionKey: Buffer;
  aad: string;
}): Promise<Buffer> {
  const resolved = resolveResourcePath(params.encryptedPath);
  if (!resolved) {
    throw new Error('Unable to resolve encrypted image path');
  }

  const ciphertextBase64 = await FileSystem.readAsStringAsync(resolved, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return decryptBuffer(
    {
      ciphertext: ciphertextBase64,
      iv: params.iv,
      tag: params.tag,
    },
    params.sessionKey,
    params.aad,
  );
}

/**
 * Prepares a crisp 1024px JPEG data URI strictly for OpenRouter vision reasoning,
 * unconditionally shredding any temporary resize files in a `finally` block.
 */
export async function prepareVisionImageDataUri(params: {
  encryptedPath: string;
  iv: string;
  tag: string;
  sessionKey: Buffer;
  aad: string;
}): Promise<string> {
  const decryptedBuffer = await decryptImageBuffer(params);
  const randSuffix = QuickCrypto.randomBytes(6).toString('hex');
  const tempSourceUri = `${FileSystem.cacheDirectory}vision_src_${randSuffix}.jpg`;
  let resizedUri: string | null = null;

  try {
    await FileSystem.writeAsStringAsync(tempSourceUri, decryptedBuffer.toString('base64'), {
      encoding: FileSystem.EncodingType.Base64,
    });

    const resized = await ImageManipulator.manipulateAsync(
      tempSourceUri,
      [{ resize: { width: VISION_IMAGE_MAX_WIDTH } }],
      { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
    );
    resizedUri = resized.uri;

    const visionBase64 = await FileSystem.readAsStringAsync(resizedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${visionBase64}`;
  } finally {
    await shredFile(tempSourceUri);
    if (resizedUri && resizedUri !== tempSourceUri) {
      await shredFile(resizedUri);
    }
  }
}

// ---------------------------------------------------------------------------
// Temporary deprecated PocketPick helper (removed in Task 3.2 media purge)
// ---------------------------------------------------------------------------

/** @deprecated Removed in Task 3.2 */
export interface IngestionResult {
  resourceId: string;
  vaultId: string;
  filePath: string;
  thumbnailPath: string;
  fileHash: string;
  isDuplicate?: boolean;
}

/** @deprecated Removed in Task 3.2 */
export async function ingestImage(
  sourceUri: string,
  vaultId: string,
  vaultKey: Buffer,
): Promise<IngestionResult> {
  const resourceId = QuickCrypto.randomBytes(16).toString('hex');
  let thumbUri: string | null = null;

  try {
    const fullBase64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const fullBuffer = Buffer.from(fullBase64, 'base64');
    const fileHash = computeImageHash(fullBuffer, vaultKey);

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

    const encryptedFull = encryptBuffer(fullBuffer, vaultKey, vaultId);
    const encryptedThumb = encryptBuffer(thumbBuffer, vaultKey, vaultId);

    const vaultDir = `${FileSystem.documentDirectory}vaults/${vaultId}/resources/`;
    await FileSystem.makeDirectoryAsync(vaultDir, { intermediates: true });

    const fullEncPath = `${vaultDir}${resourceId}.enc`;
    const thumbEncPath = `${vaultDir}${resourceId}_thumb.enc`;

    await FileSystem.writeAsStringAsync(fullEncPath, encryptedFull.ciphertext, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(thumbEncPath, encryptedThumb.ciphertext, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await db.insert(resources).values({
      id: resourceId,
      vaultId,
      type: 'photo',
      weight: 1,
      encryptedFilePath: toRelativeResourcePath(fullEncPath),
      fileIv: encryptedFull.iv,
      fileTag: encryptedFull.tag,
      fileHash,
      encryptedThumbnailPath: toRelativeResourcePath(thumbEncPath),
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
    if (thumbUri) {
      await shredFile(thumbUri);
    }
    if (sourceUri && sourceUri.includes(FileSystem.cacheDirectory ?? '')) {
      await shredFile(sourceUri);
    }
  }
}
