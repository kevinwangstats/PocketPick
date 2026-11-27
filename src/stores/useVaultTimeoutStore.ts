import { create } from 'zustand';
import {
  getAutoLockTimeoutMinutes,
  setAutoLockTimeoutMinutes as persistTimeout,
  DEFAULT_AUTO_LOCK_MINUTES,
} from '../services/auth/autoLockService';

export interface VaultTimeoutState {
  timeoutMinutes: number;
  isLoaded: boolean;
  loadTimeout: () => Promise<void>;
  setTimeoutMinutes: (minutes: number) => Promise<void>;
}

export const useVaultTimeoutStore = create<VaultTimeoutState>((set) => ({
  timeoutMinutes: DEFAULT_AUTO_LOCK_MINUTES,
  isLoaded: false,

  loadTimeout: async () => {
    const mins = await getAutoLockTimeoutMinutes();
    set({ timeoutMinutes: mins, isLoaded: true });
  },

  setTimeoutMinutes: async (minutes: number) => {
    const integerVal = Math.floor(minutes);
    if (isNaN(integerVal) || integerVal < 0) {
      throw new Error('Timeout must be a non-negative integer');
    }
    await persistTimeout(integerVal);
    set({ timeoutMinutes: integerVal });
  },
}));

// Automatically trigger load on store initialization
useVaultTimeoutStore
  .getState()
  .loadTimeout()
  .catch(() => {});
