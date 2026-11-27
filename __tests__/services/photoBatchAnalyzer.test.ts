import QuickCrypto from 'react-native-quick-crypto';
import { Photo } from '@/db/schema';
import * as photoService from '@/services/photos/photoService';
import { runBatchPhotoAnalysis } from '@/services/photos/photoBatchAnalyzer';

describe('Batch Photo Auto-Tagging & Human-Body Routing Queue (TDD)', () => {
  const sessionKey = QuickCrypto.randomBytes(32);

  function makeMockPhoto(id: string): Photo {
    return {
      id,
      photoKind: 'wardrobe',
      aiHasHumanBody: null,
      category: 'others',
      encryptedItem: null,
      itemIv: null,
      itemTag: null,
      encryptedDescription: null,
      descriptionIv: null,
      descriptionTag: null,
      encryptedFilePath: `photos/${id}.enc`,
      fileIv: 'iv',
      fileTag: 'tag',
      fileHash: `hash-${id}`,
      encryptedThumbnailPath: `photos/${id}_thumb.enc`,
      thumbnailIv: 'tiv',
      thumbnailTag: 'ttag',
      lastWornAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('classifies unsorted photos concurrently and tracks items moved to past_ootd', async () => {
    const p1 = makeMockPhoto('p1');
    const p2 = makeMockPhoto('p2');

    jest.spyOn(photoService, 'analyzeAndClassifyPhoto').mockImplementation(async (photo) => {
      if (photo.id === 'p2') {
        return {
          hasHumanBodyMainSubject: true,
          photoKind: 'past_ootd',
          category: 'top',
          item: 'mirror outfit',
          description: 'Full-body mirror try-on',
        };
      }
      return {
        hasHumanBodyMainSubject: false,
        photoKind: 'wardrobe',
        category: 'underwear',
        item: 'panties',
        description: 'Ivory silk bikini panties',
      };
    });

    const saveSpy = jest.spyOn(photoService, 'savePhotoMetadata').mockResolvedValue();

    const progressEvents: number[] = [];
    const result = await runBatchPhotoAnalysis({
      photos: [p1, p2],
      sessionKey,
      concurrency: 2,
      onProgress: (p) => progressEvents.push(p.completed),
    });

    expect(result.completed).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.movedToPastOotdIds).toEqual(['p2']);
    expect(saveSpy).toHaveBeenCalledTimes(2);
    expect(progressEvents).toEqual([1, 2]);
  });

  it('supports cancellation via AbortSignal and records failed items cleanly', async () => {
    const p1 = makeMockPhoto('p1');
    const p2 = makeMockPhoto('p2');
    const controller = new AbortController();

    jest
      .spyOn(photoService, 'analyzeAndClassifyPhoto')
      .mockRejectedValueOnce(new Error('Network timeout'));

    const result = await runBatchPhotoAnalysis({
      photos: [p1, p2],
      sessionKey,
      concurrency: 1,
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });

    expect(result.completed).toBe(1);
    expect(result.failedCount).toBe(1);
  });
});
