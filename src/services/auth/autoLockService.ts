import * as SecureStore from 'expo-secure-store';

export const AUTO_LOCK_STORAGE_KEY = 'POCKETPICK_VAULT_TIMEOUT_MINUTES';
export const DEFAULT_AUTO_LOCK_MINUTES = 15;

/**
 * Retrieves the configured inactivity auto-lock timeout in minutes.
 * Defaults to 15 minutes if not configured or invalid.
 */
export async function getAutoLockTimeoutMinutes(): Promise<number> {
  try {
    const value = await SecureStore.getItemAsync(AUTO_LOCK_STORAGE_KEY);
    if (value !== null) {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to retrieve auto-lock timeout from SecureStore:', err);
  }
  return DEFAULT_AUTO_LOCK_MINUTES;
}

/**
 * Saves the inactivity auto-lock timeout in minutes as a non-negative integer.
 * @param minutes Non-negative integer (0 = immediate lock on background)
 */
export async function setAutoLockTimeoutMinutes(minutes: number): Promise<void> {
  const integerVal = Math.floor(minutes);
  if (isNaN(integerVal) || integerVal < 0) {
    throw new Error('Auto-lock timeout must be a non-negative integer');
  }
  await SecureStore.setItemAsync(AUTO_LOCK_STORAGE_KEY, integerVal.toString());
}
