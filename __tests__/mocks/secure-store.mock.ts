const storage = new Map<string, string>();

export const mockSecureStore = {
  getItemAsync: jest.fn(async (key: string): Promise<string | null> => {
    return storage.get(key) ?? null;
  }),
  setItemAsync: jest.fn(async (key: string, value: string): Promise<void> => {
    storage.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string): Promise<void> => {
    storage.delete(key);
  }),
  _reset: () => {
    storage.clear();
    mockSecureStore.getItemAsync.mockClear();
    mockSecureStore.setItemAsync.mockClear();
    mockSecureStore.deleteItemAsync.mockClear();
  },
};
