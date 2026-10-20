export type ExecuteFn = (
  _sql: string,
  _params?: unknown[],
) => {
  rows: {
    _array: unknown[];
    length: number;
    item: (_index: number) => unknown;
  };
  rowsAffected: number;
};

export type ExecuteAsyncFn = (
  sql: string,
  params?: unknown[],
) => Promise<{
  rows: {
    _array: unknown[];
    length: number;
    item: (_index: number) => unknown;
  };
  rowsAffected: number;
}>;

export class MockDB {
  name: string;
  encryptionKey?: string;
  isOpen = true;

  constructor(name: string, encryptionKey?: string) {
    this.name = name;
    this.encryptionKey = encryptionKey;
  }

  execute: ExecuteFn = jest.fn((_sql: string, _params?: unknown[]) => {
    return {
      rows: {
        _array: [],
        length: 0,
        item: () => null,
      },
      rowsAffected: 0,
    };
  });

  executeAsync: ExecuteAsyncFn = jest.fn(async (sql: string, params?: unknown[]) => {
    return this.execute(sql, params);
  });

  executeRawAsync = jest.fn(async (_sql: string, _params?: unknown[]) => {
    return [];
  });

  close = jest.fn(() => {
    this.isOpen = false;
  });

  transaction = jest.fn(
    async (cb: (tx: { execute: ExecuteFn; executeAsync: ExecuteAsyncFn }) => Promise<void>) => {
      await cb({
        execute: this.execute,
        executeAsync: this.executeAsync,
      });
    },
  );
}

export const open = jest.fn(({ name, encryptionKey }: { name: string; encryptionKey?: string }) => {
  return new MockDB(name, encryptionKey);
});
