import { create } from 'zustand';
import { Buffer } from '@craftzdog/react-native-buffer';
import { zeroizeBuffer } from '../crypto/zeroize';

export interface SessionState {
  activeVaultId: string | null;
  activeVaultKey: Buffer | null;
  lastActiveTimestamp: number | null;
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

  setActiveVault: (vaultId: string, key: Buffer) => {
    const prevKey = get().activeVaultKey;
    if (prevKey) {
      zeroizeBuffer(prevKey);
    }
    set({
      activeVaultId: vaultId,
      activeVaultKey: key,
      lastActiveTimestamp: Date.now(),
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
      lastActiveTimestamp: null,
    });
  },

  touchActivity: () => {
    set({ lastActiveTimestamp: Date.now() });
  },
}));
