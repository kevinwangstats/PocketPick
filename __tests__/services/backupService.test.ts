import * as FileSystem from 'expo-file-system';
import QuickCrypto from 'react-native-quick-crypto';
import { getDatabase } from '@/db/client';
import {
  chatMessages,
  ootdLooks,
  persons,
  photos,
  Person,
  Photo,
  ChatMessage,
  OotdLook,
} from '@/db/schema';
import {
  buildEncryptedBackupArchive,
  exportEncryptedBackup,
  importEncryptedBackup,
} from '@/services/backup/backupService';
import * as photoService from '@/services/photos/photoService';
import * as personService from '@/services/persons/personService';
import * as lookbookStore from '@/engine/lookbookStore';
import { mockFileSystem } from '../mocks/file-system.mock';

describe('Chunked Encrypted .ootdbackup Export & Import (TDD)', () => {
  const sourceKey = QuickCrypto.randomBytes(32);
  const targetKey = QuickCrypto.randomBytes(32);

  let dbPersons: Person[] = [];
  let dbPhotos: Photo[] = [];
  let dbLooks: OotdLook[] = [];
  let dbChats: ChatMessage[] = [];

  beforeEach(async () => {
    dbPersons = [];
    dbPhotos = [];
    dbLooks = [];
    dbChats = [];
    mockFileSystem._reset();
    jest.restoreAllMocks();

    const db = await getDatabase();
    jest.spyOn(db, 'insert').mockImplementation((table: unknown) => {
      return {
        values: async (val: Record<string, unknown>) => {
          if (table === persons) dbPersons.push({ ...(val as unknown as Person) });
          else if (table === photos) dbPhotos.push({ ...(val as unknown as Photo) });
          else if (table === ootdLooks) dbLooks.push({ ...(val as unknown as OotdLook) });
          else if (table === chatMessages) dbChats.push({ ...(val as unknown as ChatMessage) });
        },
      } as unknown as ReturnType<typeof db.insert>;
    });

    jest.spyOn(db, 'update').mockImplementation(() => {
      return {
        set: () => ({
          where: async () => {},
        }),
      } as unknown as ReturnType<typeof db.update>;
    });

    jest.spyOn(db, 'select').mockImplementation(() => {
      return {
        from: (table: unknown) => {
          const getList = () => {
            if (table === persons) return dbPersons;
            if (table === photos) return dbPhotos;
            if (table === ootdLooks) return dbLooks;
            if (table === chatMessages) return dbChats;
            return [];
          };
          const list = getList();
          const res = Promise.resolve(list) as unknown as Promise<unknown[]> & {
            orderBy: () => Promise<unknown[]>;
            where: () => {
              limit: () => Promise<unknown[]>;
              orderBy: () => Promise<unknown[]>;
            };
          };
          res.orderBy = () => Promise.resolve(list);
          res.where = () => ({
            limit: () => Promise.resolve([]),
            orderBy: () => Promise.resolve(list),
          });
          return res;
        },
      } as unknown as ReturnType<typeof db.select>;
    });
  });

  it('exports chunked encrypted archive, shreds temp file in finally, and imports cleanly under new iPhone key', async () => {
    await FileSystem.writeAsStringAsync(
      '/mock/cache/bra.jpg',
      Buffer.from('Bra photo bytes').toString('base64'),
      { encoding: FileSystem.EncodingType.Base64 },
    );

    const ingested = await photoService.ingestPhoto('/mock/cache/bra.jpg', sourceKey, {
      photoKind: 'wardrobe',
      category: 'underwear',
      item: 'lace bra',
      description: 'Black Chantilly lace',
    });

    const person = await personService.createPerson({
      name: 'Celeste',
      bio: 'Atelier',
      personalityPrompt: 'Warm Parisian stylist.',
      memoryText: '## Fabrics & Textures That Make Me Tingle\n- Black Chantilly lace\n',
      sessionKey: sourceKey,
    });

    await lookbookStore.saveOotdLook({
      personId: person.id,
      triggerType: 'ootd',
      slots: [
        {
          slot: 'bra',
          category: 'underwear',
          photoId: ingested.photoId,
          itemLabel: 'lace bra',
          description: 'Black Chantilly lace',
          thumbnailPath: dbPhotos[0].encryptedThumbnailPath,
          thumbnailIv: dbPhotos[0].thumbnailIv,
          thumbnailTag: dbPhotos[0].thumbnailTag,
        },
      ],
      sessionKey: sourceKey,
      isFavorite: true,
    });

    let capturedArchiveContent = '';
    const exportResult = await exportEncryptedBackup({
      sessionKey: sourceKey,
      backupPassphrase: 'transfer-secret-2026',
      includeChats: true,
      shareArchive: async (archiveUri) => {
        capturedArchiveContent = await FileSystem.readAsStringAsync(archiveUri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      },
    });

    expect(exportResult.personsCount).toBe(1);
    expect(exportResult.photosCount).toBe(1);
    expect(exportResult.looksCount).toBe(1);
    // Temp archive shredded after share
    expect(mockFileSystem._storage.has(exportResult.archiveUri)).toBe(false);
    // Plaintext photo description / memory must NOT appear in archive
    expect(capturedArchiveContent).not.toContain('Chantilly');

    // Simulate fresh destination iPhone DB
    dbPersons = [];
    dbPhotos = [];
    dbLooks = [];
    dbChats = [];

    const destArchivePath = '/mock/cache/incoming.ootdbackup';
    await FileSystem.writeAsStringAsync(destArchivePath, capturedArchiveContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const importResult = await importEncryptedBackup({
      archiveUri: destArchivePath,
      backupPassphrase: 'transfer-secret-2026',
      sessionKey: targetKey,
    });

    expect(importResult.personsImported).toBe(1);
    expect(importResult.photosImported).toBe(1);
    expect(importResult.looksImported).toBe(1);
    expect(dbPersons[0].name).toBe('Celeste');
    expect(dbPersons[0].memoryText).toContain('Black Chantilly lace');
    expect(mockFileSystem._storage.has(destArchivePath)).toBe(false);
  });

  it('rejects wrong passphrase and 1-byte tampered frame without mutating DB', async () => {
    const built = await buildEncryptedBackupArchive({
      sessionKey: sourceKey,
      backupPassphrase: 'correct-backup-pass',
    });

    const raw = await FileSystem.readAsStringAsync(built.archiveUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await expect(
      importEncryptedBackup({
        archiveUri: built.archiveUri,
        backupPassphrase: 'wrong-password',
        sessionKey: targetKey,
      }),
    ).rejects.toThrow();
    // Shredded in finally even after wrong passphrase failure
    expect(mockFileSystem._storage.has(built.archiveUri)).toBe(false);

    // Tamper 1 byte in manifest frame ciphertext
    const lines = raw.split('\n');
    const frame = JSON.parse(lines[1]) as {
      ciphertext: string;
      iv: string;
      tag: string;
      type: string;
    };
    const cipherBuf = Buffer.from(frame.ciphertext, 'base64');
    cipherBuf[0] = cipherBuf[0] ^ 0xff;
    frame.ciphertext = cipherBuf.toString('base64');
    lines[1] = JSON.stringify(frame);

    const tamperedPath = '/mock/cache/tampered.ootdbackup';
    await FileSystem.writeAsStringAsync(tamperedPath, lines.join('\n'), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await expect(
      importEncryptedBackup({
        archiveUri: tamperedPath,
        backupPassphrase: 'correct-backup-pass',
        sessionKey: targetKey,
      }),
    ).rejects.toThrow();
    expect(mockFileSystem._storage.has(tamperedPath)).toBe(false);
  });
});
