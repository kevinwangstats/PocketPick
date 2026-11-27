import { eq } from 'drizzle-orm';
import { getDatabase } from '../../db/client';
import { persons } from '../../db/schema';
import { MemoryAddition } from '../llm/structuredTrailerParser';
import { queryLlm } from '../llm/llmClient';

export const DEFAULT_MEMORY_TEMPLATE = `## Preferred Styles & Silhouettes

## Favorite Colors & Palettes

## Fabrics & Textures That Make Me Tingle

## Fit, Mood & Sensual Preferences

## Custom Notes & Observations
`;

interface ParsedSection {
  heading: string;
  lines: string[];
}

function parseMarkdownSections(raw: string): ParsedSection[] {
  const source = raw.trim().length > 0 ? raw : DEFAULT_MEMORY_TEMPLATE;
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      current = { heading: trimmed.slice(3).trim(), lines: [] };
      sections.push(current);
    } else if (trimmed.length > 0) {
      if (!current) {
        current = { heading: 'Custom Notes & Observations', lines: [] };
        sections.push(current);
      }
      current.lines.push(trimmed);
    }
  }

  return sections;
}

function serializeMarkdownSections(sections: ParsedSection[]): string {
  return (
    sections
      .map((sec) => {
        const header = `## ${sec.heading}`;
        if (sec.lines.length === 0) return header;
        return `${header}\n${sec.lines.join('\n')}`;
      })
      .join('\n\n')
      .trim() + '\n'
  );
}

/**
 * Pure helper that appends a bullet into the matching Markdown section (creating a new
 * `## <section>` dynamically if needed) while deduplicating existing entries.
 */
export function mergeMemoryInsightIntoText(
  currentMemory: string,
  sectionTitle: string,
  itemText: string,
): string {
  const cleanItem = itemText.replace(/^[-*•]\s*/, '').trim();
  if (!cleanItem) return currentMemory || DEFAULT_MEMORY_TEMPLATE;

  const cleanSection = sectionTitle.trim() || 'Custom Notes & Observations';
  const sections = parseMarkdownSections(currentMemory);

  let target = sections.find((s) => s.heading.toLowerCase() === cleanSection.toLowerCase());
  if (!target) {
    target = { heading: cleanSection, lines: [] };
    sections.push(target);
  }

  const normalizedCandidate = cleanItem.toLowerCase();
  const alreadyExists = target.lines.some(
    (line) =>
      line
        .replace(/^[-*•]\s*/, '')
        .trim()
        .toLowerCase() === normalizedCandidate,
  );

  if (!alreadyExists) {
    target.lines.push(`- ${cleanItem}`);
  }

  return serializeMarkdownSections(sections);
}

export async function getPersonMemory(personId: string): Promise<string> {
  const db = await getDatabase();
  const rows = await db
    .select({ memoryText: persons.memoryText })
    .from(persons)
    .where(eq(persons.id, personId))
    .limit(1);

  const text = rows[0]?.memoryText ?? '';
  return text.trim().length > 0 ? text : DEFAULT_MEMORY_TEMPLATE;
}

export async function savePersonMemory(personId: string, memoryText: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date();
  await db
    .update(persons)
    .set({
      memoryText: memoryText.trim().length > 0 ? memoryText : DEFAULT_MEMORY_TEMPLATE,
      memoryUpdatedAt: now,
      updatedAt: now,
    })
    .where(eq(persons.id, personId));
}

export async function appendMemoryInsight(
  personId: string,
  sectionTitle: string,
  itemText: string,
): Promise<string> {
  const current = await getPersonMemory(personId);
  const updated = mergeMemoryInsightIntoText(current, sectionTitle, itemText);
  if (updated !== current) {
    await savePersonMemory(personId, updated);
  }
  return updated;
}

export async function applyPiggybackMemoryUpdates(
  personId: string,
  additions: MemoryAddition[],
): Promise<string> {
  const current = await getPersonMemory(personId);
  if (!additions || additions.length === 0) {
    return current;
  }

  let next = current;
  for (const add of additions) {
    next = mergeMemoryInsightIntoText(next, add.section, add.item);
  }

  if (next !== current) {
    await savePersonMemory(personId, next);
  }
  return next;
}

/**
 * Optional explicit memory distillation from recent chat lines for Settings "Distill Memory" action.
 */
export async function distillMemoryFromTranscript(
  personId: string,
  transcriptLines: string[],
): Promise<string> {
  if (transcriptLines.length === 0) {
    return getPersonMemory(personId);
  }

  const current = await getPersonMemory(personId);
  const prompt =
    `Review the conversation snippets below and extract ONLY durable user styling preferences ` +
    `(preferred styles, favorite colors, fabrics/textures that excite or make them tingle, fit/mood preferences).\n` +
    `Ignore one-off chitchat. Return ONLY a JSON array of {"section": string, "item": string} objects (or [] if nothing new).\n\n` +
    `Existing Memory:\n${current}\n\nConversation:\n${transcriptLines.join('\n')}`;

  const res = await queryLlm({ userPrompt: prompt, temperature: 0.2 });
  const cleaned = res.content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as MemoryAddition[];
    if (Array.isArray(parsed)) {
      return applyPiggybackMemoryUpdates(personId, parsed);
    }
  } catch {
    // Ignore malformed JSON
  }
  return current;
}
