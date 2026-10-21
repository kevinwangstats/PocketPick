import { create } from 'zustand';
import {
  getVaultTimeoutMinutes,
  setVaultTimeoutMinutes as persistTimeout,
  DEFAULT_VAULT_TIMEOUT_MINUTES,
} from '../services/vault/vaultTimeoutService';

export interface VaultTimeoutState {
  timeoutMinutes: number;
  isLoaded: boolean;
  loadTimeout: () => Promise<void>;
  setTimeoutMinutes: (minutes: number) => Promise<void>;
}

export const useVaultTimeoutStore = create<VaultTimeoutState>((set) => ({
  timeoutMinutes: DEFAULT_VAULT_TIMEOUT_MINUTES,
  isLoaded: false,

  loadTimeout: async () => {
    const mins = await getVaultTimeoutMinutes();
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
