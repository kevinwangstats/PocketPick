import { open, DB } from '@op-engineering/op-sqlite';
import { drizzle, OPSQLiteDatabase } from 'drizzle-orm/op-sqlite';
import * as schema from './schema';
import { getOrCreateDatabaseMasterKey } from './security';

export type DrizzleDb = OPSQLiteDatabase<typeof schema>;

let dbInstance: DrizzleDb | null = null;
let rawDbInstance: DB | null = null;

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

  // Unwrap OP-SQLite { rawRows } into 2D array expected by Drizzle ORM OPSQLitePreparedQuery
  const rawClient = opsqliteDb as unknown as {
    executeRawAsync?: (query: string, params?: unknown[]) => Promise<unknown>;
  };
  const originalExecuteRawAsync = rawClient.executeRawAsync?.bind(rawClient);
  if (originalExecuteRawAsync) {
    rawClient.executeRawAsync = async (query: string, params?: unknown[]) => {
      const result = (await originalExecuteRawAsync(query, params)) as
        { rawRows?: unknown[][] } | unknown;
      if (
        result &&
        typeof result === 'object' &&
        'rawRows' in result &&
        Array.isArray(result.rawRows)
      ) {
        return result.rawRows;
      }
      return result;
    };
  }

  rawDbInstance = opsqliteDb;
  dbInstance = drizzle(opsqliteDb, { schema });

  await initializeTables(rawDbInstance);

  return dbInstance;
}

/**
 * Executes DDL statements ensuring all canonical OOTD tables are provisioned
 * and dropping any legacy PocketPick tables from earlier builds.
 */
export async function initializeTables(db: DB): Promise<void> {
  const ddlStatements = [
    'PRAGMA foreign_keys = ON;',
    `CREATE TABLE IF NOT EXISTS app_security (
      id TEXT PRIMARY KEY NOT NULL,
      salt TEXT NOT NULL,
      verifier_cipher TEXT NOT NULL,
      verifier_iv TEXT NOT NULL,
      verifier_tag TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS persons (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      bio TEXT,
      tone_preset TEXT,
      personality_prompt TEXT NOT NULL,
      memory_text TEXT NOT NULL DEFAULT '',
      memory_updated_at INTEGER,
      avatar_encrypted_path TEXT,
      avatar_iv TEXT,
      avatar_tag TEXT,
      avatar_thumb_path TEXT,
      avatar_thumb_iv TEXT,
      avatar_thumb_tag TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY NOT NULL,
      photo_kind TEXT NOT NULL DEFAULT 'wardrobe',
      ai_has_human_body INTEGER,
      category TEXT NOT NULL DEFAULT 'others',
      encrypted_item TEXT,
      item_iv TEXT,
      item_tag TEXT,
      encrypted_description TEXT,
      description_iv TEXT,
      description_tag TEXT,
      encrypted_file_path TEXT NOT NULL,
      file_iv TEXT NOT NULL,
      file_tag TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      encrypted_thumbnail_path TEXT NOT NULL,
      thumbnail_iv TEXT NOT NULL,
      thumbnail_tag TEXT NOT NULL,
      last_worn_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      encrypted_content TEXT NOT NULL,
      content_iv TEXT NOT NULL,
      content_tag TEXT NOT NULL,
      photo_id TEXT REFERENCES photos(id) ON DELETE SET NULL,
      ootd_look_id TEXT,
      created_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS ootd_looks (
      id TEXT PRIMARY KEY NOT NULL,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      trigger_type TEXT NOT NULL,
      encrypted_slots TEXT NOT NULL,
      slots_iv TEXT NOT NULL,
      slots_tag TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      worn_at INTEGER,
      fitcheck_photo_id TEXT REFERENCES photos(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS api_quotas (
      id TEXT PRIMARY KEY NOT NULL,
      period_month TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      max_monthly_limit INTEGER NOT NULL DEFAULT 500,
      last_request_at INTEGER
    );`,
    // Clean up obsolete legacy PocketPick tables
    'DROP TABLE IF EXISTS history_logs;',
    'DROP TABLE IF EXISTS resources;',
    'DROP TABLE IF EXISTS vaults;',
    // iOS container sandbox UUID migration for relative paths
    `UPDATE photos
     SET encrypted_file_path = SUBSTR(encrypted_file_path, INSTR(encrypted_file_path, 'photos/'))
     WHERE encrypted_file_path LIKE '%photos/%' AND encrypted_file_path NOT LIKE 'photos/%';`,
    `UPDATE photos
     SET encrypted_thumbnail_path = SUBSTR(encrypted_thumbnail_path, INSTR(encrypted_thumbnail_path, 'photos/'))
     WHERE encrypted_thumbnail_path LIKE '%photos/%' AND encrypted_thumbnail_path NOT LIKE 'photos/%';`,
    `UPDATE persons
     SET avatar_encrypted_path = SUBSTR(avatar_encrypted_path, INSTR(avatar_encrypted_path, 'avatars/'))
     WHERE avatar_encrypted_path LIKE '%avatars/%' AND avatar_encrypted_path NOT LIKE 'avatars/%';`,
    `UPDATE persons
     SET avatar_thumb_path = SUBSTR(avatar_thumb_path, INSTR(avatar_thumb_path, 'avatars/'))
     WHERE avatar_thumb_path LIKE '%avatars/%' AND avatar_thumb_path NOT LIKE 'avatars/%';`,
  ];

  for (const stmt of ddlStatements) {
    try {
      if (db.executeSync) {
        db.executeSync(stmt);
      } else {
        await db.execute(stmt);
      }
    } catch {
      // Ignore if table/column already migrated
    }
  }
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
