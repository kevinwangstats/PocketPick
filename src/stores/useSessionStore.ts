import { create } from 'zustand';
import { Buffer } from '@craftzdog/react-native-buffer';
import { zeroizeBuffer } from '../crypto/zeroize';

export interface SessionState {
  activeVaultId: string | null;
  activeVaultKey: Buffer | null;
  lastActiveTimestamp: number | null;
  unlockedAt: number | null;
  setActiveVault: (vaultId: string, key: Buffer) => void;
  lockVault: () => void;
  touchActivity: () => void;
}

/**
 * Ephemeral Session Key Store.
 * INVARIANT: This store is STRICTLY in-memory. It must NEVER be wrapped in persistent storage
 * (AsyncStorage, SecureStore, SQLite). The active key buffer is zeroized upon lock or switch.
 */
export const useSessionStore = create<SessionState>((set, get) => ({
  activeVaultId: null,
  activeVaultKey: null,
  lastActiveTimestamp: null,
  unlockedAt: null,

  setActiveVault: (vaultId: string, key: Buffer) => {
    const prevKey = get().activeVaultKey;
    if (prevKey) {
      zeroizeBuffer(prevKey);
    }
    const now = Date.now();
    set({
      activeVaultId: vaultId,
      activeVaultKey: key,
      unlockedAt: now,
      lastActiveTimestamp: now,
    });
  },

  lockVault: () => {
    const currentKey = get().activeVaultKey;
    if (currentKey) {
      zeroizeBuffer(currentKey);
    }
    set({
      activeVaultId: null,
      activeVaultKey: null,
      unlockedAt: null,
      lastActiveTimestamp: null,
    });
  },

  touchActivity: () => {
    set({ lastActiveTimestamp: Date.now() });
  },
}));
