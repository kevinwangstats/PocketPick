import * as FileSystem from 'expo-file-system/legacy';

const SANDBOX_ROOT_MARKERS = ['photos/', 'avatars/', 'vaults/'] as const;

/**
 * Resolves any stored resource path (relative or absolute from a previous iOS sandbox UUID)
 * to the current active application Documents directory.
 */
export function resolveResourcePath(storedPath: string | null | undefined): string | null {
  if (!storedPath) return null;
  const docDir = FileSystem.documentDirectory ?? '';

  for (const marker of SANDBOX_ROOT_MARKERS) {
    if (storedPath.startsWith(marker)) {
      return `${docDir}${storedPath}`;
    }
  }

  const docMarker = '/Documents/';
  const docIdx = storedPath.indexOf(docMarker);
  if (docIdx !== -1) {
    const relative = storedPath.slice(docIdx + docMarker.length);
    return `${docDir}${relative}`;
  }

  for (const marker of SANDBOX_ROOT_MARKERS) {
    const idx = storedPath.indexOf(marker);
    if (idx !== -1) {
      return `${docDir}${storedPath.slice(idx)}`;
    }
  }

  return storedPath;
}

/**
 * Converts any path into a canonical sandbox-relative path (e.g. 'photos/<id>.enc')
 * suitable for database storage that survives iOS sandbox UUID migrations.
 */
export function toRelativeResourcePath(path: string): string {
  const docMarker = '/Documents/';
  const docIdx = path.indexOf(docMarker);
  if (docIdx !== -1) {
    return path.slice(docIdx + docMarker.length);
  }
  for (const marker of SANDBOX_ROOT_MARKERS) {
    const idx = path.indexOf(marker);
    if (idx !== -1) {
      return path.slice(idx);
    }
  }
  return path;
}
