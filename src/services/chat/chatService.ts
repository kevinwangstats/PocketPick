import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';
import { asc, eq, inArray } from 'drizzle-orm';
import { getDatabase } from '../../db/client';
import { chatMessages, ChatMessage, persons, photos, Photo } from '../../db/schema';
import { encryptString, decryptString } from '../../crypto/cipher';
import { useSessionStore } from '../../stores/useSessionStore';
import { prepareVisionImageDataUri } from '../media/imagePipeline';
import {
  ingestPhoto,
  savePhotoMetadata,
  normalizeWardrobeCategory,
  getDecryptedPhotoMetadata,
} from '../photos/photoService';
import { getPersonById, buildPersonAuthoritativePrompt } from '../persons/personService';
import { applyPiggybackMemoryUpdates } from '../persons/personMemoryService';
import { getOotdPreferences } from '../settings/ootdPreferences';
import { queryLlmConversation, ConversationTurnInput } from '../llm/llmClient';
import { parseStructuredResponse } from '../llm/structuredTrailerParser';
import { parseOotdCommand } from '../../engine/constraintParser';
import { pickOutfitFromWardrobe } from '../../engine/outfitPicker';
import { saveOotdLook, getOotdLookById, linkFitCheckPhoto } from '../../engine/lookbookStore';
import { DecryptedOotdLook, OotdSlotSelection } from '../../engine/types';
import { DecryptedChatMessage, SendChatMessageParams, SendChatMessageResult } from './types';

const MAX_CONTEXT_TURNS = 12;

export function decryptMessageTextStrict(
  message: ChatMessage,
  sessionKey: Buffer,
  personId: string,
): string {
  return decryptString(
    {
      ciphertext: message.encryptedContent,
      iv: message.contentIv,
      tag: message.contentTag,
    },
    sessionKey,
    personId,
  );
}

function decryptMessageTextSafe(
  message: ChatMessage,
  sessionKey: Buffer,
  personId: string,
): string {
  try {
    return decryptMessageTextStrict(message, sessionKey, personId);
  } catch {
    return '[Encrypted message unavailable]';
  }
}

async function persistChatMessage(params: {
  personId: string;
  role: 'user' | 'assistant';
  text: string;
  sessionKey: Buffer;
  photoId?: string | null;
  ootdLookId?: string | null;
}): Promise<ChatMessage> {
  const id = QuickCrypto.randomBytes(16).toString('hex');
  const now = new Date();
  const encrypted = encryptString(params.text, params.sessionKey, params.personId);

  const row: typeof chatMessages.$inferInsert = {
    id,
    personId: params.personId,
    role: params.role,
    encryptedContent: encrypted.ciphertext,
    contentIv: encrypted.iv,
    contentTag: encrypted.tag,
    photoId: params.photoId ?? null,
    ootdLookId: params.ootdLookId ?? null,
    createdAt: now,
  };

  const db = await getDatabase();
  await db.insert(chatMessages).values(row);
  await db.update(persons).set({ updatedAt: now }).where(eq(persons.id, params.personId));

  return row as ChatMessage;
}

/**
 * Loads and decrypts chronological conversation history for a Person,
 * hydrating attached photos and OOTD look cards.
 */
export async function getChatMessages(
  personId: string,
  sessionKey: Buffer,
): Promise<DecryptedChatMessage[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.personId, personId))
    .orderBy(asc(chatMessages.createdAt));

  const photoIds = Array.from(
    new Set(rows.map((r) => r.photoId).filter((id): id is string => Boolean(id))),
  );
  const photoMap = new Map<string, Photo>();
  if (photoIds.length > 0) {
    const photoRows = await db.select().from(photos).where(inArray(photos.id, photoIds));
    for (const p of photoRows) {
      photoMap.set(p.id, p);
    }
  }

  const lookMap = new Map<string, DecryptedOotdLook>();
  for (const r of rows) {
    if (r.ootdLookId && !lookMap.has(r.ootdLookId)) {
      const look = await getOotdLookById(r.ootdLookId, sessionKey).catch(() => null);
      if (look) {
        lookMap.set(r.ootdLookId, look);
      }
    }
  }

  return rows.map((row) => ({
    id: row.id,
    personId: row.personId,
    role: row.role,
    text: decryptMessageTextSafe(row, sessionKey, personId),
    photo: row.photoId ? (photoMap.get(row.photoId) ?? null) : null,
    ootdLook: row.ootdLookId ? (lookMap.get(row.ootdLookId) ?? null) : null,
    createdAt: row.createdAt,
  }));
}

export async function deleteChatMessage(messageId: string): Promise<void> {
  const db = await getDatabase();
  await db.delete(chatMessages).where(eq(chatMessages.id, messageId));
}

export async function clearPersonChat(personId: string): Promise<void> {
  const db = await getDatabase();
  await db.delete(chatMessages).where(eq(chatMessages.personId, personId));
}

function buildOotdNarrationTurn(params: {
  rawText: string;
  slots: OotdSlotSelection[];
  excludedCategories: string[];
  emptySlots: string[];
  totalWardrobeCount: number;
}): string {
  if (params.totalWardrobeCount === 0) {
    return (
      `User requested: "${params.rawText}"\n` +
      `Their Wardrobe currently has 0 garment items. Respond warmly in character inviting them to add wardrobe pieces in the Wardrobe tab first.`
    );
  }

  const pickedLines = params.slots.map(
    (s) =>
      `- ${s.slot.toUpperCase()} (${s.category}): ${s.itemLabel}${s.description ? ` — ${s.description}` : ''}`,
  );

  const lines = [
    `User requested outfit command: "${params.rawText}"`,
    pickedLines.length > 0
      ? `Selected items from their Wardrobe:\n${pickedLines.join('\n')}`
      : 'No matching items were found in the requested Wardrobe categories.',
  ];

  if (params.excludedCategories.length > 0) {
    lines.push(
      `CRITICAL CONSTRAINT: The user explicitly excluded [${params.excludedCategories.join(', ')}]. Do NOT include, suggest, or describe any items from those excluded categories.`,
    );
  }

  if (params.emptySlots.length > 0) {
    lines.push(
      `Note: These requested slots currently have no items in Wardrobe: ${params.emptySlots.join(', ')}. Mention gently if helpful.`,
    );
  }

  lines.push(
    'Present this curated look directly in your signature voice, weaving in any subtle style preferences you remember about the user.',
  );

  return lines.join('\n\n');
}

async function runAssistantTurn(params: {
  personId: string;
  userText: string;
  attachedPhoto: Photo | null;
  isNewlyUploadedPhoto: boolean;
  overrideSlots?: SendChatMessageParams['overrideSlots'];
  forceStyleMode?: 'random' | 'ai';
  sessionKey: Buffer;
}): Promise<{
  assistantMessage: DecryptedChatMessage | null;
  autoMovedToPastOotdPhotoId: string | null;
  error?: string;
}> {
  const person = await getPersonById(params.personId);
  if (!person) {
    return {
      assistantMessage: null,
      autoMovedToPastOotdPhotoId: null,
      error: 'Person not found',
    };
  }

  const prefs = await getOotdPreferences();
  const parsedCommand = parseOotdCommand(params.userText, params.overrideSlots);

  // Load recent conversation history for context (excluding the latest turn we're constructing)
  const allHistory = await getChatMessages(params.personId, params.sessionKey);
  const priorHistory = allHistory.slice(0, -1).slice(-MAX_CONTEXT_TURNS);
  const priorTurns: ConversationTurnInput[] = priorHistory.map((m) => ({
    role: m.role,
    text: m.text,
  }));

  // Branch A: /ootd, /secret, or /style outfit picking flow
  if (
    parsedCommand.command === 'ootd' ||
    parsedCommand.command === 'secret' ||
    parsedCommand.command === 'style'
  ) {
    const pickResult = await pickOutfitFromWardrobe({
      commandText: params.userText,
      overrideSlots: params.overrideSlots,
      cooldownDays: prefs.cooldownDays,
      personPrompt: person.personalityPrompt,
      personMemory: person.memoryText,
      forceStyleMode: params.forceStyleMode,
      sessionKey: params.sessionKey,
    });

    let savedLook: DecryptedOotdLook | null = null;
    if (pickResult.slots.length > 0) {
      savedLook = await saveOotdLook({
        personId: params.personId,
        triggerType: pickResult.triggerType,
        slots: pickResult.slots,
        sessionKey: params.sessionKey,
      });
    }

    const narrationUserPrompt = buildOotdNarrationTurn({
      rawText: params.userText,
      slots: pickResult.slots,
      excludedCategories: pickResult.excludedCategories,
      emptySlots: pickResult.emptySlots,
      totalWardrobeCount: pickResult.totalWardrobeCount,
    });

    const systemPrompt = buildPersonAuthoritativePrompt(person, {
      includeMemoryTrailerInstruction: prefs.autoLearnMemory,
    });

    let attachedImageUri: string | undefined;
    if (params.attachedPhoto) {
      attachedImageUri = await prepareVisionImageDataUri({
        encryptedPath: params.attachedPhoto.encryptedFilePath,
        iv: params.attachedPhoto.fileIv,
        tag: params.attachedPhoto.fileTag,
        sessionKey: params.sessionKey,
        aad: params.attachedPhoto.id,
      }).catch(() => undefined);
    }

    try {
      const llmRes = await queryLlmConversation({
        masterPrompt: systemPrompt,
        turns: [
          ...priorTurns,
          { role: 'user', text: narrationUserPrompt, imageBase64: attachedImageUri },
        ],
      });

      const parsed = parseStructuredResponse(llmRes.content);
      if (prefs.autoLearnMemory && parsed.memoryAdditions.length > 0) {
        await applyPiggybackMemoryUpdates(params.personId, parsed.memoryAdditions);
      }

      const savedRow = await persistChatMessage({
        personId: params.personId,
        role: 'assistant',
        text: parsed.cleanText || 'Here is the look I picked for you.',
        sessionKey: params.sessionKey,
        ootdLookId: savedLook?.id ?? null,
      });

      return {
        assistantMessage: {
          id: savedRow.id,
          personId: params.personId,
          role: 'assistant',
          text: parsed.cleanText || 'Here is the look I picked for you.',
          photo: null,
          ootdLook: savedLook,
          createdAt: savedRow.createdAt,
        },
        autoMovedToPastOotdPhotoId: null,
      };
    } catch (err) {
      // Offline / API error resilience: still persist and display the CSPRNG look card!
      const errMessage = err instanceof Error ? err.message : 'Unable to reach OpenRouter';
      if (savedLook) {
        const offlineText =
          'Picked this look privately with local CSPRNG while offline. Tap Retry for my styling note when connected.';
        const savedRow = await persistChatMessage({
          personId: params.personId,
          role: 'assistant',
          text: offlineText,
          sessionKey: params.sessionKey,
          ootdLookId: savedLook.id,
        });
        return {
          assistantMessage: {
            id: savedRow.id,
            personId: params.personId,
            role: 'assistant',
            text: offlineText,
            photo: null,
            ootdLook: savedLook,
            createdAt: savedRow.createdAt,
          },
          autoMovedToPastOotdPhotoId: null,
          error: errMessage,
        };
      }
      return {
        assistantMessage: null,
        autoMovedToPastOotdPhotoId: null,
        error: errMessage,
      };
    }
  }

  // Branch B: Standard & Multimodal Photo Conversation (Single-Pass)
  let systemPrompt = buildPersonAuthoritativePrompt(person, {
    includeMemoryTrailerInstruction: prefs.autoLearnMemory,
  });

  const needsPhotoClassification = Boolean(
    params.attachedPhoto &&
    params.isNewlyUploadedPhoto &&
    prefs.autoClassifyPhotos &&
    params.attachedPhoto.aiHasHumanBody === null,
  );

  if (needsPhotoClassification) {
    systemPrompt +=
      `\n\nAlso inspect the newly attached photo and append a hidden classification tag at the VERY END:\n` +
      `<photo_meta>{"hasHumanBodyMainSubject": boolean, "category": "top|bottom|underwear|hosiery|others", "item": "short label", "description": "tactile fabric/color/fit description"}</photo_meta>`;
  }

  let currentTurnText = params.userText;
  let imageBase64: string | undefined;

  if (params.attachedPhoto) {
    const meta = getDecryptedPhotoMetadata(params.attachedPhoto, params.sessionKey);
    if (meta.item || meta.description) {
      currentTurnText = `${currentTurnText}\n[Attached photo metadata — Category: ${params.attachedPhoto.category}, Item: ${meta.item || 'unspecified'}${meta.description ? `, Notes: ${meta.description}` : ''}]`;
    }
    imageBase64 = await prepareVisionImageDataUri({
      encryptedPath: params.attachedPhoto.encryptedFilePath,
      iv: params.attachedPhoto.fileIv,
      tag: params.attachedPhoto.fileTag,
      sessionKey: params.sessionKey,
      aad: params.attachedPhoto.id,
    });
  }

  try {
    const llmRes = await queryLlmConversation({
      masterPrompt: systemPrompt,
      turns: [...priorTurns, { role: 'user', text: currentTurnText, imageBase64 }],
    });

    const parsed = parseStructuredResponse(llmRes.content);

    if (prefs.autoLearnMemory && parsed.memoryAdditions.length > 0) {
      await applyPiggybackMemoryUpdates(params.personId, parsed.memoryAdditions);
    }

    let autoMovedPhotoId: string | null = null;
    if (params.attachedPhoto && parsed.photoMeta) {
      const targetKind =
        parsed.photoMeta.hasHumanBodyMainSubject === true ? 'past_ootd' : 'wardrobe';
      await savePhotoMetadata(
        params.attachedPhoto.id,
        {
          photoKind: targetKind,
          aiHasHumanBody: parsed.photoMeta.hasHumanBodyMainSubject,
          category: parsed.photoMeta.category
            ? normalizeWardrobeCategory(parsed.photoMeta.category)
            : undefined,
          item: parsed.photoMeta.item,
          description: parsed.photoMeta.description,
        },
        params.sessionKey,
      );
      if (targetKind === 'past_ootd' && params.attachedPhoto.photoKind !== 'past_ootd') {
        autoMovedPhotoId = params.attachedPhoto.id;
      }
    }

    const replyText = parsed.cleanText || 'Looking gorgeous.';
    const savedRow = await persistChatMessage({
      personId: params.personId,
      role: 'assistant',
      text: replyText,
      sessionKey: params.sessionKey,
    });

    return {
      assistantMessage: {
        id: savedRow.id,
        personId: params.personId,
        role: 'assistant',
        text: replyText,
        photo: null,
        ootdLook: null,
        createdAt: savedRow.createdAt,
      },
      autoMovedToPastOotdPhotoId: autoMovedPhotoId,
    };
  } catch (err) {
    return {
      assistantMessage: null,
      autoMovedToPastOotdPhotoId: null,
      error: err instanceof Error ? err.message : 'Failed to get response',
    };
  }
}

/**
 * Sends a Messenger/WhatsApp chat turn (text, photo, or /ootd command).
 * Optimistically saves the user message locally first so network failures can always be retried.
 */
export async function sendChatMessage(
  params: SendChatMessageParams,
): Promise<SendChatMessageResult> {
  useSessionStore.getState().touchActivity();

  const trimmedText = params.text.trim();
  if (!trimmedText && !params.attachment && !params.overrideSlots?.length) {
    throw new Error('Cannot send an empty message');
  }

  let attachedPhoto: Photo | null = null;
  let isNewlyUploadedPhoto = false;

  if (params.attachment) {
    const db = await getDatabase();
    if (params.attachment.kind === 'new_photo') {
      const ingested = await ingestPhoto(params.attachment.uri, params.sessionKey, {
        photoKind: params.attachment.photoKind ?? 'wardrobe',
        category: params.attachment.category ?? 'others',
        item: params.attachment.item,
        description: params.attachment.description,
      });
      isNewlyUploadedPhoto = !ingested.isDuplicate;
      const rows = await db.select().from(photos).where(eq(photos.id, ingested.photoId)).limit(1);
      attachedPhoto = rows[0] ?? ingested.photo ?? null;
    } else {
      const rows = await db
        .select()
        .from(photos)
        .where(eq(photos.id, params.attachment.photoId))
        .limit(1);
      attachedPhoto = rows[0] ?? null;
    }
  }

  const displayText = trimmedText || (attachedPhoto ? 'Sent a photo' : '/ootd');

  // 1. Optimistic local save FIRST
  const savedUserRow = await persistChatMessage({
    personId: params.personId,
    role: 'user',
    text: displayText,
    sessionKey: params.sessionKey,
    photoId: attachedPhoto?.id ?? null,
  });

  const userMessage: DecryptedChatMessage = {
    id: savedUserRow.id,
    personId: params.personId,
    role: 'user',
    text: displayText,
    photo: attachedPhoto,
    ootdLook: null,
    createdAt: savedUserRow.createdAt,
  };

  // 2. Dispatch assistant reply / OOTD engine
  const replyResult = await runAssistantTurn({
    personId: params.personId,
    userText: displayText,
    attachedPhoto,
    isNewlyUploadedPhoto,
    overrideSlots: params.overrideSlots,
    forceStyleMode: params.forceStyleMode,
    sessionKey: params.sessionKey,
  });

  return {
    userMessage,
    assistantMessage: replyResult.assistantMessage,
    autoMovedToPastOotdPhotoId: replyResult.autoMovedToPastOotdPhotoId,
    error: replyResult.error,
  };
}

/**
 * Retries generating an assistant reply for an already-persisted user message.
 */
export async function retryAssistantReply(params: {
  personId: string;
  userMessage: DecryptedChatMessage;
  sessionKey: Buffer;
}): Promise<{
  assistantMessage: DecryptedChatMessage | null;
  autoMovedToPastOotdPhotoId: string | null;
  error?: string;
}> {
  useSessionStore.getState().touchActivity();
  return runAssistantTurn({
    personId: params.personId,
    userText: params.userMessage.text,
    attachedPhoto: params.userMessage.photo,
    isNewlyUploadedPhoto: false,
    sessionKey: params.sessionKey,
  });
}

/**
 * Post-OOTD Fit Check Mirror Loop:
 * Saves the captured mirror selfie directly to Past OOTD, links it to the OOTD look,
 * and asks the styling Person for visual feedback on the worn outfit.
 */
export async function sendFitCheckForLook(params: {
  personId: string;
  look: DecryptedOotdLook;
  photoUri: string;
  sessionKey: Buffer;
  note?: string;
}): Promise<SendChatMessageResult> {
  const itemSummary = params.look.slots.map((s) => `${s.slot}: ${s.itemLabel}`).join(', ');

  const ingested = await ingestPhoto(params.photoUri, params.sessionKey, {
    photoKind: 'past_ootd',
    aiHasHumanBody: true,
    category: 'others',
    item: 'fit check',
    description: `Wearing OOTD: ${itemSummary}`,
  });

  await linkFitCheckPhoto(params.look.id, ingested.photoId);

  const promptText =
    params.note?.trim() ||
    `Fit check! Here I am wearing the outfit you picked (${itemSummary}). How does it look on me?`;

  return sendChatMessage({
    personId: params.personId,
    text: promptText,
    attachment: { kind: 'existing_photo', photoId: ingested.photoId },
    sessionKey: params.sessionKey,
  });
}
