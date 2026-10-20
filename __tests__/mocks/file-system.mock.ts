const fileStorage = new Map<string, string>();

export const mockFileSystem = {
  documentDirectory: '/mock/documents/',
  cacheDirectory: '/mock/cache/',
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64',
  },
  writeAsStringAsync: jest.fn(
    async (path: string, contents: string, _options?: { encoding?: string }): Promise<void> => {
      fileStorage.set(path, contents);
    },
  ),
  readAsStringAsync: jest.fn(
    async (path: string, _options?: { encoding?: string }): Promise<string> => {
      const data = fileStorage.get(path);
      if (data === undefined) {
        throw new Error(`File not found: ${path}`);
      }
      return data;
    },
  ),
  deleteAsync: jest.fn(async (path: string, _options?: { idempotent?: boolean }): Promise<void> => {
    fileStorage.delete(path);
  }),
  makeDirectoryAsync: jest.fn(
    async (_path: string, _options?: { intermediates?: boolean }): Promise<void> => {
      // no-op
    },
  ),
  getInfoAsync: jest.fn(async (path: string): Promise<{ exists: boolean; size?: number }> => {
    const exists = fileStorage.has(path);
    return { exists, size: exists ? (fileStorage.get(path)?.length ?? 0) : 0 };
  }),
  _reset: () => {
    fileStorage.clear();
    mockFileSystem.writeAsStringAsync.mockClear();
    mockFileSystem.readAsStringAsync.mockClear();
    mockFileSystem.deleteAsync.mockClear();
    mockFileSystem.makeDirectoryAsync.mockClear();
    mockFileSystem.getInfoAsync.mockClear();
  },
  _storage: fileStorage,
};
