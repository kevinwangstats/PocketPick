import * as SecureStore from 'expo-secure-store';

export const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/**
 * Retrieve a string from the iOS Keychain / device secure storage.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  return await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
}

/**
 * Store a sensitive string in the iOS Keychain with device-only accessibility.
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
}

/**
 * Delete a sensitive string from the iOS Keychain.
 */
export async function deleteSecureItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
}
