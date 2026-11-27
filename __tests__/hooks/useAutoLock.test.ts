import { renderHook, act } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { useAutoLock } from '@/hooks/useAutoLock';
import { useSessionStore } from '@/stores/useSessionStore';
import QuickCrypto from 'react-native-quick-crypto';

describe('useAutoLock Hook & Inactivity Timeout Protection', () => {
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

    useSessionStore.getState().lockApp();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('activates PrivacyShield and wipes session key immediately when timeout is 0', async () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setAppSessionKey(key);

    const { result } = await renderHook(() => useAutoLock({ lockTimeoutMinutes: 0 }));
    expect(result.current.isShieldActive).toBe(false);

    await act(async () => {
      appStateListener?.('background');
    });

    expect(result.current.isShieldActive).toBe(true);
    const session = useSessionStore.getState();
    expect(session.isUnlocked).toBe(false);
    expect(session.appSessionKey).toBeNull();
    expect(key.equals(Buffer.alloc(32, 0))).toBe(true);
  });

  it('activates PrivacyShield on inactive transition (App Switcher reveal)', async () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setAppSessionKey(key);

    const { result } = await renderHook(() => useAutoLock({ lockTimeoutMinutes: 0 }));

    await act(async () => {
      appStateListener?.('inactive');
    });

    expect(result.current.isShieldActive).toBe(true);
    expect(useSessionStore.getState().isUnlocked).toBe(false);
  });

  it('keeps app unlocked on background transition if duration is within timeout', async () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setAppSessionKey(key);

    const { result } = await renderHook(() => useAutoLock({ lockTimeoutMinutes: 5 }));

    await act(async () => {
      appStateListener?.('background');
    });

    expect(result.current.isShieldActive).toBe(true);
    expect(useSessionStore.getState().isUnlocked).toBe(true);

    jest.advanceTimersByTime(2 * 60 * 1000);

    await act(async () => {
      appStateListener?.('active');
    });

    expect(useSessionStore.getState().isUnlocked).toBe(true);
  });

  it('locks app when returning from background after timeout has elapsed', async () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setAppSessionKey(key);

    await renderHook(() => useAutoLock({ lockTimeoutMinutes: 5 }));

    await act(async () => {
      appStateListener?.('background');
    });

    jest.advanceTimersByTime(6 * 60 * 1000);

    await act(async () => {
      appStateListener?.('active');
    });

    expect(useSessionStore.getState().isUnlocked).toBe(false);
    expect(useSessionStore.getState().appSessionKey).toBeNull();
  });

  it('tracks inactivity rather than login time so active chatting never locks mid-sentence', async () => {
    const key = QuickCrypto.randomBytes(32);
    useSessionStore.getState().setAppSessionKey(key);

    await renderHook(() => useAutoLock({ lockTimeoutMinutes: 2 }));

    // Advance 90 seconds, then simulate user typing/sending activity
    await act(async () => {
      jest.advanceTimersByTime(90 * 1000);
      useSessionStore.getState().touchActivity();
    });

    // Advance another 90 seconds (180s total > 2m login time, but only 90s idle < 2m)
    await act(async () => {
      jest.advanceTimersByTime(90 * 1000);
    });

    expect(useSessionStore.getState().isUnlocked).toBe(true);
    expect(useSessionStore.getState().appSessionKey).not.toBeNull();

    // Now stay genuinely idle for 130 seconds (> 2m idle)
    await act(async () => {
      jest.advanceTimersByTime(130 * 1000);
    });

    expect(useSessionStore.getState().isUnlocked).toBe(false);
    expect(useSessionStore.getState().appSessionKey).toBeNull();
  });
});
