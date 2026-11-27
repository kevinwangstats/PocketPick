import * as SecureStore from 'expo-secure-store';
import {
  getAutoLockTimeoutMinutes,
  setAutoLockTimeoutMinutes,
  DEFAULT_AUTO_LOCK_MINUTES,
  AUTO_LOCK_STORAGE_KEY,
} from '@/services/auth/autoLockService';

describe('autoLockService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default 15 minutes if no value stored in SecureStore', async () => {
    jest.spyOn(SecureStore, 'getItemAsync').mockResolvedValueOnce(null);
    const timeout = await getAutoLockTimeoutMinutes();
    expect(timeout).toBe(DEFAULT_AUTO_LOCK_MINUTES);
    expect(timeout).toBe(15);
  });

  it('returns parsed integer from SecureStore', async () => {
    jest.spyOn(SecureStore, 'getItemAsync').mockResolvedValueOnce('30');
    const timeout = await getAutoLockTimeoutMinutes();
    expect(timeout).toBe(30);
  });

  it('persists valid integer minutes to SecureStore', async () => {
    const spy = jest.spyOn(SecureStore, 'setItemAsync').mockResolvedValueOnce();
    await setAutoLockTimeoutMinutes(10);
    expect(spy).toHaveBeenCalledWith(AUTO_LOCK_STORAGE_KEY, '10');
  });

  it('rejects negative numbers or NaN', async () => {
    await expect(setAutoLockTimeoutMinutes(-5)).rejects.toThrow(
      'Auto-lock timeout must be a non-negative integer',
    );
    await expect(setAutoLockTimeoutMinutes(NaN)).rejects.toThrow(
      'Auto-lock timeout must be a non-negative integer',
    );
  });
});
