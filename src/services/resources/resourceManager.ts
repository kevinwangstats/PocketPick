import * as FileSystem from 'expo-file-system/legacy';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../../db/client';
import { resources, vaults, historyLogs } from '../../db/schema';
import { shredFile } from '../media/fileShredder';
import { thumbnailCache } from '../media/thumbnailCache';

/**
 * Securely deletes a single resource (ticket or photo).
 * For photos, the .enc ciphertext file and .enc thumbnail are cryptographically shredded
 * on disk before the database row is deleted.
 */
export async function deleteResource(resourceId: string): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select().from(resources).where(eq(resources.id, resourceId));

  if (!rows || rows.length === 0) {
    return;
  }

  const resource = rows[0];

  if (resource.type === 'photo') {
    if (resource.encryptedFilePath) {
      await shredFile(resource.encryptedFilePath);
    }
    if (resource.encryptedThumbnailPath) {
      await shredFile(resource.encryptedThumbnailPath);
    }
    thumbnailCache.delete(resource.id);
  }

  await db.delete(resources).where(eq(resources.id, resourceId));
}

/**
 * Securely deletes an entire vault:
 * 1. Finds all photo resources in the vault and shreds each .enc file on disk.
 * 2. Deletes the physical directory `${documentDirectory}vaults/${vaultId}/`.
 * 3. Deletes the vault row from SQLite, triggering cascade deletion for resources and logs.
 */
export async function deleteVault(vaultId: string): Promise<void> {
  const db = await getDatabase();
  const vaultPhotos = await db.select().from(resources).where(eq(resources.vaultId, vaultId));

  for (const item of vaultPhotos) {
    if (item.type === 'photo') {
      if (item.encryptedFilePath) {
        await shredFile(item.encryptedFilePath);
      }
      if (item.encryptedThumbnailPath) {
        await shredFile(item.encryptedThumbnailPath);
      }
      thumbnailCache.delete(item.id);
    }
  }

  const vaultDir = `${FileSystem.documentDirectory}vaults/${vaultId}/`;
  try {
    await FileSystem.deleteAsync(vaultDir, { idempotent: true });
  } catch {
    // Ignore if directory did not exist
  }

  await db.delete(historyLogs).where(eq(historyLogs.vaultId, vaultId));
  await db.delete(resources).where(eq(resources.vaultId, vaultId));
  await db.delete(vaults).where(eq(vaults.id, vaultId));
}
