import { create } from 'zustand';
import { Buffer } from '@craftzdog/react-native-buffer';
import { zeroizeBuffer } from '../crypto/zeroize';

export interface SessionState {
  appSessionKey: Buffer | null;
  isUnlocked: boolean;
  lastActiveTimestamp: number | null;
  unlockedAt: number | null;
  setAppSessionKey: (key: Buffer) => void;
  lockApp: () => void;
  touchActivity: () => void;

  /** @deprecated Removed in Task 2.3 legacy purge */
  activeVaultId: string | null;
  /** @deprecated Removed in Task 2.3 legacy purge */
  activeVaultKey: Buffer | null;
  /** @deprecated Removed in Task 2.3 legacy purge */
  setActiveVault: (vaultId: string, key: Buffer) => void;
  /** @deprecated Removed in Task 2.3 legacy purge */
  lockVault: () => void;
}

/**
 * Ephemeral Session Key Store.
 * INVARIANT: This store is STRICTLY in-memory. It must NEVER be wrapped in persistent storage
 * (AsyncStorage, SecureStore, SQLite). The active key buffer is zeroized upon lock or switch.
 */
export const useSessionStore = create<SessionState>((set, get) => ({
  appSessionKey: null,
  isUnlocked: false,
  lastActiveTimestamp: null,
  unlockedAt: null,
  activeVaultId: null,
  activeVaultKey: null,

  setAppSessionKey: (key: Buffer) => {
    const prevKey = get().appSessionKey;
    if (prevKey && prevKey !== key) {
      zeroizeBuffer(prevKey);
    }
    const now = Date.now();
    set({
      appSessionKey: key,
      activeVaultKey: key,
      activeVaultId: 'app',
      isUnlocked: true,
      unlockedAt: now,
      lastActiveTimestamp: now,
    });
  },

  lockApp: () => {
    const currentKey = get().appSessionKey;
    if (currentKey) {
      zeroizeBuffer(currentKey);
    }
    set({
      appSessionKey: null,
      activeVaultId: null,
      activeVaultKey: null,
      isUnlocked: false,
      unlockedAt: null,
      lastActiveTimestamp: null,
    });
  },

  touchActivity: () => {
    if (!get().appSessionKey) return;
    set({ lastActiveTimestamp: Date.now() });
  },

  setActiveVault: (vaultId: string, key: Buffer) => {
    const prevKey = get().appSessionKey;
    if (prevKey && prevKey !== key) {
      zeroizeBuffer(prevKey);
    }
    const now = Date.now();
    set({
      appSessionKey: key,
      activeVaultId: vaultId,
      activeVaultKey: key,
      isUnlocked: true,
      unlockedAt: now,
      lastActiveTimestamp: now,
    });
  },

  lockVault: () => {
    get().lockApp();
  },
}));
