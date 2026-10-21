import { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSessionStore } from '../stores/useSessionStore';
import { useVaultTimeoutStore } from '../stores/useVaultTimeoutStore';

export interface UseAutoLockOptions {
  /** Vault open timeout in minutes before auto-locking (defaults to configured system setting). */
  lockTimeoutMinutes?: number;
  /** Direct timeout in milliseconds (legacy / unit testing support). */
  lockTimeoutMs?: number;
}

export function useAutoLock(options: UseAutoLockOptions = {}) {
  const storeTimeoutMinutes = useVaultTimeoutStore((state) => state.timeoutMinutes);

  // Compute effective timeout in milliseconds
  let effectiveTimeoutMs: number;
  if (options.lockTimeoutMs !== undefined) {
    effectiveTimeoutMs = options.lockTimeoutMs;
  } else if (options.lockTimeoutMinutes !== undefined) {
    effectiveTimeoutMs = options.lockTimeoutMinutes * 60 * 1000;
  } else {
    effectiveTimeoutMs = storeTimeoutMinutes * 60 * 1000;
  }

  const [isShieldActive, setIsShieldActive] = useState(false);
  const lockVault = useSessionStore((state) => state.lockVault);
  const backgroundTimestampRef = useRef<number | null>(null);

  // Periodic in-app timer to lock vault once X minutes have elapsed in foreground
  useEffect(() => {
    if (effectiveTimeoutMs <= 0) return;

    const intervalId = setInterval(() => {
      const { activeVaultKey, unlockedAt } = useSessionStore.getState();
      if (activeVaultKey && unlockedAt) {
        const elapsed = Date.now() - unlockedAt;
        if (elapsed >= effectiveTimeoutMs) {
          lockVault();
        }
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [lockVault, effectiveTimeoutMs]);

  // AppState monitoring for backgrounding and app-switcher protection
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App is moving out of focus: Activate Privacy Shield immediately
        setIsShieldActive(true);
        backgroundTimestampRef.current = Date.now();

        if (effectiveTimeoutMs === 0) {
          // Zeroize keys immediately on background
          lockVault();
        }
      } else if (nextAppState === 'active') {
        const now = Date.now();
        const bgTime = backgroundTimestampRef.current;
        const { activeVaultKey, unlockedAt } = useSessionStore.getState();

        if (activeVaultKey && effectiveTimeoutMs > 0) {
          const totalElapsed = unlockedAt ? now - unlockedAt : bgTime ? now - bgTime : 0;
          if (totalElapsed >= effectiveTimeoutMs) {
            lockVault();
          }
        }
        backgroundTimestampRef.current = null;

        // Dismiss privacy shield shortly after regaining active focus
        setTimeout(() => {
          setIsShieldActive(false);
        }, 150);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [lockVault, effectiveTimeoutMs]);

  return {
    isShieldActive,
    effectiveTimeoutMinutes: Math.round(effectiveTimeoutMs / 60000),
  };
}
