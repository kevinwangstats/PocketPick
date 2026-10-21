import * as FileSystem from 'expo-file-system/legacy';

/**
 * Resolves any stored resource path (relative or absolute from a previous iOS sandbox UUID)
 * to the current active application Documents directory.
 *
 * iOS sandbox UUIDs (/var/mobile/Containers/Data/Application/<UUID>/) change on every
 * App Store update, TestFlight build, or device restore. Storing absolute paths causes
 * files to become inaccessible after an update.
 *
 * This resolver safely extracts the relative 'vaults/...' path and anchors it to the
 * active FileSystem.documentDirectory.
 */
export function resolveResourcePath(storedPath: string | null | undefined): string | null {
  if (!storedPath) return null;
  const docDir = FileSystem.documentDirectory ?? '';

  // 1. If already a relative path starting with 'vaults/'
  if (storedPath.startsWith('vaults/')) {
    return `${docDir}${storedPath}`;
  }

  // 2. If stored as an absolute path containing '/Documents/vaults/'
  const docMarker = '/Documents/';
  const docIdx = storedPath.indexOf(docMarker);
  if (docIdx !== -1) {
    const relative = storedPath.slice(docIdx + docMarker.length);
    return `${docDir}${relative}`;
  }

  // 3. Fallback: search for 'vaults/' anywhere in the path
  const vaultsIdx = storedPath.indexOf('vaults/');
  if (vaultsIdx !== -1) {
    const relative = storedPath.slice(vaultsIdx);
    return `${docDir}${relative}`;
  }

  // 4. Return as-is if no vaults marker found
  return storedPath;
}

/**
 * Converts any path into a canonical sandbox-relative path (e.g. 'vaults/<vaultId>/resources/<file>.enc')
 * suitable for database storage that survives iOS sandbox UUID migrations.
 */
export function toRelativeResourcePath(path: string): string {
  const docMarker = '/Documents/';
  const docIdx = path.indexOf(docMarker);
  if (docIdx !== -1) {
    return path.slice(docIdx + docMarker.length);
  }
  const vaultsIdx = path.indexOf('vaults/');
  if (vaultsIdx !== -1) {
    return path.slice(vaultsIdx);
  }
  return path;
}
