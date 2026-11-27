import { useState, useCallback, useEffect } from 'react';
import { Buffer } from '@craftzdog/react-native-buffer';
import { useSessionStore } from '../stores/useSessionStore';
import {
  isAppPassphraseInitialized,
  initializeAppPassphrase,
  unlockWithPassphrase,
  unlockWithBiometrics,
  isBiometricUnlockEnabled,
  isBiometricHardwareAvailable,
  enableBiometricUnlock,
  disableBiometricUnlock,
} from '../services/auth/appAuthService';

export interface UseAppAuthReturn {
  isInitialized: boolean | null;
  isUnlocked: boolean;
  appSessionKey: Buffer | null;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  setupPassphrase: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<boolean>;
  unlockBiometric: () => Promise<boolean>;
  toggleBiometric: (enable: boolean) => Promise<boolean>;
  lock: () => void;
  refreshAuthStatus: () => Promise<void>;
  clearError: () => void;
}

export function useAppAuth(): UseAppAuthReturn {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appSessionKey = useSessionStore((state) => state.appSessionKey);
  const isUnlocked = useSessionStore((state) => state.isUnlocked);
  const lockApp = useSessionStore((state) => state.lockApp);

  const clearError = useCallback(() => setError(null), []);

  const refreshAuthStatus = useCallback(async () => {
    try {
      const [initialized, hwAvailable, bioEnabled] = await Promise.all([
        isAppPassphraseInitialized(),
        isBiometricHardwareAvailable(),
        isBiometricUnlockEnabled(),
      ]);
      setIsInitialized(initialized);
      setBiometricAvailable(hwAvailable);
      setBiometricEnabled(bioEnabled);
    } catch {
      setIsInitialized(false);
    }
  }, []);

  useEffect(() => {
    refreshAuthStatus();
  }, [refreshAuthStatus]);

  const setupPassphrase = useCallback(async (passphrase: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeAppPassphrase(passphrase);
      setIsInitialized(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize passphrase';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unlock = useCallback(async (passphrase: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const ok = await unlockWithPassphrase(passphrase);
      if (!ok) {
        setError('Invalid passphrase');
      }
      return ok;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unlock';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unlockBiometric = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      return await unlockWithBiometrics();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Biometric unlock failed';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleBiometric = useCallback(async (enable: boolean): Promise<boolean> => {
    if (enable) {
      const key = useSessionStore.getState().appSessionKey;
      if (!key) {
        throw new Error('Unlock the app first before enabling Face ID');
      }
      const ok = await enableBiometricUnlock(key);
      setBiometricEnabled(ok);
      return ok;
    }
    await disableBiometricUnlock();
    setBiometricEnabled(false);
    return true;
  }, []);

  return {
    isInitialized,
    isUnlocked,
    appSessionKey,
    biometricAvailable,
    biometricEnabled,
    isLoading,
    error,
    setupPassphrase,
    unlock,
    unlockBiometric,
    toggleBiometric,
    lock: lockApp,
    refreshAuthStatus,
    clearError,
  };
}
