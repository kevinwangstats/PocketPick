import QuickCrypto from 'react-native-quick-crypto';
import { desc, eq } from 'drizzle-orm';
import { getDatabase } from '../../db/client';
import { historyLogs, HistoryLog, resources, Resource } from '../../db/schema';

export interface HistoryLogWithResource extends HistoryLog {
  resource: Resource | null;
}

/**
 * Atomically records a picker event into the history_logs table.
 */
export async function logPickTransaction(
  vaultId: string,
  resourceId: string,
  actionType: 'pick' | 're_pick' | 'discard',
  notes?: string,
): Promise<string> {
  const db = await getDatabase();
  const logId = QuickCrypto.randomBytes(16).toString('hex');
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(historyLogs).values({
      id: logId,
      vaultId,
      resourceId,
      actionType,
      notes: notes ?? null,
      selectedAt: now,
    });
  });

  return logId;
}

/**
 * Retrieves history logs in reverse chronological order, optionally filtered by vault.
 */
export async function getHistoryLogs(
  vaultId?: string,
  limit: number = 50,
  offset: number = 0,
): Promise<HistoryLogWithResource[]> {
  const db = await getDatabase();

  const query = db
    .select({
      id: historyLogs.id,
      vaultId: historyLogs.vaultId,
      resourceId: historyLogs.resourceId,
      selectedAt: historyLogs.selectedAt,
      actionType: historyLogs.actionType,
      notes: historyLogs.notes,
      resource: resources,
    })
    .from(historyLogs)
    .leftJoin(resources, eq(historyLogs.resourceId, resources.id))
    .orderBy(desc(historyLogs.selectedAt))
    .limit(limit)
    .offset(offset);

  if (vaultId) {
    const results = await query.where(eq(historyLogs.vaultId, vaultId));
    return results;
  }

  const results = await query;
  return results;
}

/**
 * Deletes a single history log entry.
 */
export async function deleteHistoryLog(logId: string): Promise<void> {
  const db = await getDatabase();
  await db.delete(historyLogs).where(eq(historyLogs.id, logId));
}

/**
 * Clears all history logs for a specific vault.
 */
export async function clearVaultHistory(vaultId: string): Promise<void> {
  const db = await getDatabase();
  await db.delete(historyLogs).where(eq(historyLogs.vaultId, vaultId));
}
