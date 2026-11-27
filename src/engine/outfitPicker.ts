import { Buffer } from '@craftzdog/react-native-buffer';
import { WardrobeCategory } from '../db/schema';
import { getRandomInt } from '../services/randomizer/csprng';
import { listPhotosWithMetadata } from '../services/photos/photoService';
import { queryLlm } from '../services/llm/llmClient';
import { parseOotdCommand } from './constraintParser';
import {
  OotdSlotSelection,
  OotdTriggerType,
  OutfitSlotKey,
  PickOutfitOptions,
  PickOutfitResult,
  WardrobeCandidate,
} from './types';

const BRA_SUBTYPE_REGEX = /\b(bra|bras|bralette|bralettes|bustier|corset|bandeau)\b/i;
const PANTIES_SUBTYPE_REGEX =
  /\b(panties|panty|thong|thongs|g-?string|brief|briefs|knickers|boyshort|cheeky)\b/i;

/**
 * Unbiased hardware CSPRNG uniform selection from a non-empty array.
 */
export function pickUniformRandom<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error('Cannot pick from an empty pool');
  }
  if (items.length === 1) {
    return items[0];
  }
  return items[getRandomInt(0, items.length - 1)];
}

/**
 * Classifies an underwear item into bra vs panties sub-type using its decrypted item & description.
 */
export function classifyUnderwearSubtype(
  item: string,
  description: string,
): 'bra' | 'panties' | 'other' {
  const combined = `${item} ${description}`;
  const isBra = BRA_SUBTYPE_REGEX.test(combined);
  const isPanties = PANTIES_SUBTYPE_REGEX.test(combined);

  if (isBra && !isPanties) return 'bra';
  if (isPanties && !isBra) return 'panties';
  if (BRA_SUBTYPE_REGEX.test(item)) return 'bra';
  if (PANTIES_SUBTYPE_REGEX.test(item)) return 'panties';
  return 'other';
}

function slotToCategory(slot: OutfitSlotKey): WardrobeCategory {
  if (slot === 'bra' || slot === 'panties') return 'underwear';
  return slot;
}

function getPoolForSlot(candidates: WardrobeCandidate[], slot: OutfitSlotKey): WardrobeCandidate[] {
  if (slot === 'bra' || slot === 'panties') {
    const underwearPool = candidates.filter((c) => c.category === 'underwear');
    return underwearPool.filter((c) => classifyUnderwearSubtype(c.item, c.description) === slot);
  }
  return candidates.filter((c) => c.category === slot);
}

function applyCooldownAndExclusions(
  pool: WardrobeCandidate[],
  cooldownDays: number,
  excludePhotoIds: Set<string>,
): WardrobeCandidate[] {
  let working = pool.filter((c) => !excludePhotoIds.has(c.photo.id));
  if (working.length === 0) {
    working = pool;
  }

  if (cooldownDays > 0) {
    const cutoffMs = Date.now() - cooldownDays * 24 * 60 * 60 * 1000;
    const freshPool = working.filter((c) => {
      if (!c.photo.lastWornAt) return true;
      return c.photo.lastWornAt.getTime() < cutoffMs;
    });
    if (freshPool.length > 0) {
      return freshPool;
    }
  }

  return working;
}

function toSlotSelection(
  slot: OutfitSlotKey,
  candidate: WardrobeCandidate | null,
): OotdSlotSelection {
  if (!candidate) {
    return {
      slot,
      category: slotToCategory(slot),
      photoId: null,
      itemLabel: slot,
      description: '',
      thumbnailPath: null,
      thumbnailIv: null,
      thumbnailTag: null,
      isMissing: true,
    };
  }

  return {
    slot,
    category: candidate.category,
    photoId: candidate.photo.id,
    itemLabel: candidate.item || slot,
    description: candidate.description,
    thumbnailPath: candidate.photo.encryptedThumbnailPath,
    thumbnailIv: candidate.photo.thumbnailIv,
    thumbnailTag: candidate.photo.thumbnailTag,
    isMissing: false,
  };
}

/**
 * Resolves the effective requested slots, gracefully collapsing ['bra', 'panties'] into
 * ['underwear'] only when underwear exists that isn't explicitly split into bra/panties.
 */
function resolveEffectiveSlots(
  requestedSlots: OutfitSlotKey[],
  candidates: WardrobeCandidate[],
): OutfitSlotKey[] {
  const hasBra = getPoolForSlot(candidates, 'bra').length > 0;
  const hasPanties = getPoolForSlot(candidates, 'panties').length > 0;
  const hasAnyUnderwear = candidates.some((c) => c.category === 'underwear');

  const resolved: OutfitSlotKey[] = [];
  for (const slot of requestedSlots) {
    if ((slot === 'bra' || slot === 'panties') && !hasBra && !hasPanties && hasAnyUnderwear) {
      if (!resolved.includes('underwear')) {
        resolved.push('underwear');
      }
    } else {
      resolved.push(slot);
    }
  }
  return resolved;
}

async function tryAiCuratedSelection(params: {
  slots: OutfitSlotKey[];
  candidatesBySlot: Map<OutfitSlotKey, WardrobeCandidate[]>;
  constraintText: string;
  personPrompt?: string;
  personMemory?: string;
}): Promise<Map<OutfitSlotKey, WardrobeCandidate> | null> {
  const catalogLines: string[] = [];
  for (const slot of params.slots) {
    const pool = params.candidatesBySlot.get(slot) ?? [];
    if (pool.length === 0) continue;
    catalogLines.push(`SLOT "${slot}":`);
    for (const entry of pool) {
      const desc = entry.description ? ` — ${entry.description}` : '';
      catalogLines.push(`  - id="${entry.photo.id}" | item="${entry.item || slot}"${desc}`);
    }
  }

  if (catalogLines.length === 0) {
    return null;
  }

  const prompt =
    `Curate a harmonious outfit for request: "${params.constraintText || 'daily OOTD'}".\n` +
    (params.personMemory ? `User Style Memory:\n${params.personMemory}\n\n` : '') +
    `Choose EXACTLY ONE photo id per slot from the wardrobe catalog below. Return ONLY valid JSON mapping slot name to photo id.\n\n` +
    catalogLines.join('\n');

  try {
    const res = await queryLlm({
      userPrompt: prompt,
      masterPrompt: params.personPrompt,
      temperature: 0.5,
    });

    const cleaned = res.content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const chosen = new Map<OutfitSlotKey, WardrobeCandidate>();

    for (const slot of params.slots) {
      const pool = params.candidatesBySlot.get(slot) ?? [];
      const selectedId = typeof parsed[slot] === 'string' ? parsed[slot] : null;
      const match = selectedId ? pool.find((c) => c.photo.id === selectedId) : undefined;
      if (match) {
        chosen.set(slot, match);
      }
    }

    return chosen.size > 0 ? chosen : null;
  } catch {
    return null;
  }
}

/**
 * Decoupled Outfit Picking Engine:
 * - Reads strictly from 'wardrobe' photos (ignoring 'past_ootd' body selfies).
 * - Honors exclusions ("no top and no pants"), inclusions ("only bra and panties"), and /secret.
 * - Pairs 1 bra + 1 panties when requested/appropriate.
 * - Falls back seamlessly to hardware CSPRNG offline if AI curation is unavailable.
 */
export async function pickOutfitFromWardrobe(
  options: PickOutfitOptions,
): Promise<PickOutfitResult> {
  const parsed = parseOotdCommand(options.commandText, options.overrideSlots);
  const triggerType: OotdTriggerType =
    parsed.command === 'secret' || parsed.command === 'style' ? parsed.command : 'ootd';

  const allWardrobe = await listPhotosWithMetadata(options.sessionKey, 'wardrobe');
  const candidates: WardrobeCandidate[] = allWardrobe.map((entry) => ({
    photo: entry.photo,
    category: entry.photo.category,
    item: entry.item,
    description: entry.description,
  }));

  const effectiveSlots = resolveEffectiveSlots(parsed.activeSlots, candidates);
  const cooldownDays = options.cooldownDays ?? 0;

  const candidatesBySlot = new Map<OutfitSlotKey, WardrobeCandidate[]>();
  const usedPhotoIds = new Set<string>();

  for (const slot of effectiveSlots) {
    const rawPool = getPoolForSlot(candidates, slot);
    const filtered = applyCooldownAndExclusions(rawPool, cooldownDays, usedPhotoIds);
    candidatesBySlot.set(slot, filtered);
  }

  let usedAiCuration = false;
  let aiChosen: Map<OutfitSlotKey, WardrobeCandidate> | null = null;
  const shouldUseAi =
    options.forceStyleMode === 'ai' ||
    (options.forceStyleMode !== 'random' && triggerType === 'style');

  if (shouldUseAi && candidates.length > 0) {
    aiChosen = await tryAiCuratedSelection({
      slots: effectiveSlots,
      candidatesBySlot,
      constraintText: parsed.rawArgs,
      personPrompt: options.personPrompt,
      personMemory: options.personMemory,
    });
    usedAiCuration = Boolean(aiChosen && aiChosen.size > 0);
  }

  const selections: OotdSlotSelection[] = [];
  const emptySlots: OutfitSlotKey[] = [];

  for (const slot of effectiveSlots) {
    const aiMatch = aiChosen?.get(slot);
    let selected: WardrobeCandidate | null = null;

    if (aiMatch && !usedPhotoIds.has(aiMatch.photo.id)) {
      selected = aiMatch;
    } else {
      const pool = (candidatesBySlot.get(slot) ?? []).filter((c) => !usedPhotoIds.has(c.photo.id));
      if (pool.length > 0) {
        selected = pickUniformRandom(pool);
      }
    }

    if (selected) {
      usedPhotoIds.add(selected.photo.id);
      selections.push(toSlotSelection(slot, selected));
    } else {
      emptySlots.push(slot);
    }
  }

  return {
    triggerType,
    slots: selections,
    excludedCategories: parsed.excludedCategories,
    emptySlots,
    usedAiCuration,
    rawConstraintText: parsed.rawArgs,
    totalWardrobeCount: candidates.length,
  };
}

/**
 * Swaps a single unlocked OOTD slot using hardware CSPRNG, excluding the currently shown photo
 * whenever alternatives exist in that slot's wardrobe pool.
 */
export async function swapOutfitSlot(params: {
  existingSlots: OotdSlotSelection[];
  targetSlot: OutfitSlotKey;
  cooldownDays?: number;
  sessionKey: Buffer;
}): Promise<{ updatedSlots: OotdSlotSelection[]; swappedSelection: OotdSlotSelection | null }> {
  const { existingSlots, targetSlot, cooldownDays = 0, sessionKey } = params;
  const allWardrobe = await listPhotosWithMetadata(sessionKey, 'wardrobe');
  const candidates: WardrobeCandidate[] = allWardrobe.map((entry) => ({
    photo: entry.photo,
    category: entry.photo.category,
    item: entry.item,
    description: entry.description,
  }));

  const currentSlotEntry = existingSlots.find((s) => s.slot === targetSlot);
  const excludeIds = new Set<string>();
  for (const s of existingSlots) {
    if (s.photoId) {
      excludeIds.add(s.photoId);
    }
  }

  const rawPool = getPoolForSlot(candidates, targetSlot);
  if (rawPool.length === 0) {
    return { updatedSlots: existingSlots, swappedSelection: null };
  }

  const preferredPool = applyCooldownAndExclusions(rawPool, cooldownDays, excludeIds);
  const fallbackPool = currentSlotEntry?.photoId
    ? rawPool.filter((c) => c.photo.id !== currentSlotEntry.photoId)
    : rawPool;
  const finalPool =
    preferredPool.length > 0 ? preferredPool : fallbackPool.length > 0 ? fallbackPool : rawPool;

  const picked = pickUniformRandom(finalPool);
  const swappedSelection = toSlotSelection(targetSlot, picked);

  const updatedSlots = existingSlots.map((s) => (s.slot === targetSlot ? swappedSelection : s));

  return { updatedSlots, swappedSelection };
}
