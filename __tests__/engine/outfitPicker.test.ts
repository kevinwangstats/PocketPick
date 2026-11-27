import QuickCrypto from 'react-native-quick-crypto';
import { Photo, WardrobeCategory, PhotoKind } from '@/db/schema';
import * as photoService from '@/services/photos/photoService';
import * as llmClient from '@/services/llm/llmClient';
import { pickOutfitFromWardrobe, swapOutfitSlot } from '@/engine/outfitPicker';

describe('Decoupled Outfit Picking Engine (TDD)', () => {
  const sessionKey = QuickCrypto.randomBytes(32);

  function makeCandidate(
    id: string,
    category: WardrobeCategory,
    item: string,
    description = '',
    options: { photoKind?: PhotoKind; lastWornAt?: Date | null } = {},
  ) {
    const photo: Photo = {
      id,
      photoKind: options.photoKind ?? 'wardrobe',
      aiHasHumanBody: options.photoKind === 'past_ootd' ? 1 : 0,
      category,
      encryptedItem: 'enc',
      itemIv: 'iv',
      itemTag: 'tag',
      encryptedDescription: null,
      descriptionIv: null,
      descriptionTag: null,
      encryptedFilePath: `photos/${id}.enc`,
      fileIv: 'fiv',
      fileTag: 'ftag',
      fileHash: `hash-${id}`,
      encryptedThumbnailPath: `photos/${id}_thumb.enc`,
      thumbnailIv: 'tiv',
      thumbnailTag: 'ttag',
      lastWornAt: options.lastWornAt ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return { photo, item, description };
  }

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('picks 1 item per category strictly from wardrobe and ignores past_ootd body shots', async () => {
    const mockRecords = [
      makeCandidate('top-1', 'top', 'white tshirt', 'Soft cotton'),
      makeCandidate('bot-1', 'bottom', 'tailored pants', 'Black wool'),
      makeCandidate('und-1', 'underwear', 'silk panties', 'Ivory'),
      makeCandidate('hos-1', 'hosiery', 'sheer thigh-highs', '20 denier'),
      makeCandidate('oth-1', 'others', 'strappy heels', 'Black leather'),
    ];

    const listSpy = jest
      .spyOn(photoService, 'listPhotosWithMetadata')
      .mockResolvedValue(mockRecords);

    const result = await pickOutfitFromWardrobe({
      commandText: '/ootd',
      sessionKey,
    });

    expect(listSpy).toHaveBeenCalledWith(sessionKey, 'wardrobe');
    expect(result.slots).toHaveLength(5);
    expect(result.slots.map((s) => s.category).sort()).toEqual([
      'bottom',
      'hosiery',
      'others',
      'top',
      'underwear',
    ]);
  });

  it('picks 1 bra + 1 panties and omits top & bottom for "/ootd with no top and no pants"', async () => {
    const mockRecords = [
      makeCandidate('top-1', 'top', 'tshirt'),
      makeCandidate('bot-1', 'bottom', 'jeans'),
      makeCandidate('bra-1', 'underwear', 'lace bra', 'Black scalloped lace'),
      makeCandidate('pan-1', 'underwear', 'silk panties', 'Champagne satin'),
      makeCandidate('hos-1', 'hosiery', 'sheer stockings', 'Back-seam'),
    ];

    jest.spyOn(photoService, 'listPhotosWithMetadata').mockResolvedValue(mockRecords);

    const result = await pickOutfitFromWardrobe({
      commandText: '/ootd with no top and no pants',
      sessionKey,
    });

    const slotNames = result.slots.map((s) => s.slot);
    expect(slotNames).toEqual(['bra', 'panties', 'hosiery']);
    expect(slotNames).not.toContain('top');
    expect(slotNames).not.toContain('bottom');
    expect(result.slots.find((s) => s.slot === 'bra')?.photoId).toBe('bra-1');
    expect(result.slots.find((s) => s.slot === 'panties')?.photoId).toBe('pan-1');
  });

  it('honors anti-repeat cooldown when fresh alternatives exist', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const mockRecords = [
      makeCandidate('top-recent', 'top', 'old tee', '', { lastWornAt: yesterday }),
      makeCandidate('top-fresh', 'top', 'silk blouse', '', { lastWornAt: null }),
    ];

    jest.spyOn(photoService, 'listPhotosWithMetadata').mockResolvedValue(mockRecords);

    const result = await pickOutfitFromWardrobe({
      commandText: '/ootd only top',
      cooldownDays: 3,
      sessionKey,
    });

    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].photoId).toBe('top-fresh');
  });

  it('curates via AI for /style and falls back cleanly to CSPRNG when offline', async () => {
    const mockRecords = [
      makeCandidate('top-1', 'top', 'ivory camisole'),
      makeCandidate('top-2', 'top', 'black tee'),
      makeCandidate('bot-1', 'bottom', 'satin skirt'),
    ];
    jest.spyOn(photoService, 'listPhotosWithMetadata').mockResolvedValue(mockRecords);

    jest.spyOn(llmClient, 'queryLlm').mockResolvedValueOnce({
      content: JSON.stringify({ top: 'top-1', bottom: 'bot-1' }),
      provider: 'openrouter',
      model: 'x-ai/grok-4.7',
      quotaUsed: 1,
    });

    const aiResult = await pickOutfitFromWardrobe({
      commandText: '/style romantic',
      sessionKey,
    });
    expect(aiResult.usedAiCuration).toBe(true);
    expect(aiResult.slots.find((s) => s.slot === 'top')?.photoId).toBe('top-1');

    // Simulate offline error -> seamless CSPRNG fallback
    jest.spyOn(llmClient, 'queryLlm').mockRejectedValueOnce(new Error('Network unavailable'));
    const offlineResult = await pickOutfitFromWardrobe({
      commandText: '/style romantic',
      sessionKey,
    });
    expect(offlineResult.usedAiCuration).toBe(false);
    expect(offlineResult.slots.length).toBeGreaterThan(0);
  });

  it('swaps an individual unlocked slot excluding the current garment', async () => {
    const mockRecords = [
      makeCandidate('top-1', 'top', 'cashmere sweater'),
      makeCandidate('top-2', 'top', 'lace camisole'),
      makeCandidate('bot-1', 'bottom', 'silk skirt'),
    ];
    jest.spyOn(photoService, 'listPhotosWithMetadata').mockResolvedValue(mockRecords);

    const swapped = await swapOutfitSlot({
      existingSlots: [
        {
          slot: 'top',
          category: 'top',
          photoId: 'top-1',
          itemLabel: 'cashmere sweater',
          description: '',
          thumbnailPath: 'photos/top-1_thumb.enc',
          thumbnailIv: 'tiv',
          thumbnailTag: 'ttag',
        },
        {
          slot: 'bottom',
          category: 'bottom',
          photoId: 'bot-1',
          itemLabel: 'silk skirt',
          description: '',
          thumbnailPath: 'photos/bot-1_thumb.enc',
          thumbnailIv: 'tiv',
          thumbnailTag: 'ttag',
        },
      ],
      targetSlot: 'top',
      sessionKey,
    });

    expect(swapped.swappedSelection?.photoId).toBe('top-2');
    expect(swapped.updatedSlots.find((s) => s.slot === 'top')?.photoId).toBe('top-2');
    expect(swapped.updatedSlots.find((s) => s.slot === 'bottom')?.photoId).toBe('bot-1');
  });
});
