import { Buffer } from '@craftzdog/react-native-buffer';
import { Photo } from '../../db/schema';
import { analyzeAndClassifyPhoto, savePhotoMetadata } from './photoService';
import { PhotoAiClassification } from './types';

export interface BatchAnalysisProgress {
  completed: number;
  total: number;
  movedToPastOotdIds: string[];
  failedCount: number;
}

export interface BatchAnalysisOptions {
  photos: Photo[];
  sessionKey: Buffer;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (progress: BatchAnalysisProgress) => void;
  onItemClassified?: (photoId: string, result: PhotoAiClassification) => void;
}

/**
 * Non-blocking, cancellable concurrent batch analyzer for unsorted wardrobe photos.
 * Automatically classifies human-body photos into 'past_ootd' and tracks moved IDs for Undo.
 */
export async function runBatchPhotoAnalysis(
  options: BatchAnalysisOptions,
): Promise<BatchAnalysisProgress> {
  const { photos, sessionKey, concurrency = 2, signal, onProgress, onItemClassified } = options;

  const progress: BatchAnalysisProgress = {
    completed: 0,
    total: photos.length,
    movedToPastOotdIds: [],
    failedCount: 0,
  };

  if (photos.length === 0) {
    return progress;
  }

  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < photos.length) {
      if (signal?.aborted) {
        return;
      }
      const index = cursor++;
      const photo = photos[index];

      try {
        const result = await analyzeAndClassifyPhoto(photo, sessionKey);
        await savePhotoMetadata(
          photo.id,
          {
            photoKind: result.photoKind,
            aiHasHumanBody: result.hasHumanBodyMainSubject,
            category: result.category,
            item: result.item,
            description: result.description,
          },
          sessionKey,
        );

        if (result.photoKind === 'past_ootd' && photo.photoKind !== 'past_ootd') {
          progress.movedToPastOotdIds.push(photo.id);
        }
        onItemClassified?.(photo.id, result);
      } catch {
        progress.failedCount += 1;
      } finally {
        progress.completed += 1;
        onProgress?.({
          ...progress,
          movedToPastOotdIds: [...progress.movedToPastOotdIds],
        });
      }
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), photos.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return progress;
}
