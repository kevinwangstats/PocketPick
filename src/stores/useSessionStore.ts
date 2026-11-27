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

  setAppSessionKey: (key: Buffer) => {
    const prevKey = get().appSessionKey;
    if (prevKey && prevKey !== key) {
      zeroizeBuffer(prevKey);
    }
    const now = Date.now();
    set({
      appSessionKey: key,
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
      isUnlocked: false,
      unlockedAt: null,
      lastActiveTimestamp: null,
    });
  },

  touchActivity: () => {
    if (!get().appSessionKey) return;
    set({ lastActiveTimestamp: Date.now() });
  },
}));
