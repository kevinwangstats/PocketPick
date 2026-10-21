import { renderHook, act } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { useAutoLock } from '@/hooks/useAutoLock';
import { useSessionStore } from '@/stores/useSessionStore';
import QuickCrypto from 'react-native-quick-crypto';

describe('useAutoLock Hook & Configurable Timeout Protection', () => {
  let appStateListener: ((state: AppStateStatus) => void) | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
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
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('activates PrivacyShield and wipes session key immediately when timeout is 0', async () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setActiveVault('vault-001', key);

    const { result } = await renderHook(() => useAutoLock({ lockTimeoutMinutes: 0 }));
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

    const { result } = await renderHook(() => useAutoLock({ lockTimeoutMinutes: 0 }));

    await act(async () => {
      appStateListener?.('inactive');
    });

    expect(result.current.isShieldActive).toBe(true);
    expect(useSessionStore.getState().activeVaultId).toBeNull();
  });

  it('keeps vault unlocked on background transition if duration is within timeout', async () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setActiveVault('vault-001', key);

    const { result } = await renderHook(() => useAutoLock({ lockTimeoutMinutes: 5 }));

    // Send to background
    await act(async () => {
      appStateListener?.('background');
    });

    // Privacy shield covers screen during background
    expect(result.current.isShieldActive).toBe(true);
    // Key is preserved in memory while within timeout
    expect(useSessionStore.getState().activeVaultId).toBe('vault-001');
    expect(useSessionStore.getState().activeVaultKey).not.toBeNull();

    // Fast-forward 2 minutes (less than 5)
    jest.advanceTimersByTime(2 * 60 * 1000);

    // Return to active
    await act(async () => {
      appStateListener?.('active');
    });

    // Still unlocked
    expect(useSessionStore.getState().activeVaultId).toBe('vault-001');
  });

  it('locks vault when returning from background after timeout has elapsed', async () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setActiveVault('vault-001', key);

    await renderHook(() => useAutoLock({ lockTimeoutMinutes: 5 }));

    // Send to background
    await act(async () => {
      appStateListener?.('background');
    });

    // Fast-forward 6 minutes (exceeds 5)
    jest.advanceTimersByTime(6 * 60 * 1000);

    // Return to active
    await act(async () => {
      appStateListener?.('active');
    });

    // Locked and zeroized
    expect(useSessionStore.getState().activeVaultId).toBeNull();
    expect(useSessionStore.getState().activeVaultKey).toBeNull();
  });

  it('automatically locks vault via heartbeat interval while foregrounded after timeout', async () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setActiveVault('vault-001', key);

    await renderHook(() => useAutoLock({ lockTimeoutMinutes: 2 }));

    expect(useSessionStore.getState().activeVaultId).toBe('vault-001');

    // Fast-forward 2.5 minutes in foreground
    act(() => {
      jest.advanceTimersByTime(150 * 1000);
    });

    // Vault locked by periodic timer
    expect(useSessionStore.getState().activeVaultId).toBeNull();
    expect(useSessionStore.getState().activeVaultKey).toBeNull();
  });
});
