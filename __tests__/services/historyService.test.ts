import {
  logPickTransaction,
  getHistoryLogs,
  deleteHistoryLog,
  clearVaultHistory,
} from '@/services/history/historyService';
import { getDatabase, closeDatabase } from '@/db/client';

describe('History Service (Atomic Logging & Queries)', () => {
  const vaultId = 'test-vault-hist-001';
  const resourceId = 'test-res-hist-001';

  beforeEach(() => {
    closeDatabase();
  });

  afterEach(() => {
    closeDatabase();
  });

  it('atomically logs a pick transaction', async () => {
    const db = await getDatabase();
    const transactionSpy = jest.spyOn(db, 'transaction');

    const logId = await logPickTransaction(vaultId, resourceId, 'pick', 'First pick of the day');

    expect(logId).toBeDefined();
    expect(typeof logId).toBe('string');
    expect(transactionSpy).toHaveBeenCalled();
  });

  it('queries history logs with order and limits', async () => {
    const db = await getDatabase();
    const selectSpy = jest.spyOn(db, 'select');

    const logs = await getHistoryLogs(vaultId, 20, 0);

    expect(selectSpy).toHaveBeenCalled();
    expect(Array.isArray(logs)).toBe(true);
  });

  it('deletes a single history log', async () => {
    const db = await getDatabase();
    const deleteSpy = jest.spyOn(db, 'delete');

    await deleteHistoryLog('log-to-delete-123');

    expect(deleteSpy).toHaveBeenCalled();
  });

  it('clears all history for a vault', async () => {
    const db = await getDatabase();
    const deleteSpy = jest.spyOn(db, 'delete');

    await clearVaultHistory(vaultId);

    expect(deleteSpy).toHaveBeenCalled();
  });
});
