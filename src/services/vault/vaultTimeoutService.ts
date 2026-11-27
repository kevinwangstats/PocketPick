import {
  AUTO_LOCK_STORAGE_KEY,
  DEFAULT_AUTO_LOCK_MINUTES,
  getAutoLockTimeoutMinutes,
  setAutoLockTimeoutMinutes,
} from '../auth/autoLockService';

/** @deprecated Removed in Task 2.3 legacy purge */
export const VAULT_TIMEOUT_STORAGE_KEY = AUTO_LOCK_STORAGE_KEY;
/** @deprecated Removed in Task 2.3 legacy purge */
export const DEFAULT_VAULT_TIMEOUT_MINUTES = DEFAULT_AUTO_LOCK_MINUTES;

/** @deprecated Removed in Task 2.3 legacy purge */
export async function getVaultTimeoutMinutes(): Promise<number> {
  return getAutoLockTimeoutMinutes();
}

/** @deprecated Removed in Task 2.3 legacy purge */
export async function setVaultTimeoutMinutes(minutes: number): Promise<void> {
  const integerVal = Math.floor(minutes);
  if (isNaN(integerVal) || integerVal < 0) {
    throw new Error('Vault timeout must be a non-negative integer');
  }
  await setAutoLockTimeoutMinutes(integerVal);
}
