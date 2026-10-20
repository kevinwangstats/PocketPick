import { LRUCache } from 'lru-cache';

/**
 * Bounded in-memory LRU cache storing decrypted thumbnail data URIs.
 * Prevents re-decrypting thumbnails on every flashlist scroll frame while
 * strictly capping memory consumption (max 50 items).
 */
export const thumbnailCache = new LRUCache<string, string>({
  max: 50,
});

export function getCachedThumbnail(resourceId: string): string | undefined {
  return thumbnailCache.get(resourceId);
}

export function setCachedThumbnail(resourceId: string, dataUri: string): void {
  thumbnailCache.set(resourceId, dataUri);
}

export function clearThumbnailCache(): void {
  thumbnailCache.clear();
}
