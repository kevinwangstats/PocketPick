import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Buffer } from '@craftzdog/react-native-buffer';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../../db/client';
import { appSecurity } from '../../db/schema';
import { generateSalt, deriveVaultKey } from '../../crypto/kdf';
import { encryptString, decryptString } from '../../crypto/cipher';
import { zeroizeBuffer } from '../../crypto/zeroize';
import { useSessionStore } from '../../stores/useSessionStore';

export const APP_SECURITY_ROW_ID = 'primary';
export const APP_VERIFIER_CONSTANT = 'POCKETPICK_OOTD_APP_VERIFIER_V1';
export const APP_KEY_AAD = 'app_master_v1';

export const BIOMETRIC_ENABLED_KEY = 'POCKETPICK_OOTD_BIOMETRIC_ENABLED';
export const BIOMETRIC_SESSION_KEY = 'POCKETPICK_OOTD_BIOMETRIC_KEY_B64';

/**
 * Checks whether the unified App Master Passphrase has been configured.
 */
export async function isAppPassphraseInitialized(): Promise<boolean> {
  const db = await getDatabase();
  const rows = await db
    .select({ id: appSecurity.id })
    .from(appSecurity)
    .where(eq(appSecurity.id, APP_SECURITY_ROW_ID))
    .limit(1);
  return rows.length > 0;
}

/**
 * Verifies a candidate key against the stored AES-256-GCM verifier row.
 */
async function verifyCandidateAppKey(candidateKey: Buffer): Promise<boolean> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(appSecurity)
    .where(eq(appSecurity.id, APP_SECURITY_ROW_ID))
    .limit(1);

  if (rows.length === 0) {
    return false;
  }

  const record = rows[0];
  try {
    const plaintext = decryptString(
      {
        ciphertext: record.verifierCipher,
        iv: record.verifierIv,
        tag: record.verifierTag,
      },
      candidateKey,
      APP_KEY_AAD,
    );
    return plaintext === APP_VERIFIER_CONSTANT;
  } catch {
    return false;
  }
}

/**
 * Initializes the Unified App Master Passphrase on first launch.
 * Derives the 256-bit key with PBKDF2-HMAC-SHA512 (100k rounds), stores an authenticated
 * GCM verifier in SQLCipher, and unlocks the active in-memory session.
 */
export async function initializeAppPassphrase(passphrase: string): Promise<Buffer> {
  if (!passphrase || passphrase.length < 6) {
    throw new Error('Passphrase must be at least 6 characters');
  }

  const alreadyInitialized = await isAppPassphraseInitialized();
  if (alreadyInitialized) {
    throw new Error('App passphrase is already initialized');
  }

  const salt = generateSalt();
  const derivedKey = deriveVaultKey(passphrase, salt);

  try {
    const verifier = encryptString(APP_VERIFIER_CONSTANT, derivedKey, APP_KEY_AAD);
    const db = await getDatabase();
    const now = new Date();

    await db.insert(appSecurity).values({
      id: APP_SECURITY_ROW_ID,
      salt: salt.toString('base64'),
      verifierCipher: verifier.ciphertext,
      verifierIv: verifier.iv,
      verifierTag: verifier.tag,
      createdAt: now,
      updatedAt: now,
    });

    useSessionStore.getState().setAppSessionKey(derivedKey);
    return derivedKey;
  } catch (err) {
    zeroizeBuffer(derivedKey);
    throw err;
  }
}

/**
 * Unlocks the app session with the user's Master Passphrase.
 * Zeroizes any failed candidate buffer immediately.
 */
export async function unlockWithPassphrase(passphrase: string): Promise<boolean> {
  if (!passphrase) {
    return false;
  }

  const db = await getDatabase();
  const rows = await db
    .select()
    .from(appSecurity)
    .where(eq(appSecurity.id, APP_SECURITY_ROW_ID))
    .limit(1);

  if (rows.length === 0) {
    return false;
  }

  const record = rows[0];
  const saltBuf = Buffer.from(record.salt, 'base64');
  const candidateKey = deriveVaultKey(passphrase, saltBuf);

  const isValid = await verifyCandidateAppKey(candidateKey);
  if (!isValid) {
    zeroizeBuffer(candidateKey);
    return false;
  }

  useSessionStore.getState().setAppSessionKey(candidateKey);
  return true;
}

/**
 * Checks whether Face ID / Touch ID hardware is present and enrolled on the device.
 */
export async function isBiometricHardwareAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

/**
 * Checks whether the user has opted into Face ID / Touch ID quick unlock.
 */
export async function isBiometricUnlockEnabled(): Promise<boolean> {
  try {
    const flag = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return flag === 'true';
  } catch {
    return false;
  }
}

/**
 * Enables Face ID / Touch ID quick unlock by prompting biometric auth and storing
 * the active session key in hardware Keychain protected by device unlock.
 */
export async function enableBiometricUnlock(sessionKey: Buffer): Promise<boolean> {
  const available = await isBiometricHardwareAvailable();
  if (!available) {
    throw new Error('Face ID / Touch ID is not available or not enrolled on this device.');
  }

  const authResult = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Enable Face ID quick unlock',
    fallbackLabel: 'Use Passphrase',
    cancelLabel: 'Cancel',
  });

  if (!authResult.success) {
    return false;
  }

  await SecureStore.setItemAsync(BIOMETRIC_SESSION_KEY, sessionKey.toString('base64'), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    requireAuthentication: true,
  });
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true', {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return true;
}

/**
 * Disables biometric quick unlock and deletes the biometric Keychain entry.
 */
export async function disableBiometricUnlock(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_SESSION_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY).catch(() => {});
}

/**
 * Attempts to unlock the app session using Face ID / Touch ID.
 * Validates the retrieved key against the SQLCipher AES-GCM verifier before accepting.
 */
export async function unlockWithBiometrics(): Promise<boolean> {
  const enabled = await isBiometricUnlockEnabled();
  if (!enabled) return false;

  const available = await isBiometricHardwareAvailable();
  if (!available) return false;

  const authResult = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock PocketPick OOTD',
    fallbackLabel: 'Use Passphrase',
    cancelLabel: 'Cancel',
  });

  if (!authResult.success) {
    return false;
  }

  const storedB64 = await SecureStore.getItemAsync(BIOMETRIC_SESSION_KEY, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    requireAuthentication: true,
  });

  if (!storedB64) {
    return false;
  }

  const candidateKey = Buffer.from(storedB64, 'base64');
  const isValid = await verifyCandidateAppKey(candidateKey);
  if (!isValid) {
    zeroizeBuffer(candidateKey);
    return false;
  }

  useSessionStore.getState().setAppSessionKey(candidateKey);
  return true;
}
