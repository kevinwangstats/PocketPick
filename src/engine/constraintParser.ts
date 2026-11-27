import { WardrobeCategory, WARDROBE_CATEGORIES } from '../db/schema';
import { OutfitSlotKey, ParsedOotdCommand, SKIN_OUTWARD_SLOT_ORDER } from './types';

const SLOT_SYNONYMS: Array<{ slot: OutfitSlotKey; category: WardrobeCategory; patterns: RegExp }> =
  [
    {
      slot: 'bra',
      category: 'underwear',
      patterns: /\b(bras?|bralettes?|bustiers?|corsets?)\b/i,
    },
    {
      slot: 'panties',
      category: 'underwear',
      patterns: /\b(panties|panty|thongs?|g-?strings?|briefs?|knickers?|boyshorts?)\b/i,
    },
    {
      slot: 'underwear',
      category: 'underwear',
      patterns: /\b(underwear|lingerie|intimates?|undies)\b/i,
    },
    {
      slot: 'hosiery',
      category: 'hosiery',
      patterns: /\b(hosiery|stockings?|tights?|thigh[-\s]?highs?|nylons?|garters?|socks?)\b/i,
    },
    {
      slot: 'top',
      category: 'top',
      patterns:
        /\b(tops?|shirts?|t[-\s]?shirts?|tees?|blouses?|camisoles?|sweaters?|hoodies?|tanks?)\b/i,
    },
    {
      slot: 'bottom',
      category: 'bottom',
      patterns: /\b(bottoms?|pants|trousers?|jeans|skirts?|shorts|leggings?)\b/i,
    },
    {
      slot: 'others',
      category: 'others',
      patterns: /\b(others?|accessories?|shoes?|heels?|boots?|jackets?|outerwear|bags?|jewelry)\b/i,
    },
  ];

const COMMAND_REGEX = /^\/(ootd|secret|style|fitcheck)(?:\s+([\s\S]*))?$/i;

function findSlotsInPhrase(phrase: string): OutfitSlotKey[] {
  const matched = new Set<OutfitSlotKey>();
  for (const entry of SLOT_SYNONYMS) {
    if (entry.patterns.test(phrase)) {
      matched.add(entry.slot);
    }
  }
  return Array.from(matched);
}

function slotToCategory(slot: OutfitSlotKey): WardrobeCategory {
  if (slot === 'bra' || slot === 'panties') return 'underwear';
  return slot;
}

/**
 * Parses slash commands (/ootd, /secret, /style, /fitcheck) and natural-language constraints
 * such as "/ootd with no top and no pants" or "/ootd only bra and panties".
 */
export function parseOotdCommand(
  rawText: string,
  overrideSlots?: OutfitSlotKey[],
): ParsedOotdCommand {
  const trimmed = rawText.trim();
  const match = COMMAND_REGEX.exec(trimmed);

  if (!match && (!overrideSlots || overrideSlots.length === 0)) {
    return {
      command: null,
      rawArgs: trimmed,
      activeSlots: [],
      pairBraAndPanties: false,
      excludedCategories: [],
    };
  }

  const command = (match ? match[1].toLowerCase() : 'ootd') as
    'ootd' | 'secret' | 'style' | 'fitcheck';
  const rawArgs = (match?.[2] ?? (match ? '' : trimmed)).trim();

  if (overrideSlots && overrideSlots.length > 0) {
    const activeSet = new Set(overrideSlots);
    const ordered = SKIN_OUTWARD_SLOT_ORDER.filter((s) => activeSet.has(s));
    const activeCategories = new Set(ordered.map(slotToCategory));
    const excludedCategories = WARDROBE_CATEGORIES.filter((c) => !activeCategories.has(c));
    return {
      command,
      rawArgs,
      activeSlots: ordered,
      pairBraAndPanties: activeSet.has('bra') || activeSet.has('panties'),
      excludedCategories,
    };
  }

  if (command === 'secret') {
    return {
      command,
      rawArgs,
      activeSlots: ['bra', 'panties', 'hosiery'],
      pairBraAndPanties: true,
      excludedCategories: ['top', 'bottom', 'others'],
    };
  }

  if (command === 'fitcheck') {
    return {
      command,
      rawArgs,
      activeSlots: [],
      pairBraAndPanties: false,
      excludedCategories: [],
    };
  }

  const lower = rawArgs.toLowerCase();

  // 1. Check explicit inclusion mode ("only bra and panties", "just underwear", etc.)
  const inclusionSegmentMatch = /\b(?:only|just|strictly)\s+([^.;!\n]+)/i.exec(lower);
  if (inclusionSegmentMatch) {
    const includedSlots = findSlotsInPhrase(inclusionSegmentMatch[1]);
    if (includedSlots.length > 0) {
      const slotSet = new Set<OutfitSlotKey>(includedSlots);
      if (slotSet.has('underwear') && !slotSet.has('bra') && !slotSet.has('panties')) {
        slotSet.delete('underwear');
        slotSet.add('bra');
        slotSet.add('panties');
      }
      const ordered = SKIN_OUTWARD_SLOT_ORDER.filter((s) => slotSet.has(s));
      const activeCats = new Set(ordered.map(slotToCategory));
      return {
        command,
        rawArgs,
        activeSlots: ordered,
        pairBraAndPanties: slotSet.has('bra') || slotSet.has('panties'),
        excludedCategories: WARDROBE_CATEGORIES.filter((c) => !activeCats.has(c)),
      };
    }
  }

  // 2. Check exclusion clauses ("no top and no pants", "without skirt", "skip hosiery")
  const excludedCategoriesSet = new Set<WardrobeCategory>();
  const excludedSubSlots = new Set<OutfitSlotKey>();
  const exclusionClauseRegex =
    /\b(?:with\s+no|without|no|skip|omit|exclude)\s+([^.;!\n]+?)(?=\s+(?:and\s+(?:with\s+|only\s+)|but|for|tonight|today|$)|\s*$)/gi;

  // Also scan individual "no/without <item>" tokens so chained "no top and no pants" works cleanly
  const singleExclusionRegex =
    /\b(?:with\s+no|without|no|skip|omit|exclude)\s+(?:any\s+|a\s+|an\s+|my\s+)?([a-z\s,-]+?)(?=\s+(?:with\s+no|without|no|skip|omit|exclude|but|for)\b|[.;!\n]|$)/gi;

  for (const regex of [singleExclusionRegex, exclusionClauseRegex]) {
    let execMatch: RegExpExecArray | null;
    while ((execMatch = regex.exec(lower)) !== null) {
      const fragment = execMatch[1];
      const found = findSlotsInPhrase(fragment);
      for (const slot of found) {
        if (slot === 'bra' || slot === 'panties') {
          excludedSubSlots.add(slot);
        } else {
          excludedCategoriesSet.add(slotToCategory(slot));
        }
      }
    }
  }

  // Build active slots across the 5 standard categories
  const activeSlots: OutfitSlotKey[] = [];
  const excludedTopAndBottom =
    excludedCategoriesSet.has('top') && excludedCategoriesSet.has('bottom');
  const explicitBraOrPanties =
    /\b(bras?|bralettes?|panties|panty|thongs?|briefs?|knickers?)\b/i.test(lower);
  const pairBraAndPanties =
    !excludedCategoriesSet.has('underwear') && (excludedTopAndBottom || explicitBraOrPanties);

  if (!excludedCategoriesSet.has('underwear')) {
    if (pairBraAndPanties) {
      if (!excludedSubSlots.has('bra')) activeSlots.push('bra');
      if (!excludedSubSlots.has('panties')) activeSlots.push('panties');
    } else {
      activeSlots.push('underwear');
    }
  }

  if (!excludedCategoriesSet.has('hosiery')) activeSlots.push('hosiery');
  if (!excludedCategoriesSet.has('top')) activeSlots.push('top');
  if (!excludedCategoriesSet.has('bottom')) activeSlots.push('bottom');
  if (!excludedCategoriesSet.has('others')) activeSlots.push('others');

  return {
    command,
    rawArgs,
    activeSlots,
    pairBraAndPanties,
    excludedCategories: Array.from(excludedCategoriesSet),
  };
}

/**
 * Formats a Quick-Builder sheet selection into a clean command message string.
 */
export function buildQuickSlotsCommandText(
  selectedSlots: OutfitSlotKey[],
  mode: 'random' | 'ai',
  note?: string,
): string {
  const prefix = mode === 'ai' ? '/style' : '/ootd';
  const labels = selectedSlots.join(', ');
  const trimmedNote = note?.trim();
  if (trimmedNote) {
    return `${prefix} only ${labels} — ${trimmedNote}`;
  }
  return `${prefix} only ${labels}`;
}
