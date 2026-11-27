import { parseStructuredResponse } from '../../src/services/llm/structuredTrailerParser';

describe('Single-Pass Structured Trailer Parser (TDD)', () => {
  it('returns clean text unchanged when no trailer tags are present', () => {
    const result = parseStructuredResponse(
      'That burgundy silk slip will look breathtaking on you tonight.',
    );

    expect(result.cleanText).toBe('That burgundy silk slip will look breathtaking on you tonight.');
    expect(result.memoryAdditions).toEqual([]);
    expect(result.photoMeta).toBeNull();
  });

  it('extracts JSON <memory_add> items and strips the tag from visible output', () => {
    const raw = `I adore how bold you feel in deep emerald satin.

<memory_add>
[
  {"section": "Favorite Colors & Palettes", "item": "Deep emerald green"},
  {"section": "Fabrics & Textures That Make Me Tingle", "item": "Liquid satin against bare skin"}
]
</memory_add>`;

    const result = parseStructuredResponse(raw);
    expect(result.cleanText).toBe('I adore how bold you feel in deep emerald satin.');
    expect(result.memoryAdditions).toEqual([
      { section: 'Favorite Colors & Palettes', item: 'Deep emerald green' },
      {
        section: 'Fabrics & Textures That Make Me Tingle',
        item: 'Liquid satin against bare skin',
      },
    ]);
  });

  it('extracts <photo_meta> classification alongside <memory_add> in a single pass', () => {
    const raw = `Ooh, sheer black lace—let's tuck that straight into your wardrobe!

<photo_meta>{"hasHumanBodyMainSubject": false, "category": "underwear", "item": "lace bralette", "description": "Sheer black floral lace scalloped bralette"}</photo_meta>
<memory_add>{"section": "Preferred Styles & Silhouettes", "item": "Scalloped black lace bralettes"}</memory_add>`;

    const result = parseStructuredResponse(raw);
    expect(result.cleanText).toBe(
      "Ooh, sheer black lace—let's tuck that straight into your wardrobe!",
    );
    expect(result.photoMeta).toEqual({
      hasHumanBodyMainSubject: false,
      category: 'underwear',
      item: 'lace bralette',
      description: 'Sheer black floral lace scalloped bralette',
    });
    expect(result.memoryAdditions).toEqual([
      { section: 'Preferred Styles & Silhouettes', item: 'Scalloped black lace bralettes' },
    ]);
  });

  it('handles malformed JSON or unclosed trailing tags without leaking raw XML', () => {
    const raw = `Gorgeous pick!
<memory_add>
- Favorite Colors & Palettes: Champagne gold
- Soft sheer nylon stockings
</memory_add>
<photo_meta>{"hasHumanBodyMainSubject": true`;

    const result = parseStructuredResponse(raw);
    expect(result.cleanText).toBe('Gorgeous pick!');
    expect(result.memoryAdditions).toEqual([
      { section: 'Favorite Colors & Palettes', item: 'Champagne gold' },
      { section: 'Custom Notes & Observations', item: 'Soft sheer nylon stockings' },
    ]);
    expect(result.photoMeta).toBeNull();
  });
});
