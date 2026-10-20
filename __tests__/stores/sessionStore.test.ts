import { useSessionStore } from '@/stores/useSessionStore';
import QuickCrypto from 'react-native-quick-crypto';

describe('Ephemeral useSessionStore (Zustand) & Memory Zeroization', () => {
  beforeEach(() => {
    useSessionStore.getState().lockVault();
  });

  it('initializes with null active vault and key', () => {
    const state = useSessionStore.getState();
    expect(state.activeVaultId).toBeNull();
    expect(state.activeVaultKey).toBeNull();
    expect(state.lastActiveTimestamp).toBeNull();
  });

  it('sets active vault and stores the key in memory', () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setActiveVault('vault-001', key);

    const state = useSessionStore.getState();
    expect(state.activeVaultId).toBe('vault-001');
    expect(state.activeVaultKey).toBe(key);
    expect(state.lastActiveTimestamp).toBeGreaterThan(0);
  });

  // CRITICAL SECURITY INVARIANT: Zeroization verification
  it('zeroizes the key buffer when lockVault is called', () => {
    const key = QuickCrypto.randomBytes(32);
    const keyCopy = Buffer.from(key);

    useSessionStore.getState().setActiveVault('vault-001', key);
    expect(key.equals(Buffer.alloc(32, 0))).toBe(false);

    useSessionStore.getState().lockVault();

    const state = useSessionStore.getState();
    expect(state.activeVaultId).toBeNull();
    expect(state.activeVaultKey).toBeNull();

    // Verify the original key buffer in memory was completely wiped with 0x00
    expect(key.equals(Buffer.alloc(32, 0))).toBe(true);
    expect(key.equals(keyCopy)).toBe(false);
  });

  it('zeroizes previous key buffer when switching to a new vault', () => {
    const key1 = QuickCrypto.randomBytes(32);
    const key2 = QuickCrypto.randomBytes(32);

    useSessionStore.getState().setActiveVault('vault-001', key1);
    useSessionStore.getState().setActiveVault('vault-002', key2);

    // key1 must now be zeroed
    expect(key1.equals(Buffer.alloc(32, 0))).toBe(true);

    // key2 must be active
    const state = useSessionStore.getState();
    expect(state.activeVaultId).toBe('vault-002');
    expect(state.activeVaultKey).toBe(key2);
  });

  it('updates timestamp on touchActivity', async () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setActiveVault('vault-001', key);
    const initialTimestamp = useSessionStore.getState().lastActiveTimestamp;

    await new Promise((resolve) => setTimeout(resolve, 10));
    useSessionStore.getState().touchActivity();
    const updatedTimestamp = useSessionStore.getState().lastActiveTimestamp;

    expect(updatedTimestamp).toBeGreaterThanOrEqual(initialTimestamp!);
  });
});
