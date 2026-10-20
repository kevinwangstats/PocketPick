import { eq } from 'drizzle-orm';
import { getDatabase, getRawDatabase, ensureMigrations } from '../../db/client';
import { vaults, Vault } from '../../db/schema';

/**
 * Retrieves the full vault record by ID.
 */
export async function getVault(vaultId: string): Promise<Vault | null> {
  const db = await getDatabase();
  try {
    const rows = await db.select().from(vaults).where(eq(vaults.id, vaultId));
    return rows[0] ?? null;
  } catch (err) {
    const raw = getRawDatabase();
    if (raw) {
      await ensureMigrations(raw);
      const rows = await db.select().from(vaults).where(eq(vaults.id, vaultId));
      return rows[0] ?? null;
    }
    throw err;
  }
}

/**
 * Retrieves the vault-level LLM master prompt for a specific vault.
 */
export async function getVaultMasterPrompt(vaultId: string): Promise<string> {
  const vault = await getVault(vaultId);
  return vault?.llmMasterPrompt ?? '';
}

/**
 * Updates the vault-level LLM master prompt for a specific vault.
 */
export async function updateVaultMasterPrompt(
  vaultId: string,
  masterPrompt: string,
): Promise<void> {
  const db = await getDatabase();
  try {
    await db
      .update(vaults)
      .set({
        llmMasterPrompt: masterPrompt.trim(),
        updatedAt: new Date(),
      })
      .where(eq(vaults.id, vaultId));
  } catch (err) {
    const raw = getRawDatabase();
    if (raw) {
      await ensureMigrations(raw);
      await db
        .update(vaults)
        .set({
          llmMasterPrompt: masterPrompt.trim(),
          updatedAt: new Date(),
        })
        .where(eq(vaults.id, vaultId));
    } else {
      throw err;
    }
  }
}
