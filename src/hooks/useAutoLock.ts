import { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSessionStore } from '../stores/useSessionStore';

export interface UseAutoLockOptions {
  /** Inactivity timeout in milliseconds before auto-locking (default: 0 = immediate on background) */
  lockTimeoutMs?: number;
}

export function useAutoLock(options: UseAutoLockOptions = {}) {
  const { lockTimeoutMs = 0 } = options;
  const [isShieldActive, setIsShieldActive] = useState(false);
  const lockVault = useSessionStore((state) => state.lockVault);
  const backgroundTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App is moving out of focus: Activate Privacy Shield immediately
        setIsShieldActive(true);
        backgroundTimestampRef.current = Date.now();

        if (lockTimeoutMs === 0) {
          // Zeroize keys immediately on background
          lockVault();
        }
      } else if (nextAppState === 'active') {
        const bgTime = backgroundTimestampRef.current;
        if (bgTime && lockTimeoutMs > 0) {
          const elapsed = Date.now() - bgTime;
          if (elapsed >= lockTimeoutMs) {
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
  }, [lockVault, lockTimeoutMs]);

  return {
    isShieldActive,
  };
}
