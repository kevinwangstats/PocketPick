import { open, DB } from '@op-engineering/op-sqlite';
import { drizzle, OPSQLiteDatabase } from 'drizzle-orm/op-sqlite';
import * as schema from './schema';
import { getOrCreateDatabaseMasterKey } from './security';

export type DrizzleDb = OPSQLiteDatabase<typeof schema>;

let dbInstance: DrizzleDb | null = null;
let rawDbInstance: DB | null = null;

/**
 * Returns the underlying raw DB instance if open.
 */
export function getRawDatabase(): DB | null {
  return rawDbInstance;
}

/**
 * Ensures backward-compatible migrations are applied for new columns on existing tables.
 */
export async function ensureMigrations(db: DB): Promise<void> {
  const alterStatements = [
    'ALTER TABLE vaults ADD COLUMN llm_master_prompt TEXT;',
    'ALTER TABLE resources ADD COLUMN file_hash TEXT;',
  ];

  for (const stmt of alterStatements) {
    if (db.executeSync) {
      try {
        db.executeSync(stmt);
      } catch {
        // Column already exists
      }
    } else {
      try {
        await db.execute(stmt);
      } catch {
        // Column already exists
      }
    }
  }
}

/**
 * Initializes the encrypted OP-SQLite database using SQLCipher (256-bit AES).
 * The master encryption key is fetched from the iOS Keychain via getOrCreateDatabaseMasterKey().
 */
export async function getDatabase(): Promise<DrizzleDb> {
  if (dbInstance) {
    return dbInstance;
  }

  const encryptionKey = await getOrCreateDatabaseMasterKey();

  const opsqliteDb = open({
    name: 'pocketpick.db',
    encryptionKey: encryptionKey,
  });

  // CRITICAL: Drizzle ORM OPSQLitePreparedQuery expects client.executeRawAsync()
  // to return a 2D rawRows array directly (any[][]). However, @op-engineering/op-sqlite native
  // executeRaw returns an object: { rawRows: any[][], columnNames: string[], ... }.
  // If not unwrapped, Drizzle rows.map() throws "TypeError: undefined is not a function",
  // breaking all select queries (loading vaults and loading resources).
  const rawClient = opsqliteDb as any;
  const originalExecuteRawAsync = rawClient.executeRawAsync?.bind(rawClient);
  if (originalExecuteRawAsync) {
    rawClient.executeRawAsync = async (query: string, params?: any[]) => {
      const result = await originalExecuteRawAsync(query, params);
      if (result && Array.isArray(result.rawRows)) {
        return result.rawRows;
      }
      return result;
    };
  }

  rawDbInstance = opsqliteDb;
  dbInstance = drizzle(opsqliteDb, { schema });

  // Execute initial DDL to ensure tables exist
  await initializeTables(rawDbInstance);

  return dbInstance;
}

/**
 * Executes DDL statements ensuring all tables and foreign keys are provisioned.
 */
export async function initializeTables(db: DB): Promise<void> {
  // Enforce foreign key constraints
  if (db.executeSync) {
    db.executeSync('PRAGMA foreign_keys = ON;');

    db.executeSync(`
      CREATE TABLE IF NOT EXISTS vaults (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        salt TEXT NOT NULL,
        verifier_cipher TEXT NOT NULL,
        verifier_iv TEXT NOT NULL,
        verifier_tag TEXT NOT NULL,
        llm_master_prompt TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    db.executeSync(`
      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY NOT NULL,
        vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        weight INTEGER NOT NULL DEFAULT 1,
        encrypted_payload TEXT,
        payload_iv TEXT,
        payload_tag TEXT,
        encrypted_file_path TEXT,
        file_iv TEXT,
        file_tag TEXT,
        file_hash TEXT,
        encrypted_thumbnail_path TEXT,
        thumbnail_iv TEXT,
        thumbnail_tag TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    db.executeSync(`
      CREATE TABLE IF NOT EXISTS history_logs (
        id TEXT PRIMARY KEY NOT NULL,
        vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
        resource_id TEXT REFERENCES resources(id) ON DELETE SET NULL,
        selected_at INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        notes TEXT
      );
    `);

    db.executeSync(`
      CREATE TABLE IF NOT EXISTS api_quotas (
        id TEXT PRIMARY KEY NOT NULL,
        period_month TEXT NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 0,
        max_monthly_limit INTEGER NOT NULL DEFAULT 100,
        last_request_at INTEGER
      );
    `);
  } else {
    await db.execute('PRAGMA foreign_keys = ON;');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS vaults (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        salt TEXT NOT NULL,
        verifier_cipher TEXT NOT NULL,
        verifier_iv TEXT NOT NULL,
        verifier_tag TEXT NOT NULL,
        llm_master_prompt TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY NOT NULL,
        vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        weight INTEGER NOT NULL DEFAULT 1,
        encrypted_payload TEXT,
        payload_iv TEXT,
        payload_tag TEXT,
        encrypted_file_path TEXT,
        file_iv TEXT,
        file_tag TEXT,
        file_hash TEXT,
        encrypted_thumbnail_path TEXT,
        thumbnail_iv TEXT,
        thumbnail_tag TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS history_logs (
        id TEXT PRIMARY KEY NOT NULL,
        vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
        resource_id TEXT REFERENCES resources(id) ON DELETE SET NULL,
        selected_at INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        notes TEXT
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS api_quotas (
        id TEXT PRIMARY KEY NOT NULL,
        period_month TEXT NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 0,
        max_monthly_limit INTEGER NOT NULL DEFAULT 100,
        last_request_at INTEGER
      );
    `);
  }

  await ensureMigrations(db);
}

/**
 * Closes the database connection and resets instance (used in tests or app lock).
 */
export function closeDatabase(): void {
  if (rawDbInstance) {
    rawDbInstance.close();
    rawDbInstance = null;
    dbInstance = null;
  }
}
