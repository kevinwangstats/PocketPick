import { vaults, resources, historyLogs, apiQuotas } from '@/db/schema';
import { getDatabase, closeDatabase } from '@/db/client';
import { open } from '@op-engineering/op-sqlite';

describe('Drizzle Schema & Database Client Initialization', () => {
  beforeEach(() => {
    closeDatabase();
    jest.clearAllMocks();
  });

  afterEach(() => {
    closeDatabase();
  });

  it('defines valid table schema configurations', () => {
    expect(vaults).toBeDefined();
    expect(resources).toBeDefined();
    expect(historyLogs).toBeDefined();
    expect(apiQuotas).toBeDefined();

    // Verify key columns
    expect(vaults.id).toBeDefined();
    expect(vaults.salt).toBeDefined();
    expect(vaults.verifierCipher).toBeDefined();

    expect(resources.vaultId).toBeDefined();
    expect(resources.type).toBeDefined();
    expect(resources.weight).toBeDefined();

    expect(historyLogs.vaultId).toBeDefined();
    expect(historyLogs.actionType).toBeDefined();

    expect(apiQuotas.periodMonth).toBeDefined();
    expect(apiQuotas.requestCount).toBeDefined();
  });

  it('initializes the database with SQLCipher encryption key and runs table creation', async () => {
    const db = await getDatabase();
    expect(db).toBeDefined();

    // Verify open was called with pocketpick.db and a 64-character hex encryption key
    expect(open).toHaveBeenCalledTimes(1);
    const openCall = (open as jest.Mock).mock.calls[0][0];
    expect(openCall.name).toBe('pocketpick.db');
    expect(openCall.encryptionKey).toHaveLength(64);
  });

  it('returns singleton database instance on repeated getDatabase calls', async () => {
    const db1 = await getDatabase();
    const db2 = await getDatabase();
    expect(db1).toBe(db2);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
