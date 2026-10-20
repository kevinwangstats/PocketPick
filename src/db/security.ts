import QuickCrypto from 'react-native-quick-crypto';
import { getSecureItem, setSecureItem, deleteSecureItem } from '../services/storage/secureStore';

export const DB_MASTER_KEY_ALIAS = 'POCKETPICK_DB_MASTER_KEY';

/**
 * Retrieves or initializes the 256-bit SQLCipher master database key from SecureStore.
 * The key is generated using CSPRNG (QuickCrypto.randomBytes) and stored in iOS Keychain.
 */
export async function getOrCreateDatabaseMasterKey(): Promise<string> {
  const existingKey = await getSecureItem(DB_MASTER_KEY_ALIAS);
  if (existingKey && existingKey.trim().length === 64) {
    return existingKey;
  }

  // Generate 256-bit (32 bytes = 64 hex characters) cryptographic key
  const randomBuffer = QuickCrypto.randomBytes(32);
  const newKey = randomBuffer.toString('hex');

  await setSecureItem(DB_MASTER_KEY_ALIAS, newKey);
  return newKey;
}

/**
 * Deletes the database master key from SecureStore (used for test teardown).
 */
export async function deleteDatabaseMasterKey(): Promise<void> {
  await deleteSecureItem(DB_MASTER_KEY_ALIAS);
}
