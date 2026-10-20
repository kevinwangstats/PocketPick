import { useState, useCallback } from 'react';
import QuickCrypto from 'react-native-quick-crypto';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { vaults } from '../db/schema';
import { generateSalt, deriveVaultKey } from '../crypto/kdf';
import { encryptString, decryptString } from '../crypto/cipher';
import { zeroizeBuffer } from '../crypto/zeroize';
import { useSessionStore } from '../stores/useSessionStore';

export const VAULT_VERIFIER_CONSTANT = 'POCKETPICK_VAULT_VERIFIER_V1';

export interface UseVaultAuthReturn {
  activeVaultId: string | null;
  isUnlocked: boolean;
  isLoading: boolean;
  error: string | null;
  createVault: (name: string, description: string, passphrase: string) => Promise<string>;
  unlockVault: (vaultId: string, passphrase: string) => Promise<boolean>;
  lockVault: () => void;
  clearError: () => void;
}

export function useVaultAuth(): UseVaultAuthReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeVaultId = useSessionStore((state) => state.activeVaultId);
  const activeVaultKey = useSessionStore((state) => state.activeVaultKey);
  const setActiveVault = useSessionStore((state) => state.setActiveVault);
  const lockVault = useSessionStore((state) => state.lockVault);

  const isUnlocked = Boolean(activeVaultId && activeVaultKey);

  const clearError = useCallback(() => setError(null), []);

  const createVault = useCallback(
    async (name: string, description: string, passphrase: string): Promise<string> => {
      setIsLoading(true);
      setError(null);
      let derivedKey: Buffer | null = null;

      try {
        if (!name.trim()) {
          throw new Error('Vault name is required');
        }
        if (!passphrase || passphrase.length < 6) {
          throw new Error('Passphrase must be at least 6 characters');
        }

        const db = await getDatabase();
        const vaultId = QuickCrypto.randomBytes(16).toString('hex');
        const salt = generateSalt();

        derivedKey = deriveVaultKey(passphrase, salt);
        const verifier = encryptString(VAULT_VERIFIER_CONSTANT, derivedKey, vaultId);

        await db.insert(vaults).values({
          id: vaultId,
          name: name.trim(),
          description: description?.trim() || null,
          salt: salt.toString('base64'),
          verifierCipher: verifier.ciphertext,
          verifierIv: verifier.iv,
          verifierTag: verifier.tag,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        setActiveVault(vaultId, derivedKey);
        return vaultId;
      } catch (err) {
        if (derivedKey) zeroizeBuffer(derivedKey);
        const message = (err as Error).message || 'Failed to create vault';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setActiveVault],
  );

  const unlockVault = useCallback(
    async (vaultId: string, passphrase: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      let candidateKey: Buffer | null = null;

      try {
        const db = await getDatabase();
        const records = await db.select().from(vaults).where(eq(vaults.id, vaultId));

        if (!records || records.length === 0) {
          throw new Error('Vault not found');
        }

        const vault = records[0];
        const saltBuffer = Buffer.from(vault.salt, 'base64');
        candidateKey = deriveVaultKey(passphrase, saltBuffer);

        // Attempt verifier decryption
        const decryptedConstant = decryptString(
          {
            ciphertext: vault.verifierCipher,
            iv: vault.verifierIv,
            tag: vault.verifierTag,
          },
          candidateKey,
          vaultId,
        );

        if (decryptedConstant !== VAULT_VERIFIER_CONSTANT) {
          throw new Error('Invalid passphrase');
        }

        setActiveVault(vaultId, candidateKey);
        return true;
      } catch {
        if (candidateKey) zeroizeBuffer(candidateKey);
        const message = 'Invalid passphrase or vault corrupted';
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [setActiveVault],
  );

  return {
    activeVaultId,
    isUnlocked,
    isLoading,
    error,
    createVault,
    unlockVault,
    lockVault,
    clearError,
  };
}
