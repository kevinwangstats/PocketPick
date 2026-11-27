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
