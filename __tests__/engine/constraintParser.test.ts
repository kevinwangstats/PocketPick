import { parseOotdCommand, buildQuickSlotsCommandText } from '@/engine/constraintParser';

describe('OOTD Natural-Language Constraint Parser (TDD)', () => {
  it('returns null command for regular chat text without slash command', () => {
    const parsed = parseOotdCommand('What should I wear to dinner tonight?');
    expect(parsed.command).toBeNull();
  });

  it('defaults plain /ootd to all 5 wardrobe categories in skin-outward order', () => {
    const parsed = parseOotdCommand('/ootd rainy afternoon coffee');
    expect(parsed.command).toBe('ootd');
    expect(parsed.rawArgs).toBe('rainy afternoon coffee');
    expect(parsed.activeSlots).toEqual(['underwear', 'hosiery', 'top', 'bottom', 'others']);
    expect(parsed.excludedCategories).toEqual([]);
    expect(parsed.pairBraAndPanties).toBe(false);
  });

  it('handles "/ootd with no top and no pants" by excluding top & bottom and pairing bra + panties', () => {
    const parsed = parseOotdCommand('/ootd with no top and no pants');
    expect(parsed.command).toBe('ootd');
    expect(parsed.excludedCategories).toContain('top');
    expect(parsed.excludedCategories).toContain('bottom');
    expect(parsed.activeSlots).not.toContain('top');
    expect(parsed.activeSlots).not.toContain('bottom');
    expect(parsed.pairBraAndPanties).toBe(true);
    expect(parsed.activeSlots).toEqual(['bra', 'panties', 'hosiery', 'others']);
  });

  it('handles "/ootd only bra and panties" strictly', () => {
    const parsed = parseOotdCommand('/ootd only bra and panties');
    expect(parsed.command).toBe('ootd');
    expect(parsed.pairBraAndPanties).toBe(true);
    expect(parsed.activeSlots).toEqual(['bra', 'panties']);
    expect(parsed.excludedCategories).toEqual(['top', 'bottom', 'hosiery', 'others']);
  });

  it('handles "/ootd skip hosiery and no skirt"', () => {
    const parsed = parseOotdCommand('/ootd skip hosiery and no skirt');
    expect(parsed.excludedCategories).toEqual(expect.arrayContaining(['hosiery', 'bottom']));
    expect(parsed.activeSlots).toEqual(['underwear', 'top', 'others']);
  });

  it('handles /secret mode for intimate hidden layers', () => {
    const parsed = parseOotdCommand('/secret date night');
    expect(parsed.command).toBe('secret');
    expect(parsed.pairBraAndPanties).toBe(true);
    expect(parsed.activeSlots).toEqual(['bra', 'panties', 'hosiery']);
    expect(parsed.excludedCategories).toEqual(['top', 'bottom', 'others']);
  });

  it('formats Quick-Builder Sheet slot selections cleanly', () => {
    expect(buildQuickSlotsCommandText(['bra', 'panties'], 'random')).toBe(
      '/ootd only bra, panties',
    );
    expect(buildQuickSlotsCommandText(['top', 'bottom'], 'ai', 'date night')).toBe(
      '/style only top, bottom — date night',
    );
  });
});
