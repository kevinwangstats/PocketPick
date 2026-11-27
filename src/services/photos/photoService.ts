import * as FileSystem from 'expo-file-system/legacy';
import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';
import { eq, desc, inArray } from 'drizzle-orm';
import { getDatabase } from '../../db/client';
import { photos, Photo, PhotoKind, WardrobeCategory, WARDROBE_CATEGORIES } from '../../db/schema';
import { encryptString, decryptString } from '../../crypto/cipher';
import {
  computeImageHash,
  encryptAndStoreImage,
  prepareVisionImageDataUri,
} from '../media/imagePipeline';
import { resolveResourcePath } from '../media/pathResolver';
import { shredFile } from '../media/fileShredder';
import { thumbnailCache } from '../media/thumbnailCache';
import { queryLlm } from '../llm/llmClient';
import {
  DecryptedPhotoMetadata,
  DecryptedPhotoRecord,
  IngestPhotoOptions,
  IngestPhotoResult,
  PhotoAiClassification,
} from './types';

function itemAad(photoId: string): string {
  return `${photoId}:item`;
}

function descriptionAad(photoId: string): string {
  return `${photoId}:desc`;
}

/**
 * Normalizes any raw category string into one of the 5 strict allowable wardrobe categories.
 */
export function normalizeWardrobeCategory(raw?: string | null): WardrobeCategory {
  if (!raw) return 'others';
  const cleaned = raw.trim().toLowerCase();
  if ((WARDROBE_CATEGORIES as readonly string[]).includes(cleaned)) {
    return cleaned as WardrobeCategory;
  }
  if (/(bra|panties|panty|thong|lingerie|brief|bodysuit|knicker|underwear)/.test(cleaned)) {
    return 'underwear';
  }
  if (/(hosiery|stocking|tights|thigh|nylon|garter|sock)/.test(cleaned)) {
    return 'hosiery';
  }
  if (/(top|shirt|tshirt|t-shirt|tee|blouse|camisole|sweater|hoodie|tank)/.test(cleaned)) {
    return 'top';
  }
  if (/(bottom|pants|trouser|jean|skirt|short|legging)/.test(cleaned)) {
    return 'bottom';
  }
  return 'others';
}

/**
 * Ingests a photo strictly inside the app sandbox (zero writes to iOS Photos),
 * checks HMAC-SHA256 blind-index deduplication, encrypts full-res (1600px) & thumb (320px),
 * and encrypts item & description fields with AES-256-GCM.
 */
export async function ingestPhoto(
  sourceUri: string,
  sessionKey: Buffer,
  options: IngestPhotoOptions = {},
): Promise<IngestPhotoResult> {
  const photoId = QuickCrypto.randomBytes(16).toString('hex');

  try {
    const rawBase64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const rawBuffer = Buffer.from(rawBase64, 'base64');
    const fileHash = computeImageHash(rawBuffer, sessionKey);

    const db = await getDatabase();
    const existing = await db
      .select({ id: photos.id })
      .from(photos)
      .where(eq(photos.fileHash, fileHash))
      .limit(1);

    if (existing.length > 0) {
      return {
        photoId: existing[0].id,
        fileHash,
        isDuplicate: true,
      };
    }

    const stored = await encryptAndStoreImage({
      sourceUri,
      id: photoId,
      bucket: 'photos',
      sessionKey,
      aad: photoId,
    });

    const trimmedItem = options.item?.trim() ?? '';
    const trimmedDesc = options.description?.trim() ?? '';

    const encItem = trimmedItem ? encryptString(trimmedItem, sessionKey, itemAad(photoId)) : null;
    const encDesc = trimmedDesc
      ? encryptString(trimmedDesc, sessionKey, descriptionAad(photoId))
      : null;

    const now = new Date();
    const record: typeof photos.$inferInsert = {
      id: photoId,
      photoKind: options.photoKind ?? 'wardrobe',
      aiHasHumanBody:
        options.aiHasHumanBody === true ? 1 : options.aiHasHumanBody === false ? 0 : null,
      category: options.category ?? 'others',
      encryptedItem: encItem?.ciphertext ?? null,
      itemIv: encItem?.iv ?? null,
      itemTag: encItem?.tag ?? null,
      encryptedDescription: encDesc?.ciphertext ?? null,
      descriptionIv: encDesc?.iv ?? null,
      descriptionTag: encDesc?.tag ?? null,
      encryptedFilePath: stored.relativeFilePath,
      fileIv: stored.fileIv,
      fileTag: stored.fileTag,
      fileHash: stored.fileHash,
      encryptedThumbnailPath: stored.relativeThumbnailPath,
      thumbnailIv: stored.thumbnailIv,
      thumbnailTag: stored.thumbnailTag,
      lastWornAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(photos).values(record);

    return {
      photoId,
      fileHash: stored.fileHash,
      isDuplicate: false,
      photo: record as Photo,
    };
  } finally {
    if (sourceUri && sourceUri.includes(FileSystem.cacheDirectory ?? '')) {
      await shredFile(sourceUri);
    }
  }
}

/**
 * Decrypts item and description fields for a photo row.
 * Throws if ciphertext/auth tag tampering is detected.
 */
export function getDecryptedPhotoMetadataStrict(
  photo: Photo,
  sessionKey: Buffer,
): DecryptedPhotoMetadata {
  let item = '';
  if (photo.encryptedItem && photo.itemIv && photo.itemTag) {
    item = decryptString(
      {
        ciphertext: photo.encryptedItem,
        iv: photo.itemIv,
        tag: photo.itemTag,
      },
      sessionKey,
      itemAad(photo.id),
    );
  }

  let description = '';
  if (photo.encryptedDescription && photo.descriptionIv && photo.descriptionTag) {
    description = decryptString(
      {
        ciphertext: photo.encryptedDescription,
        iv: photo.descriptionIv,
        tag: photo.descriptionTag,
      },
      sessionKey,
      descriptionAad(photo.id),
    );
  }

  return { item, description };
}

/**
 * Safe decryption wrapper returning empty strings if a legacy/corrupt field fails.
 */
export function getDecryptedPhotoMetadata(
  photo: Photo,
  sessionKey: Buffer,
): DecryptedPhotoMetadata {
  try {
    return getDecryptedPhotoMetadataStrict(photo, sessionKey);
  } catch {
    return { item: '', description: '' };
  }
}

/**
 * Updates encrypted metadata and/or wardrobe classification fields for a photo.
 */
export async function savePhotoMetadata(
  photoId: string,
  updates: {
    category?: WardrobeCategory;
    item?: string;
    description?: string;
    photoKind?: PhotoKind;
    aiHasHumanBody?: boolean | null;
  },
  sessionKey: Buffer,
): Promise<void> {
  const db = await getDatabase();
  const patch: Partial<typeof photos.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (updates.category !== undefined) {
    patch.category = normalizeWardrobeCategory(updates.category);
  }
  if (updates.photoKind !== undefined) {
    patch.photoKind = updates.photoKind;
  }
  if (updates.aiHasHumanBody !== undefined) {
    patch.aiHasHumanBody =
      updates.aiHasHumanBody === true ? 1 : updates.aiHasHumanBody === false ? 0 : null;
  }

  if (updates.item !== undefined) {
    const trimmed = updates.item.trim();
    if (!trimmed) {
      patch.encryptedItem = null;
      patch.itemIv = null;
      patch.itemTag = null;
    } else {
      const enc = encryptString(trimmed, sessionKey, itemAad(photoId));
      patch.encryptedItem = enc.ciphertext;
      patch.itemIv = enc.iv;
      patch.itemTag = enc.tag;
    }
  }

  if (updates.description !== undefined) {
    const trimmed = updates.description.trim();
    if (!trimmed) {
      patch.encryptedDescription = null;
      patch.descriptionIv = null;
      patch.descriptionTag = null;
    } else {
      const enc = encryptString(trimmed, sessionKey, descriptionAad(photoId));
      patch.encryptedDescription = enc.ciphertext;
      patch.descriptionIv = enc.iv;
      patch.descriptionTag = enc.tag;
    }
  }

  await db.update(photos).set(patch).where(eq(photos.id, photoId));
}

export async function movePhotoKind(photoId: string, targetKind: PhotoKind): Promise<void> {
  const db = await getDatabase();
  await db
    .update(photos)
    .set({ photoKind: targetKind, updatedAt: new Date() })
    .where(eq(photos.id, photoId));
}

export async function bulkMovePhotoKind(photoIds: string[], targetKind: PhotoKind): Promise<void> {
  if (photoIds.length === 0) return;
  const db = await getDatabase();
  await db
    .update(photos)
    .set({ photoKind: targetKind, updatedAt: new Date() })
    .where(inArray(photos.id, photoIds));
}

export async function bulkUpdateCategory(
  photoIds: string[],
  category: WardrobeCategory,
): Promise<void> {
  if (photoIds.length === 0) return;
  const db = await getDatabase();
  await db
    .update(photos)
    .set({ category: normalizeWardrobeCategory(category), updatedAt: new Date() })
    .where(inArray(photos.id, photoIds));
}

/**
 * Lists photos (optionally filtered by photoKind) with decrypted item & description metadata.
 */
export async function listPhotosWithMetadata(
  sessionKey: Buffer,
  photoKind?: PhotoKind,
): Promise<DecryptedPhotoRecord[]> {
  const db = await getDatabase();
  const rows = photoKind
    ? await db
        .select()
        .from(photos)
        .where(eq(photos.photoKind, photoKind))
        .orderBy(desc(photos.createdAt))
    : await db.select().from(photos).orderBy(desc(photos.createdAt));

  return rows.map((photo) => {
    const meta = getDecryptedPhotoMetadata(photo, sessionKey);
    return {
      photo,
      item: meta.item,
      description: meta.description,
    };
  });
}

/**
 * Shreds encrypted image files on disk and deletes the photo record.
 */
export async function deletePhoto(photoId: string): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
  if (rows.length === 0) return;

  const photo = rows[0];
  const resolvedFull = resolveResourcePath(photo.encryptedFilePath);
  if (resolvedFull) await shredFile(resolvedFull);

  const resolvedThumb = resolveResourcePath(photo.encryptedThumbnailPath);
  if (resolvedThumb) await shredFile(resolvedThumb);

  thumbnailCache.delete(photo.id);
  await db.delete(photos).where(eq(photos.id, photoId));
}

export async function bulkDeletePhotos(photoIds: string[]): Promise<void> {
  for (const id of photoIds) {
    await deletePhoto(id);
  }
}

/**
 * Parses AI vision classification output JSON cleanly.
 */
export function parseClassificationPayload(rawContent: string): PhotoAiClassification {
  const stripped = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(stripped) as Record<string, unknown>;
    const hasHumanBodyMainSubject = Boolean(parsed.hasHumanBodyMainSubject);
    const category = normalizeWardrobeCategory(
      typeof parsed.category === 'string' ? parsed.category : undefined,
    );
    const item = typeof parsed.item === 'string' ? parsed.item.trim() : '';
    const description =
      typeof parsed.description === 'string' ? parsed.description.trim() : rawContent.trim();

    return {
      hasHumanBodyMainSubject,
      photoKind: hasHumanBodyMainSubject ? 'past_ootd' : 'wardrobe',
      category,
      item,
      description,
    };
  } catch {
    return {
      hasHumanBodyMainSubject: false,
      photoKind: 'wardrobe',
      category: 'others',
      item: '',
      description: rawContent.trim(),
    };
  }
}

/**
 * Uses OpenRouter vision (1024px crisp image in-memory) to detect whether a human body is the
 * main subject (Wardrobe vs Past OOTD) and suggest category, item, and tactile description.
 */
export async function analyzeAndClassifyPhoto(
  photo: Photo,
  sessionKey: Buffer,
  personaPrompt?: string,
): Promise<PhotoAiClassification> {
  const imageBase64 = await prepareVisionImageDataUri({
    encryptedPath: photo.encryptedFilePath,
    iv: photo.fileIv,
    tag: photo.fileTag,
    sessionKey,
    aad: photo.id,
  });

  const prompt =
    'Inspect this fashion/wardrobe photo and respond ONLY with valid JSON containing:\n' +
    '{\n' +
    '  "hasHumanBodyMainSubject": boolean (true ONLY if a human person/body wearing an outfit or mirror try-on is the main subject; false for isolated garments, flat-lays, hangers, or accessories),\n' +
    '  "category": "top" | "bottom" | "underwear" | "hosiery" | "others",\n' +
    '  "item": short specific garment label such as "tshirt", "pants", "lace bra", "silk panties", "sheer thigh-highs", "heels",\n' +
    '  "description": concise tactile description covering color, fabric/texture feel, cut, fit, and mood\n' +
    '}';

  const response = await queryLlm({
    userPrompt: prompt,
    imageBase64,
    masterPrompt: personaPrompt,
    temperature: 0.3,
  });

  return parseClassificationPayload(response.content);
}
