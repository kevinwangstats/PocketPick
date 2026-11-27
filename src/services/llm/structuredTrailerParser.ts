export interface MemoryAddition {
  section: string;
  item: string;
}

export interface PiggybackPhotoMeta {
  hasHumanBodyMainSubject?: boolean;
  category?: string;
  item?: string;
  description?: string;
}

export interface ParsedStructuredResponse {
  cleanText: string;
  memoryAdditions: MemoryAddition[];
  photoMeta: PiggybackPhotoMeta | null;
}

const MEMORY_BLOCK_REGEX = /<memory_add>([\s\S]*?)<\/memory_add>/gi;
const PHOTO_META_REGEX = /<photo_meta>([\s\S]*?)<\/photo_meta>/gi;
const UNCLOSED_TRAILER_REGEX = /<(?:memory_add|photo_meta)>[\s\S]*$/i;

function normalizeMemoryItems(rawBlock: string): MemoryAddition[] {
  const trimmed = rawBlock.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    const results: MemoryAddition[] = [];

    for (const entry of entries) {
      if (typeof entry === 'string' && entry.trim()) {
        results.push({ section: 'Custom Notes & Observations', item: entry.trim() });
      } else if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        const item = typeof record.item === 'string' ? record.item.trim() : '';
        const section =
          typeof record.section === 'string' && record.section.trim()
            ? record.section.trim()
            : 'Custom Notes & Observations';
        if (item) {
          results.push({ section, item });
        }
      }
    }
    return results;
  } catch {
    // Fallback: parse plain lines ("Section: trait" or "- trait")
    return trimmed
      .split('\n')
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean)
      .map((line) => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 2 && colonIdx < 48) {
          return {
            section: line.slice(0, colonIdx).trim(),
            item: line.slice(colonIdx + 1).trim(),
          };
        }
        return { section: 'Custom Notes & Observations', item: line };
      })
      .filter((entry) => entry.item.length > 0);
  }
}

function normalizePhotoMeta(rawBlock: string): PiggybackPhotoMeta | null {
  const trimmed = rawBlock.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;

    const meta: PiggybackPhotoMeta = {};
    if (typeof parsed.hasHumanBodyMainSubject === 'boolean') {
      meta.hasHumanBodyMainSubject = parsed.hasHumanBodyMainSubject;
    }
    if (typeof parsed.category === 'string' && parsed.category.trim()) {
      meta.category = parsed.category.trim().toLowerCase();
    }
    if (typeof parsed.item === 'string' && parsed.item.trim()) {
      meta.item = parsed.item.trim();
    }
    if (typeof parsed.description === 'string' && parsed.description.trim()) {
      meta.description = parsed.description.trim();
    }

    return Object.keys(meta).length > 0 ? meta : null;
  } catch {
    return null;
  }
}

/**
 * Parses and strips hidden <memory_add> and <photo_meta> XML/JSON trailer blocks
 * from a single-pass OpenRouter response so visible chat stays clean and 1 turn = 1 API call.
 */
export function parseStructuredResponse(rawContent: string): ParsedStructuredResponse {
  if (!rawContent) {
    return { cleanText: '', memoryAdditions: [], photoMeta: null };
  }

  const memoryAdditions: MemoryAddition[] = [];
  let photoMeta: PiggybackPhotoMeta | null = null;

  let stripped = rawContent.replace(MEMORY_BLOCK_REGEX, (_match, inner: string) => {
    memoryAdditions.push(...normalizeMemoryItems(inner));
    return '';
  });

  stripped = stripped.replace(PHOTO_META_REGEX, (_match, inner: string) => {
    const parsedMeta = normalizePhotoMeta(inner);
    if (parsedMeta) {
      photoMeta = parsedMeta;
    }
    return '';
  });

  // Strip any truncated unclosed trailer tag if output hit a token boundary
  stripped = stripped.replace(UNCLOSED_TRAILER_REGEX, '');

  return {
    cleanText: stripped.replace(/\n{3,}/g, '\n\n').trim(),
    memoryAdditions,
    photoMeta,
  };
}
