import * as SecureStore from 'expo-secure-store';
import {
  getVaultTimeoutMinutes,
  setVaultTimeoutMinutes,
  DEFAULT_VAULT_TIMEOUT_MINUTES,
  VAULT_TIMEOUT_STORAGE_KEY,
} from '../../src/services/vault/vaultTimeoutService';

describe('vaultTimeoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default 5 minutes if no value stored in SecureStore', async () => {
    jest.spyOn(SecureStore, 'getItemAsync').mockResolvedValueOnce(null);
    const timeout = await getVaultTimeoutMinutes();
    expect(timeout).toBe(DEFAULT_VAULT_TIMEOUT_MINUTES);
  });

  it('returns parsed integer from SecureStore', async () => {
    jest.spyOn(SecureStore, 'getItemAsync').mockResolvedValueOnce('15');
    const timeout = await getVaultTimeoutMinutes();
    expect(timeout).toBe(15);
  });

  it('persists valid integer minutes to SecureStore', async () => {
    const spy = jest.spyOn(SecureStore, 'setItemAsync').mockResolvedValueOnce();
    await setVaultTimeoutMinutes(30);
    expect(spy).toHaveBeenCalledWith(VAULT_TIMEOUT_STORAGE_KEY, '30');
  });

  it('rejects negative numbers or NaN', async () => {
    await expect(setVaultTimeoutMinutes(-5)).rejects.toThrow(
      'Vault timeout must be a non-negative integer',
    );
    await expect(setVaultTimeoutMinutes(NaN)).rejects.toThrow(
      'Vault timeout must be a non-negative integer',
    );
  });
});
