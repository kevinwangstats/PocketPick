import { renderHook, act } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { useAutoLock } from '@/hooks/useAutoLock';
import { useSessionStore } from '@/stores/useSessionStore';
import QuickCrypto from 'react-native-quick-crypto';

describe('useAutoLock Hook & AppState Protection', () => {
  let appStateListener: ((state: AppStateStatus) => void) | null = null;

  beforeEach(() => {
    appStateListener = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListener = listener;
      return {
        remove: jest.fn(),
      } as unknown as ReturnType<typeof AppState.addEventListener>;
    });

    useSessionStore.getState().lockVault();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('activates PrivacyShield and wipes session key immediately on background transition', async () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setActiveVault('vault-001', key);

    const { result } = await renderHook(() => useAutoLock());
    expect(result.current.isShieldActive).toBe(false);

    // Simulate iOS sending app to background
    await act(async () => {
      appStateListener?.('background');
    });

    expect(result.current.isShieldActive).toBe(true);

    // Verify key was locked and zeroized from session
    const session = useSessionStore.getState();
    expect(session.activeVaultId).toBeNull();
    expect(session.activeVaultKey).toBeNull();
    expect(key.equals(Buffer.alloc(32, 0))).toBe(true);
  });

  it('activates PrivacyShield on inactive transition (e.g. App Switcher reveal)', async () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setActiveVault('vault-001', key);

    const { result } = await renderHook(() => useAutoLock());

    await act(async () => {
      appStateListener?.('inactive');
    });

    expect(result.current.isShieldActive).toBe(true);
    expect(useSessionStore.getState().activeVaultId).toBeNull();
  });
});
