import {
  getOrCreateDatabaseMasterKey,
  deleteDatabaseMasterKey,
  DB_MASTER_KEY_ALIAS,
} from '@/db/security';
import { getSecureItem } from '@/services/storage/secureStore';
import { mockSecureStore } from '../mocks/secure-store.mock';

describe('Database Security & Master Key Lifecycle', () => {
  beforeEach(async () => {
    mockSecureStore._reset();
  });

  it('generates a valid 256-bit (64-char hex) master key on first invocation', async () => {
    const key = await getOrCreateDatabaseMasterKey();
    expect(key).toBeDefined();
    expect(typeof key).toBe('string');
    expect(key).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);

    const storedKey = await getSecureItem(DB_MASTER_KEY_ALIAS);
    expect(storedKey).toBe(key);
  });

  it('returns the existing key on subsequent calls without regenerating', async () => {
    const firstKey = await getOrCreateDatabaseMasterKey();
    const secondKey = await getOrCreateDatabaseMasterKey();
    expect(secondKey).toBe(firstKey);
  });

  it('generates a new key after the key is deleted', async () => {
    const originalKey = await getOrCreateDatabaseMasterKey();
    await deleteDatabaseMasterKey();
    const storedAfterDelete = await getSecureItem(DB_MASTER_KEY_ALIAS);
    expect(storedAfterDelete).toBeNull();

    const regeneratedKey = await getOrCreateDatabaseMasterKey();
    expect(regeneratedKey).toHaveLength(64);
    expect(regeneratedKey).not.toBe(originalKey);
  });
});
