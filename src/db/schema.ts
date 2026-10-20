import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Vaults table storing metadata and passphrase verifier parameters.
 * Note: The derived vault key is never stored here; only the salt and verifier cipher are kept.
 */
export const vaults = sqliteTable('vaults', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  salt: text('salt').notNull(), // Base64 32-byte salt for PBKDF2
  verifierCipher: text('verifier_cipher').notNull(), // Base64 ciphertext of constant verifier
  verifierIv: text('verifier_iv').notNull(), // Base64 12-byte GCM IV
  verifierTag: text('verifier_tag').notNull(), // Base64 16-byte GCM Auth Tag
  llmMasterPrompt: text('llm_master_prompt'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Vault = typeof vaults.$inferSelect;
export type NewVault = typeof vaults.$inferInsert;

/**
 * Resources table storing encrypted tickets (text notes) and encrypted photo references.
 */
export const resources = sqliteTable('resources', {
  id: text('id').primaryKey(),
  vaultId: text('vault_id')
    .notNull()
    .references(() => vaults.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['ticket', 'photo'] }).notNull(),
  weight: integer('weight').notNull().default(1),

  // Ticket fields (text payloads encrypted with AES-256-GCM)
  encryptedPayload: text('encrypted_payload'),
  payloadIv: text('payload_iv'),
  payloadTag: text('payload_tag'),

  // Photo fields (file paths to encrypted files on filesystem)
  encryptedFilePath: text('encrypted_file_path'),
  fileIv: text('file_iv'),
  fileTag: text('file_tag'),
  fileHash: text('file_hash'),
  encryptedThumbnailPath: text('encrypted_thumbnail_path'),
  thumbnailIv: text('thumbnail_iv'),
  thumbnailTag: text('thumbnail_tag'),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;

/**
 * History logs recording all random selection events.
 */
export const historyLogs = sqliteTable('history_logs', {
  id: text('id').primaryKey(),
  vaultId: text('vault_id')
    .notNull()
    .references(() => vaults.id, { onDelete: 'cascade' }),
  resourceId: text('resource_id').references(() => resources.id, { onDelete: 'set null' }),
  selectedAt: integer('selected_at', { mode: 'timestamp' }).notNull(),
  actionType: text('action_type', { enum: ['pick', 're_pick', 'discard'] }).notNull(),
  notes: text('notes'),
});

export type HistoryLog = typeof historyLogs.$inferSelect;
export type NewHistoryLog = typeof historyLogs.$inferInsert;

/**
 * API Quotas table to strictly guard monthly LLM / external API requests (max 100/mo).
 */
export const apiQuotas = sqliteTable('api_quotas', {
  id: text('id').primaryKey(),
  periodMonth: text('period_month').notNull(), // 'YYYY-MM'
  requestCount: integer('request_count').notNull().default(0),
  maxMonthlyLimit: integer('max_monthly_limit').notNull().default(100),
  lastRequestAt: integer('last_request_at', { mode: 'timestamp' }),
});

export type ApiQuota = typeof apiQuotas.$inferSelect;
export type NewApiQuota = typeof apiQuotas.$inferInsert;
