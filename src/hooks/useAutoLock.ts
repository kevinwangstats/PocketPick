import { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSessionStore } from '../stores/useSessionStore';
import { useVaultTimeoutStore } from '../stores/useVaultTimeoutStore';

export interface UseAutoLockOptions {
  /** Inactivity timeout in minutes before auto-locking (defaults to configured system setting). */
  lockTimeoutMinutes?: number;
  /** Direct timeout in milliseconds (unit testing support). */
  lockTimeoutMs?: number;
}

export function useAutoLock(options: UseAutoLockOptions = {}) {
  const storeTimeoutMinutes = useVaultTimeoutStore((state) => state.timeoutMinutes);

  let effectiveTimeoutMs: number;
  if (options.lockTimeoutMs !== undefined) {
    effectiveTimeoutMs = options.lockTimeoutMs;
  } else if (options.lockTimeoutMinutes !== undefined) {
    effectiveTimeoutMs = options.lockTimeoutMinutes * 60 * 1000;
  } else {
    effectiveTimeoutMs = storeTimeoutMinutes * 60 * 1000;
  }

  const [isShieldActive, setIsShieldActive] = useState(false);
  const lockApp = useSessionStore((state) => state.lockApp);
  const backgroundTimestampRef = useRef<number | null>(null);

  // Periodic in-app timer checks INACTIVITY (lastActiveTimestamp) rather than login time
  // so active chatting or dressing never triggers an abrupt mid-sentence lock.
  useEffect(() => {
    if (effectiveTimeoutMs <= 0) return;

    const intervalId = setInterval(() => {
      const { appSessionKey, lastActiveTimestamp, unlockedAt } = useSessionStore.getState();
      const referenceTime = lastActiveTimestamp ?? unlockedAt;
      if (appSessionKey && referenceTime) {
        const idleElapsed = Date.now() - referenceTime;
        if (idleElapsed >= effectiveTimeoutMs) {
          lockApp();
        }
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [lockApp, effectiveTimeoutMs]);

  // AppState monitoring for backgrounding and app-switcher protection
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        setIsShieldActive(true);
        backgroundTimestampRef.current = Date.now();

        if (effectiveTimeoutMs === 0) {
          lockApp();
        }
      } else if (nextAppState === 'active') {
        const now = Date.now();
        const bgTime = backgroundTimestampRef.current;
        const { appSessionKey, lastActiveTimestamp, unlockedAt } = useSessionStore.getState();

        if (appSessionKey && effectiveTimeoutMs > 0) {
          const referenceTime = lastActiveTimestamp ?? unlockedAt;
          const idleElapsed = bgTime ? now - bgTime : referenceTime ? now - referenceTime : 0;
          if (idleElapsed >= effectiveTimeoutMs) {
            lockApp();
          } else {
            useSessionStore.getState().touchActivity();
          }
        }
        backgroundTimestampRef.current = null;

        setTimeout(() => {
          setIsShieldActive(false);
        }, 150);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [lockApp, effectiveTimeoutMs]);

  return {
    isShieldActive,
    effectiveTimeoutMinutes: Math.round(effectiveTimeoutMs / 60000),
  };
}
