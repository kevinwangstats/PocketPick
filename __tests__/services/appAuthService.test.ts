import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from '@craftzdog/react-native-buffer';
import { getDatabase, closeDatabase } from '@/db/client';
import { appSecurity } from '@/db/schema';
import { useSessionStore } from '@/stores/useSessionStore';
import {
  isAppPassphraseInitialized,
  initializeAppPassphrase,
  unlockWithPassphrase,
  enableBiometricUnlock,
  disableBiometricUnlock,
  unlockWithBiometrics,
  isBiometricUnlockEnabled,
} from '@/services/auth/appAuthService';
import { mockSecureStore } from '../mocks/secure-store.mock';

describe('Unified App Auth Service & Face ID Quick Unlock (TDD)', () => {
  let storedRow: Record<string, unknown> | null = null;

  beforeEach(async () => {
    closeDatabase();
    mockSecureStore._reset();
    useSessionStore.getState().lockApp();
    storedRow = null;
    jest.clearAllMocks();

    const db = await getDatabase();
    jest.spyOn(db, 'insert').mockImplementation((table: unknown) => {
      return {
        values: async (vals: Record<string, unknown>) => {
          if (table === appSecurity) {
            storedRow = { ...vals };
          }
        },
      } as unknown as ReturnType<typeof db.insert>;
    });

    jest.spyOn(db, 'select').mockImplementation((_fields?: unknown) => {
      return {
        from: (table: unknown) => ({
          where: () => {
            const list = table === appSecurity && storedRow ? [storedRow] : [];
            const res = Promise.resolve(list) as Promise<unknown[]> & {
              limit: () => Promise<unknown[]>;
            };
            res.limit = () => Promise.resolve(list);
            return res;
          },
        }),
      } as unknown as ReturnType<typeof db.select>;
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  it('initializes unified master passphrase and rejects duplicate setup', async () => {
    expect(await isAppPassphraseInitialized()).toBe(false);

    await expect(initializeAppPassphrase('123')).rejects.toThrow(
      'Passphrase must be at least 6 characters',
    );

    const key = await initializeAppPassphrase('silk-velvet-2026');
    expect(key).toHaveLength(32);
    expect(await isAppPassphraseInitialized()).toBe(true);
    expect(useSessionStore.getState().isUnlocked).toBe(true);

    await expect(initializeAppPassphrase('another-pass')).rejects.toThrow(
      'App passphrase is already initialized',
    );
  });

  it('unlocks with valid passphrase and rejects wrong passphrase cleanly', async () => {
    await initializeAppPassphrase('correct-passphrase');
    useSessionStore.getState().lockApp();
    expect(useSessionStore.getState().isUnlocked).toBe(false);

    const wrong = await unlockWithPassphrase('wrong-passphrase');
    expect(wrong).toBe(false);
    expect(useSessionStore.getState().isUnlocked).toBe(false);

    const ok = await unlockWithPassphrase('correct-passphrase');
    expect(ok).toBe(true);
    expect(useSessionStore.getState().isUnlocked).toBe(true);
  });

  it('rejects 1-byte tampered verifier ciphertext and auth tag', async () => {
    await initializeAppPassphrase('tamper-test-pass');
    useSessionStore.getState().lockApp();

    // Tamper 1 byte in verifierCipher
    const cipherBuf = Buffer.from(storedRow!.verifierCipher as string, 'base64');
    cipherBuf[0] = cipherBuf[0] ^ 0xff;
    const originalCipher = storedRow!.verifierCipher;
    storedRow!.verifierCipher = cipherBuf.toString('base64');

    expect(await unlockWithPassphrase('tamper-test-pass')).toBe(false);
    expect(useSessionStore.getState().isUnlocked).toBe(false);

    // Restore ciphertext, tamper 1 byte in verifierTag
    storedRow!.verifierCipher = originalCipher;
    const tagBuf = Buffer.from(storedRow!.verifierTag as string, 'base64');
    tagBuf[0] = tagBuf[0] ^ 0x01;
    storedRow!.verifierTag = tagBuf.toString('base64');

    expect(await unlockWithPassphrase('tamper-test-pass')).toBe(false);
  });

  it('supports opt-in Face ID / Touch ID quick unlock and clean disable', async () => {
    const key = await initializeAppPassphrase('biometric-pass');
    const enabled = await enableBiometricUnlock(key);
    expect(enabled).toBe(true);
    expect(await isBiometricUnlockEnabled()).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalled();

    useSessionStore.getState().lockApp();
    expect(useSessionStore.getState().isUnlocked).toBe(false);

    const bioOk = await unlockWithBiometrics();
    expect(bioOk).toBe(true);
    expect(useSessionStore.getState().isUnlocked).toBe(true);

    // Simulate failed biometric prompt
    useSessionStore.getState().lockApp();
    jest
      .spyOn(LocalAuthentication, 'authenticateAsync')
      .mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    expect(await unlockWithBiometrics()).toBe(false);
    expect(useSessionStore.getState().isUnlocked).toBe(false);

    await disableBiometricUnlock();
    expect(await isBiometricUnlockEnabled()).toBe(false);
  });
});
