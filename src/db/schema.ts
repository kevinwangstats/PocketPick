import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const WARDROBE_CATEGORIES = ['top', 'bottom', 'underwear', 'hosiery', 'others'] as const;
export type WardrobeCategory = (typeof WARDROBE_CATEGORIES)[number];

export const PHOTO_KINDS = ['wardrobe', 'past_ootd'] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/**
 * Unified App Master Security verifier table.
 * Stores the PBKDF2 salt and AES-256-GCM verifier ciphertext (never the derived key).
 */
export const appSecurity = sqliteTable('app_security', {
  id: text('id').primaryKey(),
  salt: text('salt').notNull(),
  verifierCipher: text('verifier_cipher').notNull(),
  verifierIv: text('verifier_iv').notNull(),
  verifierTag: text('verifier_tag').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type AppSecurity = typeof appSecurity.$inferSelect;
export type NewAppSecurity = typeof appSecurity.$inferInsert;

/**
 * AI Designer Personalities ("Persons") table.
 * Each person has a configurable personality prompt, tone preset, encrypted portrait avatar,
 * and an extensible plain-text personal preference memory viewable/editable in Settings.
 */
export const persons = sqliteTable('persons', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  bio: text('bio'),
  tonePreset: text('tone_preset'),
  personalityPrompt: text('personality_prompt').notNull(),
  memoryText: text('memory_text').notNull().default(''),
  memoryUpdatedAt: integer('memory_updated_at', { mode: 'timestamp' }),
  avatarEncryptedPath: text('avatar_encrypted_path'),
  avatarIv: text('avatar_iv'),
  avatarTag: text('avatar_tag'),
  avatarThumbPath: text('avatar_thumb_path'),
  avatarThumbIv: text('avatar_thumb_iv'),
  avatarThumbTag: text('avatar_thumb_tag'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Person = typeof persons.$inferSelect;
export type NewPerson = typeof persons.$inferInsert;

/**
 * App-only encrypted photos separated into 'wardrobe' (garment items) and 'past_ootd' (body try-on/OOTD).
 * Both item label and descriptions are AES-256-GCM encrypted.
 */
export const photos = sqliteTable('photos', {
  id: text('id').primaryKey(),
  photoKind: text('photo_kind', { enum: ['wardrobe', 'past_ootd'] })
    .notNull()
    .default('wardrobe'),
  aiHasHumanBody: integer('ai_has_human_body'),
  category: text('category', { enum: ['top', 'bottom', 'underwear', 'hosiery', 'others'] })
    .notNull()
    .default('others'),

  encryptedItem: text('encrypted_item'),
  itemIv: text('item_iv'),
  itemTag: text('item_tag'),

  encryptedDescription: text('encrypted_description'),
  descriptionIv: text('description_iv'),
  descriptionTag: text('description_tag'),

  encryptedFilePath: text('encrypted_file_path').notNull(),
  fileIv: text('file_iv').notNull(),
  fileTag: text('file_tag').notNull(),
  fileHash: text('file_hash').notNull(),

  encryptedThumbnailPath: text('encrypted_thumbnail_path').notNull(),
  thumbnailIv: text('thumbnail_iv').notNull(),
  thumbnailTag: text('thumbnail_tag').notNull(),

  lastWornAt: integer('last_worn_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;

/**
 * Encrypted Messenger/WhatsApp-style chat messages per Person.
 */
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  personId: text('person_id')
    .notNull()
    .references(() => persons.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  encryptedContent: text('encrypted_content').notNull(),
  contentIv: text('content_iv').notNull(),
  contentTag: text('content_tag').notNull(),
  photoId: text('photo_id').references(() => photos.id, { onDelete: 'set null' }),
  ootdLookId: text('ootd_look_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

/**
 * Generated and saved OOTD looks (slots JSON encrypted via AES-256-GCM).
 */
export const ootdLooks = sqliteTable('ootd_looks', {
  id: text('id').primaryKey(),
  personId: text('person_id')
    .notNull()
    .references(() => persons.id, { onDelete: 'cascade' }),
  triggerType: text('trigger_type', { enum: ['ootd', 'secret', 'style'] }).notNull(),
  encryptedSlots: text('encrypted_slots').notNull(),
  slotsIv: text('slots_iv').notNull(),
  slotsTag: text('slots_tag').notNull(),
  isFavorite: integer('is_favorite').notNull().default(0),
  wornAt: integer('worn_at', { mode: 'timestamp' }),
  fitcheckPhotoId: text('fitcheck_photo_id').references(() => photos.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type OotdLook = typeof ootdLooks.$inferSelect;
export type NewOotdLook = typeof ootdLooks.$inferInsert;

/**
 * API Quotas table to guard monthly OpenRouter LLM requests.
 */
export const apiQuotas = sqliteTable('api_quotas', {
  id: text('id').primaryKey(),
  periodMonth: text('period_month').notNull(), // 'YYYY-MM'
  requestCount: integer('request_count').notNull().default(0),
  maxMonthlyLimit: integer('max_monthly_limit').notNull().default(500),
  lastRequestAt: integer('last_request_at', { mode: 'timestamp' }),
});

export type ApiQuota = typeof apiQuotas.$inferSelect;
export type NewApiQuota = typeof apiQuotas.$inferInsert;

// ---------------------------------------------------------------------------
// Temporary deprecated legacy PocketPick table exports (removed in Task 2.3)
// ---------------------------------------------------------------------------

/** @deprecated Removed in Task 2.3 legacy purge */
export const vaults = sqliteTable('vaults', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  salt: text('salt').notNull(),
  verifierCipher: text('verifier_cipher').notNull(),
  verifierIv: text('verifier_iv').notNull(),
  verifierTag: text('verifier_tag').notNull(),
  llmMasterPrompt: text('llm_master_prompt'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

/** @deprecated Removed in Task 2.3 legacy purge */
export type Vault = typeof vaults.$inferSelect;
/** @deprecated Removed in Task 2.3 legacy purge */
export type NewVault = typeof vaults.$inferInsert;

/** @deprecated Removed in Task 2.3 legacy purge */
export const resources = sqliteTable('resources', {
  id: text('id').primaryKey(),
  vaultId: text('vault_id')
    .notNull()
    .references(() => vaults.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['ticket', 'photo'] }).notNull(),
  weight: integer('weight').notNull().default(1),
  encryptedPayload: text('encrypted_payload'),
  payloadIv: text('payload_iv'),
  payloadTag: text('payload_tag'),
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

/** @deprecated Removed in Task 2.3 legacy purge */
export type Resource = typeof resources.$inferSelect;
/** @deprecated Removed in Task 2.3 legacy purge */
export type NewResource = typeof resources.$inferInsert;

/** @deprecated Removed in Task 2.3 legacy purge */
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

/** @deprecated Removed in Task 2.3 legacy purge */
export type HistoryLog = typeof historyLogs.$inferSelect;
/** @deprecated Removed in Task 2.3 legacy purge */
export type NewHistoryLog = typeof historyLogs.$inferInsert;
