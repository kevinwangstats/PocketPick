import * as FileSystem from 'expo-file-system';
import { Buffer } from '@craftzdog/react-native-buffer';
import QuickCrypto from 'react-native-quick-crypto';
import { getDatabase } from '@/db/client';
import { Photo } from '@/db/schema';
import {
  ingestPhoto,
  getDecryptedPhotoMetadataStrict,
  getDecryptedPhotoMetadata,
  savePhotoMetadata,
  normalizeWardrobeCategory,
  parseClassificationPayload,
  analyzeAndClassifyPhoto,
  deletePhoto,
} from '@/services/photos/photoService';
import * as llmClient from '@/services/llm/llmClient';
import { mockFileSystem } from '../mocks/file-system.mock';

describe('Private Photo Service, AI Body Classifier & Tamper Protection (TDD)', () => {
  const sessionKey = QuickCrypto.randomBytes(32);
  let storedPhotos: Photo[] = [];

  beforeEach(async () => {
    storedPhotos = [];
    mockFileSystem._reset();
    jest.clearAllMocks();

    const db = await getDatabase();
    jest.spyOn(db, 'insert').mockImplementation((_table: unknown) => {
      return {
        values: async (val: Photo) => {
          storedPhotos.push({ ...val });
        },
      } as unknown as ReturnType<typeof db.insert>;
    });

    jest.spyOn(db, 'select').mockImplementation((_fields?: unknown) => {
      return {
        from: () => {
          const allPromise = Promise.resolve(storedPhotos) as Promise<Photo[]> & {
            where: () => Promise<Photo[]> & {
              limit: () => Promise<Photo[]>;
              orderBy: () => Promise<Photo[]>;
            };
            orderBy: () => Promise<Photo[]>;
          };
          allPromise.where = () => {
            const matches = storedPhotos;
            const res = Promise.resolve(matches) as Promise<Photo[]> & {
              limit: () => Promise<Photo[]>;
              orderBy: () => Promise<Photo[]>;
            };
            res.limit = () => Promise.resolve(matches);
            res.orderBy = () => Promise.resolve(matches);
            return res;
          };
          allPromise.orderBy = () => Promise.resolve(storedPhotos);
          return allPromise;
        },
      } as unknown as ReturnType<typeof db.select>;
    });

    jest.spyOn(db, 'update').mockImplementation(() => {
      return {
        set: (patch: Partial<Photo>) => ({
          where: async () => {
            if (storedPhotos[0]) {
              Object.assign(storedPhotos[0], patch);
            }
          },
        }),
      } as unknown as ReturnType<typeof db.update>;
    });

    jest.spyOn(db, 'delete').mockImplementation(() => {
      return {
        where: async () => {
          storedPhotos = [];
        },
      } as unknown as ReturnType<typeof db.delete>;
    });

    await FileSystem.writeAsStringAsync(
      '/mock/cache/silk_bra.jpg',
      Buffer.from('Raw unencrypted lace bra photo bytes').toString('base64'),
      { encoding: FileSystem.EncodingType.Base64 },
    );
  });

  it('normalizes categories strictly to the 5 allowable wardrobe buckets', () => {
    expect(normalizeWardrobeCategory('top')).toBe('top');
    expect(normalizeWardrobeCategory('t-shirt')).toBe('top');
    expect(normalizeWardrobeCategory('pants')).toBe('bottom');
    expect(normalizeWardrobeCategory('lace bra')).toBe('underwear');
    expect(normalizeWardrobeCategory('panties')).toBe('underwear');
    expect(normalizeWardrobeCategory('sheer thigh-highs')).toBe('hosiery');
    expect(normalizeWardrobeCategory('unknown-thing')).toBe('others');
  });

  it('ingests photo into sandbox only, encrypts item + description, and shreds temp source', async () => {
    const res = await ingestPhoto('/mock/cache/silk_bra.jpg', sessionKey, {
      photoKind: 'wardrobe',
      category: 'underwear',
      item: 'lace bra',
      description: 'Black scalloped Chantilly lace balconette bra',
    });

    expect(res.isDuplicate).toBe(false);
    expect(storedPhotos).toHaveLength(1);
    const row = storedPhotos[0];

    expect(row.photoKind).toBe('wardrobe');
    expect(row.category).toBe('underwear');
    expect(row.encryptedItem).not.toContain('lace bra');
    expect(row.encryptedDescription).not.toContain('Chantilly');
    expect(mockFileSystem._storage.has('/mock/cache/silk_bra.jpg')).toBe(false);

    const decrypted = getDecryptedPhotoMetadataStrict(row, sessionKey);
    expect(decrypted.item).toBe('lace bra');
    expect(decrypted.description).toBe('Black scalloped Chantilly lace balconette bra');
  });

  it('rejects 1-byte tampering on encrypted item or description', async () => {
    await ingestPhoto('/mock/cache/silk_bra.jpg', sessionKey, {
      category: 'underwear',
      item: 'panties',
      description: 'Silk bikini cut',
    });

    const row = { ...storedPhotos[0] };
    const itemCipherBuf = Buffer.from(row.encryptedItem!, 'base64');
    itemCipherBuf[0] = itemCipherBuf[0] ^ 0x01;
    row.encryptedItem = itemCipherBuf.toString('base64');

    expect(() => getDecryptedPhotoMetadataStrict(row, sessionKey)).toThrow();
    expect(getDecryptedPhotoMetadata(row, sessionKey)).toEqual({ item: '', description: '' });
  });

  it('skips duplicate photo bytes via HMAC-SHA256 blind index', async () => {
    const first = await ingestPhoto('/mock/cache/silk_bra.jpg', sessionKey, {
      category: 'underwear',
      item: 'bra',
    });
    expect(first.isDuplicate).toBe(false);

    await FileSystem.writeAsStringAsync(
      '/mock/cache/silk_bra_copy.jpg',
      Buffer.from('Raw unencrypted lace bra photo bytes').toString('base64'),
      { encoding: FileSystem.EncodingType.Base64 },
    );

    const second = await ingestPhoto('/mock/cache/silk_bra_copy.jpg', sessionKey, {
      category: 'underwear',
      item: 'bra',
    });
    expect(second.isDuplicate).toBe(true);
    expect(storedPhotos).toHaveLength(1);
    expect(mockFileSystem._storage.has('/mock/cache/silk_bra_copy.jpg')).toBe(false);
  });

  it('routes human-body photos to past_ootd and isolated garments to wardrobe via AI vision', async () => {
    await ingestPhoto('/mock/cache/silk_bra.jpg', sessionKey);
    const photo = storedPhotos[0];

    const querySpy = jest.spyOn(llmClient, 'queryLlm').mockResolvedValueOnce({
      content: JSON.stringify({
        hasHumanBodyMainSubject: true,
        category: 'top',
        item: 'silk camisole',
        description: 'Mirror try-on wearing ivory satin camisole',
      }),
      provider: 'openrouter',
      model: 'x-ai/grok-4.7',
      quotaUsed: 1,
    });

    const classified = await analyzeAndClassifyPhoto(photo, sessionKey);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(classified.hasHumanBodyMainSubject).toBe(true);
    expect(classified.photoKind).toBe('past_ootd');
    expect(classified.category).toBe('top');
    expect(classified.item).toBe('silk camisole');

    // Garment-only classification routes to wardrobe
    const garmentOnly = parseClassificationPayload(
      '```json\n{"hasHumanBodyMainSubject":false,"category":"hosiery","item":"sheer thigh-highs","description":"20 denier sheer black lace-top stockings"}\n```',
    );
    expect(garmentOnly.photoKind).toBe('wardrobe');
    expect(garmentOnly.category).toBe('hosiery');
    expect(garmentOnly.item).toBe('sheer thigh-highs');
  });

  it('shreds encrypted files on disk when deleting a photo and updates metadata', async () => {
    const res = await ingestPhoto('/mock/cache/silk_bra.jpg', sessionKey);
    const row = storedPhotos[0];
    await savePhotoMetadata(res.photoId, { item: 'tshirt', category: 'top' }, sessionKey);
    expect(storedPhotos[0].category).toBe('top');

    const fullPath = `/mock/documents/${row.encryptedFilePath}`;
    const thumbPath = `/mock/documents/${row.encryptedThumbnailPath}`;
    expect(mockFileSystem._storage.has(fullPath)).toBe(true);
    expect(mockFileSystem._storage.has(thumbPath)).toBe(true);

    await deletePhoto(res.photoId);
    expect(mockFileSystem._storage.has(fullPath)).toBe(false);
    expect(mockFileSystem._storage.has(thumbPath)).toBe(false);
    expect(storedPhotos).toHaveLength(0);
  });
});
