import * as SecureStore from 'expo-secure-store';

export const VAULT_TIMEOUT_STORAGE_KEY = 'POCKETPICK_VAULT_TIMEOUT_MINUTES';
export const DEFAULT_VAULT_TIMEOUT_MINUTES = 5;

/**
 * Retrieves the configured vault auto-lock timeout in minutes.
 * Defaults to 5 minutes if not configured or invalid.
 */
export async function getVaultTimeoutMinutes(): Promise<number> {
  try {
    const value = await SecureStore.getItemAsync(VAULT_TIMEOUT_STORAGE_KEY);
    if (value !== null) {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to retrieve vault timeout from SecureStore:', err);
  }
  return DEFAULT_VAULT_TIMEOUT_MINUTES;
}

/**
 * Saves the vault auto-lock timeout in minutes as an integer.
 * @param minutes Non-negative integer representing timeout in minutes (0 = immediate on background)
 */
export async function setVaultTimeoutMinutes(minutes: number): Promise<void> {
  const integerVal = Math.floor(minutes);
  if (isNaN(integerVal) || integerVal < 0) {
    throw new Error('Vault timeout must be a non-negative integer');
  }
  await SecureStore.setItemAsync(VAULT_TIMEOUT_STORAGE_KEY, integerVal.toString());
}
