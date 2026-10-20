import { getDatabase, closeDatabase } from '@/db/client';
import { vaults as vaultsTable } from '@/db/schema';
import { createTicket, getDecryptedTickets } from '@/services/tickets/ticketService';
import { ingestImage } from '@/services/media/imagePipeline';
import { deleteResource } from '@/services/resources/resourceManager';
import { deriveVaultKey, generateSalt } from '@/crypto/kdf';
import { encryptString } from '@/crypto/cipher';
import * as FileSystem from 'expo-file-system/legacy';
import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from '@craftzdog/react-native-buffer';

// Track in-memory rows for Drizzle OPSQLite mock simulation
interface InMemoryStorage {
  vaults: any[];
  resources: any[];
  historyLogs: any[];
  apiQuotas: any[];
}

const storage: InMemoryStorage = {
  vaults: [],
  resources: [],
  historyLogs: [],
  apiQuotas: [],
};

// Mock op-sqlite to simulate native return shape with { rawRows: any[][] }
// This verifies that getDatabase() properly unwraps rawRows for Drizzle ORM
jest.mock('@op-engineering/op-sqlite', () => {
  return {
    open: jest.fn(({ name, encryptionKey }: { name: string; encryptionKey?: string }) => {
      return {
        name,
        encryptionKey,
        isOpen: true,
        executeSync: jest.fn((_sql: string, _params?: any[]) => {
          return { rowsAffected: 1, insertId: 1 };
        }),
        execute: jest.fn(async (_sql: string, _params?: any[]) => {
          return { rowsAffected: 1, insertId: 1 };
        }),
        executeAsync: jest.fn(async (_sql: string, _params?: any[]) => {
          return { rowsAffected: 1, insertId: 1 };
        }),
        // Native op-sqlite returns an object with rawRows: any[][]
        executeRaw: jest.fn(async (sql: string, _params?: any[]) => {
          let rows: any[][] = [];
          if (sql.includes('vaults')) {
            rows = storage.vaults.map((v) => [
              v.id,
              v.name,
              v.description,
              v.salt,
              v.verifierCipher,
              v.verifierIv,
              v.verifierTag,
              v.createdAt instanceof Date ? v.createdAt.getTime() : v.createdAt,
              v.updatedAt instanceof Date ? v.updatedAt.getTime() : v.updatedAt,
            ]);
          } else if (sql.includes('resources')) {
            rows = storage.resources.map((r) => [
              r.id,
              r.vaultId,
              r.type,
              r.weight,
              r.encryptedPayload,
              r.payloadIv,
              r.payloadTag,
              r.encryptedFilePath,
              r.fileIv,
              r.fileTag,
              r.encryptedThumbnailPath,
              r.thumbnailIv,
              r.thumbnailTag,
              r.createdAt instanceof Date ? r.createdAt.getTime() : r.createdAt,
              r.updatedAt instanceof Date ? r.updatedAt.getTime() : r.updatedAt,
            ]);
          }
          return {
            rawRows: rows,
            columnNames: [],
            rowsAffected: rows.length,
            insertId: 0,
          };
        }),
        executeRawAsync: jest.fn(async (sql: string, _params?: any[]) => {
          // Native behavior: calls executeRaw which returns { rawRows: [...] }
          let rows: any[][] = [];
          if (sql.includes('vaults')) {
            rows = storage.vaults.map((v) => [
              v.id,
              v.name,
              v.description,
              v.salt,
              v.verifierCipher,
              v.verifierIv,
              v.verifierTag,
              v.createdAt instanceof Date ? v.createdAt.getTime() : v.createdAt,
              v.updatedAt instanceof Date ? v.updatedAt.getTime() : v.updatedAt,
            ]);
          } else if (sql.includes('resources')) {
            rows = storage.resources.map((r) => [
              r.id,
              r.vaultId,
              r.type,
              r.weight,
              r.encryptedPayload,
              r.payloadIv,
              r.payloadTag,
              r.encryptedFilePath,
              r.fileIv,
              r.fileTag,
              r.encryptedThumbnailPath,
              r.thumbnailIv,
              r.thumbnailTag,
              r.createdAt instanceof Date ? r.createdAt.getTime() : r.createdAt,
              r.updatedAt instanceof Date ? r.updatedAt.getTime() : r.updatedAt,
            ]);
          }
          return {
            rawRows: rows,
            columnNames: [],
            rowsAffected: rows.length,
            insertId: 0,
          };
        }),
        close: jest.fn(),
      };
    }),
  };
});

describe('End-to-End Vault Persistence & Resource Management', () => {
  const testPassphrase = 'SuperSecretPassword123!';
  let testVaultId: string;
  let testVaultKey: Buffer;

  beforeEach(() => {
    storage.vaults = [];
    storage.resources = [];
    closeDatabase();
    jest.clearAllMocks();
  });

  afterEach(() => {
    closeDatabase();
  });

  it('provisions database, executes synchronous DDL, and creates a vault', async () => {
    const db = await getDatabase();
    expect(db).toBeDefined();

    // 1. Create a vault
    testVaultId = QuickCrypto.randomBytes(16).toString('hex');
    const salt = generateSalt();
    testVaultKey = deriveVaultKey(testPassphrase, salt);
    const verifier = encryptString('POCKETPICK_VERIFIER_CONSTANT', testVaultKey, testVaultId);

    const newVaultRecord = {
      id: testVaultId,
      name: 'Finances & IDs',
      description: 'Encrypted banking docs and tax files',
      salt: salt.toString('base64'),
      verifierCipher: verifier.ciphertext,
      verifierIv: verifier.iv,
      verifierTag: verifier.tag,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in our mock persistent layer
    storage.vaults.push(newVaultRecord);

    // 2. Query vault back using Drizzle select()
    // This executes client.executeRawAsync which MUST unwrap rawRows
    const queriedVaults = await db.select().from(vaultsTable);
    expect(queriedVaults).toHaveLength(1);
    expect(queriedVaults[0].id).toBe(testVaultId);
    expect(queriedVaults[0].name).toBe('Finances & IDs');
  });

  it('persists vault across simulated app restart (close connection & reopen)', async () => {
    // Stage existing vault
    const salt = generateSalt();
    const key = deriveVaultKey(testPassphrase, salt);
    const vaultId = 'persisted-vault-abc';
    const verifier = encryptString('POCKETPICK_VERIFIER_CONSTANT', key, vaultId);

    storage.vaults.push({
      id: vaultId,
      name: 'Permanent Vault',
      description: 'Must survive restarts',
      salt: salt.toString('base64'),
      verifierCipher: verifier.ciphertext,
      verifierIv: verifier.iv,
      verifierTag: verifier.tag,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // SIMULATE APP RESTART:
    // 1. Close database
    closeDatabase();

    // 2. Reopen database (as happens in RootLayout on launch)
    const freshDb = await getDatabase();
    expect(freshDb).toBeDefined();

    // 3. Load vaults (as happens in VaultsScreen loadVaults())
    const loadedVaults = await freshDb.select().from(vaultsTable);
    expect(loadedVaults).toHaveLength(1);
    expect(loadedVaults[0].id).toBe(vaultId);
    expect(loadedVaults[0].name).toBe('Permanent Vault');
  });

  it('adds, retrieves, and decrypts ticket resources inside the vault', async () => {
    const salt = generateSalt();
    const vaultKey = deriveVaultKey(testPassphrase, salt);
    const vaultId = 'resource-vault-xyz';

    const db = await getDatabase();

    // Mock insert to store into our storage.resources array
    jest.spyOn(db, 'insert').mockImplementation((_table: any) => {
      return {
        values: (valuesObj: any) => {
          storage.resources.push(valuesObj);
          return Promise.resolve();
        },
      } as any;
    });

    // Create a confidential ticket
    const ticketId = await createTicket(
      vaultId,
      {
        title: 'Server Root Key',
        content: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG5...',
        weight: 10,
      },
      vaultKey,
    );

    expect(ticketId).toBeDefined();
    expect(storage.resources).toHaveLength(1);
    expect(storage.resources[0].type).toBe('ticket');
    expect(storage.resources[0].encryptedPayload).toBeDefined();

    // Retrieve and decrypt tickets
    const tickets = await getDecryptedTickets(vaultId, vaultKey);
    expect(tickets).toHaveLength(1);
    expect(tickets[0].id).toBe(ticketId);
    expect(tickets[0].title).toBe('Server Root Key');
    expect(tickets[0].content).toContain('ssh-ed25519');
    expect(tickets[0].weight).toBe(10);
  });

  it('adds, verifies, and deletes encrypted photo resources', async () => {
    const salt = generateSalt();
    const vaultKey = deriveVaultKey(testPassphrase, salt);
    const vaultId = 'photo-vault-123';

    const db = await getDatabase();

    jest.spyOn(db, 'insert').mockImplementation((_table: any) => {
      return {
        values: (valuesObj: any) => {
          storage.resources.push(valuesObj);
          return Promise.resolve();
        },
      } as any;
    });

    jest.spyOn(db, 'delete').mockImplementation((_table: any) => {
      return {
        where: (_clause: any) => {
          storage.resources = [];
          return Promise.resolve();
        },
      } as any;
    });

    const sourceUri = 'file:///var/mobile/Containers/Data/Application/test.jpg';
    await FileSystem.writeAsStringAsync(
      sourceUri,
      Buffer.from('Test raw image bytes').toString('base64'),
      { encoding: FileSystem.EncodingType.Base64 },
    );

    // Ingest image
    const result = await ingestImage(sourceUri, vaultId, vaultKey);

    expect(result.resourceId).toBeDefined();
    expect(storage.resources).toHaveLength(1);
    expect(storage.resources[0].type).toBe('photo');
    expect(storage.resources[0].encryptedFilePath).toContain('.enc');

    // Delete photo resource
    await deleteResource(result.resourceId);
    expect(storage.resources).toHaveLength(0);
  });
});
