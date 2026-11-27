import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';
import { eq, desc } from 'drizzle-orm';
import { getDatabase } from '../../db/client';
import { persons, Person } from '../../db/schema';
import { encryptAndStoreImage, decryptImageBuffer } from '../media/imagePipeline';
import { resolveResourcePath } from '../media/pathResolver';
import { shredFile } from '../media/fileShredder';
import { DEFAULT_MEMORY_TEMPLATE } from './personMemoryService';
import { TONE_PRESETS } from './personaPresets';

export interface CreatePersonInput {
  name: string;
  bio?: string;
  tonePreset?: string;
  personalityPrompt: string;
  memoryText?: string;
  avatarUri?: string;
  sessionKey?: Buffer;
}

export interface UpdatePersonInput {
  name?: string;
  bio?: string;
  tonePreset?: string;
  personalityPrompt?: string;
  avatarUri?: string | null;
  sessionKey?: Buffer;
}

function avatarAad(personId: string): string {
  return `avatar:${personId}`;
}

async function shredAvatarFiles(person: Person): Promise<void> {
  const fullPath = resolveResourcePath(person.avatarEncryptedPath);
  if (fullPath) await shredFile(fullPath);

  const thumbPath = resolveResourcePath(person.avatarThumbPath);
  if (thumbPath) await shredFile(thumbPath);
}

/**
 * Creates a new AI Designer Personality ("Person") with unique name enforcement,
 * optional sandbox-encrypted portrait photo, and distinct plain-text memory.
 */
export async function createPerson(input: CreatePersonInput): Promise<Person> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('Person name is required');
  }
  if (!input.personalityPrompt.trim()) {
    throw new Error('Personality prompt is required');
  }

  const db = await getDatabase();
  const existing = await db.select().from(persons);
  const duplicate = existing.some((p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase());
  if (duplicate) {
    throw new Error(`A person named "${trimmedName}" already exists`);
  }

  const id = QuickCrypto.randomBytes(16).toString('hex');
  const now = new Date();

  let avatarEncryptedPath: string | null = null;
  let avatarIv: string | null = null;
  let avatarTag: string | null = null;
  let avatarThumbPath: string | null = null;
  let avatarThumbIv: string | null = null;
  let avatarThumbTag: string | null = null;

  if (input.avatarUri && input.sessionKey) {
    const stored = await encryptAndStoreImage({
      sourceUri: input.avatarUri,
      id,
      bucket: 'avatars',
      sessionKey: input.sessionKey,
      aad: avatarAad(id),
    });
    avatarEncryptedPath = stored.relativeFilePath;
    avatarIv = stored.fileIv;
    avatarTag = stored.fileTag;
    avatarThumbPath = stored.relativeThumbnailPath;
    avatarThumbIv = stored.thumbnailIv;
    avatarThumbTag = stored.thumbnailTag;
  }

  const record: typeof persons.$inferInsert = {
    id,
    name: trimmedName,
    bio: input.bio?.trim() || null,
    tonePreset: input.tonePreset || null,
    personalityPrompt: input.personalityPrompt.trim(),
    memoryText: input.memoryText?.trim() ? input.memoryText : DEFAULT_MEMORY_TEMPLATE,
    memoryUpdatedAt: now,
    avatarEncryptedPath,
    avatarIv,
    avatarTag,
    avatarThumbPath,
    avatarThumbIv,
    avatarThumbTag,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(persons).values(record);
  return record as Person;
}

export async function listPersons(): Promise<Person[]> {
  const db = await getDatabase();
  return db.select().from(persons).orderBy(desc(persons.updatedAt));
}

export async function getPersonById(personId: string): Promise<Person | null> {
  const db = await getDatabase();
  const rows = await db.select().from(persons).where(eq(persons.id, personId)).limit(1);
  return rows[0] ?? null;
}

export async function updatePerson(personId: string, patch: UpdatePersonInput): Promise<Person> {
  const existing = await getPersonById(personId);
  if (!existing) {
    throw new Error('Person not found');
  }

  const db = await getDatabase();
  const updates: Partial<typeof persons.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error('Person name cannot be empty');
    const all = await db.select().from(persons);
    const conflict = all.some(
      (p) => p.id !== personId && p.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (conflict) {
      throw new Error(`A person named "${trimmed}" already exists`);
    }
    updates.name = trimmed;
  }

  if (patch.bio !== undefined) {
    updates.bio = patch.bio.trim() || null;
  }
  if (patch.tonePreset !== undefined) {
    updates.tonePreset = patch.tonePreset || null;
  }
  if (patch.personalityPrompt !== undefined) {
    const trimmedPrompt = patch.personalityPrompt.trim();
    if (!trimmedPrompt) throw new Error('Personality prompt cannot be empty');
    updates.personalityPrompt = trimmedPrompt;
  }

  if (patch.avatarUri === null) {
    await shredAvatarFiles(existing);
    updates.avatarEncryptedPath = null;
    updates.avatarIv = null;
    updates.avatarTag = null;
    updates.avatarThumbPath = null;
    updates.avatarThumbIv = null;
    updates.avatarThumbTag = null;
  } else if (patch.avatarUri && patch.sessionKey) {
    await shredAvatarFiles(existing);
    const stored = await encryptAndStoreImage({
      sourceUri: patch.avatarUri,
      id: `${personId}_${Date.now()}`,
      bucket: 'avatars',
      sessionKey: patch.sessionKey,
      aad: avatarAad(personId),
    });
    updates.avatarEncryptedPath = stored.relativeFilePath;
    updates.avatarIv = stored.fileIv;
    updates.avatarTag = stored.fileTag;
    updates.avatarThumbPath = stored.relativeThumbnailPath;
    updates.avatarThumbIv = stored.thumbnailIv;
    updates.avatarThumbTag = stored.thumbnailTag;
  }

  await db.update(persons).set(updates).where(eq(persons.id, personId));
  return { ...existing, ...updates } as Person;
}

/**
 * Decrypts a Person's avatar thumbnail strictly in memory (throws on tamper if strict=true).
 */
export async function decryptPersonAvatarUri(
  person: Person,
  sessionKey: Buffer,
  options: { full?: boolean; strict?: boolean } = {},
): Promise<string | null> {
  const path = options.full ? person.avatarEncryptedPath : person.avatarThumbPath;
  const iv = options.full ? person.avatarIv : person.avatarThumbIv;
  const tag = options.full ? person.avatarTag : person.avatarThumbTag;

  if (!path || !iv || !tag) {
    return null;
  }

  try {
    const buf = await decryptImageBuffer({
      encryptedPath: path,
      iv,
      tag,
      sessionKey,
      aad: avatarAad(person.id),
    });
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch (err) {
    if (options.strict) throw err;
    return null;
  }
}

/**
 * Permanently deletes an AI Person and shreds her encrypted avatar files on disk.
 */
export async function deletePerson(personId: string): Promise<void> {
  const existing = await getPersonById(personId);
  if (existing) {
    await shredAvatarFiles(existing);
  }
  const db = await getDatabase();
  await db.delete(persons).where(eq(persons.id, personId));
}

/**
 * Composes the authoritative system prompt for a Person, uniting her Personality Prompt,
 * Tone/Sensuality directive, and distinct Plain-Text Personal Memory.
 */
export function buildPersonAuthoritativePrompt(
  person: Person,
  options: { includeMemoryTrailerInstruction?: boolean } = {},
): string {
  const toneObj = TONE_PRESETS.find((t) => t.id === person.tonePreset);
  const sections: string[] = [
    `You are "${person.name}"${person.bio ? ` (${person.bio})` : ''}.`,
    `Core Personality Directives:\n${person.personalityPrompt}`,
  ];

  if (toneObj) {
    sections.push(`Tone & Chemistry Style (${toneObj.label}):\n${toneObj.directive}`);
  }

  if (person.memoryText && person.memoryText.trim().length > 0) {
    sections.push(
      `Your Personal Style Memory About the User (always adapt naturally to these preferences without quoting this block verbatim):\n${person.memoryText.trim()}`,
    );
  }

  if (options.includeMemoryTrailerInstruction) {
    sections.push(
      `If the user reveals a durable new preference (style, color, fabric/texture that makes them feel special or tingle, fit/mood), append a concise hidden tag at the VERY END of your reply:\n<memory_add>[{"section": "Fabrics & Textures That Make Me Tingle", "item": "..."}]</memory_add>`,
    );
  }

  return sections.join('\n\n');
}
