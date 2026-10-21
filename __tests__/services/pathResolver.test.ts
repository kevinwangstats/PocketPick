import * as FileSystem from 'expo-file-system/legacy';
import { resolveResourcePath, toRelativeResourcePath } from '../../src/services/media/pathResolver';

describe('pathResolver', () => {
  const currentDocDir =
    'file:///var/mobile/Containers/Data/Application/CURRENT-UUID-9999/Documents/';

  beforeEach(() => {
    (FileSystem as any).documentDirectory = currentDocDir;
  });

  describe('resolveResourcePath', () => {
    it('returns null for null or undefined input', () => {
      expect(resolveResourcePath(null)).toBeNull();
      expect(resolveResourcePath(undefined)).toBeNull();
      expect(resolveResourcePath('')).toBeNull();
    });

    it('resolves relative path starting with vaults/', () => {
      const relPath = 'vaults/vault-1/resources/res-1.enc';
      const resolved = resolveResourcePath(relPath);
      expect(resolved).toBe(`${currentDocDir}vaults/vault-1/resources/res-1.enc`);
    });

    it('resolves old sandbox absolute path with old UUID to current documentDirectory', () => {
      const oldPath =
        '/var/mobile/Containers/Data/Application/OLD-UUID-1111/Documents/vaults/vault-1/resources/res-1.enc';
      const resolved = resolveResourcePath(oldPath);
      expect(resolved).toBe(`${currentDocDir}vaults/vault-1/resources/res-1.enc`);
    });

    it('resolves old sandbox path with file:// scheme and old UUID', () => {
      const oldPath =
        'file:///var/mobile/Containers/Data/Application/OLD-UUID-2222/Documents/vaults/vault-42/resources/res-99_thumb.enc';
      const resolved = resolveResourcePath(oldPath);
      expect(resolved).toBe(`${currentDocDir}vaults/vault-42/resources/res-99_thumb.enc`);
    });

    it('resolves path where vaults/ is anywhere in the string', () => {
      const oldPath = '/some/unknown/sandbox/dir/vaults/vault-9/resources/pic.enc';
      const resolved = resolveResourcePath(oldPath);
      expect(resolved).toBe(`${currentDocDir}vaults/vault-9/resources/pic.enc`);
    });
  });

  describe('toRelativeResourcePath', () => {
    it('converts absolute document path to relative vaults/ path', () => {
      const absPath = `${currentDocDir}vaults/vault-1/resources/res-1.enc`;
      expect(toRelativeResourcePath(absPath)).toBe('vaults/vault-1/resources/res-1.enc');
    });

    it('leaves relative vaults/ path unchanged', () => {
      const relPath = 'vaults/vault-1/resources/res-1.enc';
      expect(toRelativeResourcePath(relPath)).toBe('vaults/vault-1/resources/res-1.enc');
    });

    it('extracts vaults/ relative path even without /Documents/ marker', () => {
      const strangePath = '/private/var/containers/Bundle/Application/X/vaults/v1/resources/r1.enc';
      expect(toRelativeResourcePath(strangePath)).toBe('vaults/v1/resources/r1.enc');
    });
  });
});
