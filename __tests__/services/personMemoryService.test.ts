import { getDatabase } from '@/db/client';
import {
  DEFAULT_MEMORY_TEMPLATE,
  mergeMemoryInsightIntoText,
  getPersonMemory,
  savePersonMemory,
  applyPiggybackMemoryUpdates,
} from '@/services/persons/personMemoryService';

describe('Extensible Per-Personality Plain-Text Memory Service (TDD)', () => {
  let memoryStore = '';

  beforeEach(async () => {
    memoryStore = DEFAULT_MEMORY_TEMPLATE;
    jest.restoreAllMocks();

    const db = await getDatabase();
    jest.spyOn(db, 'select').mockImplementation(() => {
      return {
        from: () => ({
          where: () => ({
            limit: async () => [{ memoryText: memoryStore }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>;
    });

    jest.spyOn(db, 'update').mockImplementation(() => {
      return {
        set: (patch: { memoryText?: string }) => ({
          where: async () => {
            if (patch.memoryText !== undefined) {
              memoryStore = patch.memoryText;
            }
          },
        }),
      } as unknown as ReturnType<typeof db.update>;
    });
  });

  it('merges insights into existing sections and deduplicates case-insensitively', () => {
    const step1 = mergeMemoryInsightIntoText(
      DEFAULT_MEMORY_TEMPLATE,
      'Fabrics & Textures That Make Me Tingle',
      'Sheer black Chantilly lace',
    );
    expect(step1).toContain('- Sheer black Chantilly lace');

    const step2 = mergeMemoryInsightIntoText(
      step1,
      'Fabrics & Textures That Make Me Tingle',
      'sheer black chantilly lace',
    );
    expect(step2).toBe(step1);
  });

  it('dynamically expands with new custom sections as the app grows', () => {
    const expanded = mergeMemoryInsightIntoText(
      DEFAULT_MEMORY_TEMPLATE,
      'Evening Scent & Atmosphere',
      'Warm vanilla & candlelit silk evenings',
    );

    expect(expanded).toContain('## Evening Scent & Atmosphere');
    expect(expanded).toContain('- Warm vanilla & candlelit silk evenings');
  });

  it('persists and retrieves plain-text memory and applies piggyback <memory_add> updates', async () => {
    await savePersonMemory('p-1', '## Favorite Colors & Palettes\n- Deep burgundy');
    expect(await getPersonMemory('p-1')).toContain('- Deep burgundy');

    const updated = await applyPiggybackMemoryUpdates('p-1', [
      { section: 'Favorite Colors & Palettes', item: 'Champagne gold' },
      { section: 'Fabrics & Textures That Make Me Tingle', item: 'Liquid satin' },
    ]);

    expect(updated).toContain('- Deep burgundy');
    expect(updated).toContain('- Champagne gold');
    expect(updated).toContain('- Liquid satin');
  });
});
