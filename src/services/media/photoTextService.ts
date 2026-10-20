import { eq } from 'drizzle-orm';
import { Buffer } from '@craftzdog/react-native-buffer';
import { getDatabase } from '../../db/client';
import { resources, Resource } from '../../db/schema';
import { encryptString, decryptString } from '../../crypto/cipher';

/**
 * Saves and updates the associated text for a photo resource.
 * The text is encrypted using AES-256-GCM with the vault session key
 * and stored in the encrypted_payload column of the resource row.
 */
export async function savePhotoText(
  resourceId: string,
  text: string,
  vaultKey: Buffer,
  vaultId: string,
): Promise<void> {
  const db = await getDatabase();
  const trimmed = text.trim();

  if (!trimmed) {
    // If text is cleared, clear payload fields
    await db
      .update(resources)
      .set({
        encryptedPayload: null,
        payloadIv: null,
        payloadTag: null,
        updatedAt: new Date(),
      })
      .where(eq(resources.id, resourceId));
    return;
  }

  // Authenticated encryption of the associated text
  const encrypted = encryptString(trimmed, vaultKey, vaultId);

  await db
    .update(resources)
    .set({
      encryptedPayload: encrypted.ciphertext,
      payloadIv: encrypted.iv,
      payloadTag: encrypted.tag,
      updatedAt: new Date(),
    })
    .where(eq(resources.id, resourceId));
}

/**
 * Decrypts and retrieves the associated text for a photo resource.
 * Returns null if no associated text is saved or if decryption fails.
 */
export function getPhotoText(resource: Resource, vaultKey: Buffer): string | null {
  if (!resource.encryptedPayload || !resource.payloadIv || !resource.payloadTag) {
    return null;
  }

  try {
    return decryptString(
      {
        ciphertext: resource.encryptedPayload,
        iv: resource.payloadIv,
        tag: resource.payloadTag,
      },
      vaultKey,
      resource.vaultId,
    );
  } catch {
    return null;
  }
}
