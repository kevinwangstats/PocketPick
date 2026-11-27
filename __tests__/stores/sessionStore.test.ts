import { useSessionStore } from '@/stores/useSessionStore';
import QuickCrypto from 'react-native-quick-crypto';

describe('Ephemeral useSessionStore (Zustand) & Memory Zeroization', () => {
  beforeEach(() => {
    useSessionStore.getState().lockApp();
  });

  it('initializes locked with null appSessionKey', () => {
    const state = useSessionStore.getState();
    expect(state.isUnlocked).toBe(false);
    expect(state.appSessionKey).toBeNull();
    expect(state.lastActiveTimestamp).toBeNull();
    expect(state.unlockedAt).toBeNull();
  });

  it('sets unified appSessionKey, records timestamps, and marks unlocked', () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setAppSessionKey(key);

    const state = useSessionStore.getState();
    expect(state.isUnlocked).toBe(true);
    expect(state.appSessionKey).toBe(key);
    expect(state.lastActiveTimestamp).toBeGreaterThan(0);
    expect(state.unlockedAt).toBeGreaterThan(0);
  });

  it('zeroizes the session key buffer when lockApp is called', () => {
    const key = QuickCrypto.randomBytes(32);
    const keyCopy = Buffer.from(key);

    useSessionStore.getState().setAppSessionKey(key);
    expect(key.equals(Buffer.alloc(32, 0))).toBe(false);

    useSessionStore.getState().lockApp();

    const state = useSessionStore.getState();
    expect(state.isUnlocked).toBe(false);
    expect(state.appSessionKey).toBeNull();
    expect(state.unlockedAt).toBeNull();
    expect(key.equals(Buffer.alloc(32, 0))).toBe(true);
    expect(key.equals(keyCopy)).toBe(false);
  });

  it('zeroizes previous key buffer when rotating session key', () => {
    const key1 = QuickCrypto.randomBytes(32);
    const key2 = QuickCrypto.randomBytes(32);

    useSessionStore.getState().setAppSessionKey(key1);
    useSessionStore.getState().setAppSessionKey(key2);

    expect(key1.equals(Buffer.alloc(32, 0))).toBe(true);
    expect(useSessionStore.getState().appSessionKey).toBe(key2);
  });

  it('updates lastActiveTimestamp on touchActivity while unlocked', async () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setAppSessionKey(key);
    const initialTimestamp = useSessionStore.getState().lastActiveTimestamp;

    await new Promise((resolve) => setTimeout(resolve, 10));
    useSessionStore.getState().touchActivity();
    const updatedTimestamp = useSessionStore.getState().lastActiveTimestamp;

    expect(updatedTimestamp).toBeGreaterThanOrEqual(initialTimestamp!);
  });
});
