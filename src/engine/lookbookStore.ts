import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';
import { eq, desc, inArray } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { ootdLooks, OotdLook, photos } from '../db/schema';
import { encryptString, decryptString } from '../crypto/cipher';
import { DecryptedOotdLook, OotdSlotSelection, OotdTriggerType } from './types';

function slotsAad(lookId: string): string {
  return `${lookId}:slots`;
}

/**
 * Decrypts and parses OOTD look slots strictly (throws on 1-byte tampering).
 */
export function decryptLookSlotsStrict(look: OotdLook, sessionKey: Buffer): OotdSlotSelection[] {
  const plaintext = decryptString(
    {
      ciphertext: look.encryptedSlots,
      iv: look.slotsIv,
      tag: look.slotsTag,
    },
    sessionKey,
    slotsAad(look.id),
  );
  return JSON.parse(plaintext) as OotdSlotSelection[];
}

/**
 * Saves an encrypted OOTD look into SQLCipher with snapshotted item tombstones.
 */
export async function saveOotdLook(params: {
  personId: string;
  triggerType: OotdTriggerType;
  slots: OotdSlotSelection[];
  sessionKey: Buffer;
  isFavorite?: boolean;
  wornAt?: Date | null;
}): Promise<DecryptedOotdLook> {
  const id = QuickCrypto.randomBytes(16).toString('hex');
  const now = new Date();
  const encrypted = encryptString(JSON.stringify(params.slots), params.sessionKey, slotsAad(id));

  const db = await getDatabase();
  const record: typeof ootdLooks.$inferInsert = {
    id,
    personId: params.personId,
    triggerType: params.triggerType,
    encryptedSlots: encrypted.ciphertext,
    slotsIv: encrypted.iv,
    slotsTag: encrypted.tag,
    isFavorite: params.isFavorite ? 1 : 0,
    wornAt: params.wornAt ?? null,
    fitcheckPhotoId: null,
    createdAt: now,
  };

  await db.insert(ootdLooks).values(record);

  return {
    id,
    personId: params.personId,
    triggerType: params.triggerType,
    slots: params.slots,
    isFavorite: Boolean(params.isFavorite),
    wornAt: params.wornAt ?? null,
    fitcheckPhotoId: null,
    createdAt: now,
  };
}

export async function updateOotdLookSlots(
  lookId: string,
  slots: OotdSlotSelection[],
  sessionKey: Buffer,
): Promise<void> {
  const encrypted = encryptString(JSON.stringify(slots), sessionKey, slotsAad(lookId));
  const db = await getDatabase();
  await db
    .update(ootdLooks)
    .set({
      encryptedSlots: encrypted.ciphertext,
      slotsIv: encrypted.iv,
      slotsTag: encrypted.tag,
    })
    .where(eq(ootdLooks.id, lookId));
}

/**
 * Hydrates OOTD slots with tombstone detection if any referenced wardrobe photo was deleted.
 */
export async function hydrateSlotsWithTombstones(
  slots: OotdSlotSelection[],
): Promise<OotdSlotSelection[]> {
  const referencedIds = slots.map((s) => s.photoId).filter((id): id is string => Boolean(id));

  if (referencedIds.length === 0) {
    return slots;
  }

  const db = await getDatabase();
  const existingRows = await db
    .select({ id: photos.id })
    .from(photos)
    .where(inArray(photos.id, referencedIds));
  const existingSet = new Set(existingRows.map((r) => r.id));

  return slots.map((slot) => {
    if (slot.photoId && !existingSet.has(slot.photoId)) {
      return {
        ...slot,
        isMissing: true,
        thumbnailPath: null,
        thumbnailIv: null,
        thumbnailTag: null,
      };
    }
    return slot;
  });
}

export async function getOotdLookById(
  lookId: string,
  sessionKey: Buffer,
): Promise<DecryptedOotdLook | null> {
  const db = await getDatabase();
  const rows = await db.select().from(ootdLooks).where(eq(ootdLooks.id, lookId)).limit(1);
  if (rows.length === 0) return null;

  const row = rows[0];
  const rawSlots = decryptLookSlotsStrict(row, sessionKey);
  const slots = await hydrateSlotsWithTombstones(rawSlots);

  return {
    id: row.id,
    personId: row.personId,
    triggerType: row.triggerType,
    slots,
    isFavorite: row.isFavorite === 1,
    wornAt: row.wornAt ?? null,
    fitcheckPhotoId: row.fitcheckPhotoId ?? null,
    createdAt: row.createdAt,
  };
}

export async function listOotdLooks(
  sessionKey: Buffer,
  filter?: { personId?: string; favoritesOnly?: boolean },
): Promise<DecryptedOotdLook[]> {
  const db = await getDatabase();
  const rows = await db.select().from(ootdLooks).orderBy(desc(ootdLooks.createdAt));

  const results: DecryptedOotdLook[] = [];
  for (const row of rows) {
    if (filter?.personId && row.personId !== filter.personId) continue;
    if (filter?.favoritesOnly && row.isFavorite !== 1) continue;

    try {
      const rawSlots = decryptLookSlotsStrict(row, sessionKey);
      const slots = await hydrateSlotsWithTombstones(rawSlots);
      results.push({
        id: row.id,
        personId: row.personId,
        triggerType: row.triggerType,
        slots,
        isFavorite: row.isFavorite === 1,
        wornAt: row.wornAt ?? null,
        fitcheckPhotoId: row.fitcheckPhotoId ?? null,
        createdAt: row.createdAt,
      });
    } catch {
      // Skip corrupted row
    }
  }

  return results;
}

export async function toggleLookFavorite(lookId: string, isFavorite: boolean): Promise<void> {
  const db = await getDatabase();
  await db
    .update(ootdLooks)
    .set({ isFavorite: isFavorite ? 1 : 0 })
    .where(eq(ootdLooks.id, lookId));
}

export async function markLookWornToday(lookId: string, photoIds: string[]): Promise<void> {
  const now = new Date();
  const db = await getDatabase();
  await db.update(ootdLooks).set({ wornAt: now }).where(eq(ootdLooks.id, lookId));

  const validPhotoIds = photoIds.filter(Boolean);
  if (validPhotoIds.length > 0) {
    await db.update(photos).set({ lastWornAt: now }).where(inArray(photos.id, validPhotoIds));
  }
}

export async function linkFitCheckPhoto(lookId: string, fitcheckPhotoId: string): Promise<void> {
  const db = await getDatabase();
  await db.update(ootdLooks).set({ fitcheckPhotoId }).where(eq(ootdLooks.id, lookId));
}
