import * as FileSystem from 'expo-file-system';
import QuickCrypto from 'react-native-quick-crypto';
import { getDatabase } from '@/db/client';
import { Person, persons } from '@/db/schema';
import {
  createPerson,
  updatePerson,
  deletePerson,
  decryptPersonAvatarUri,
  buildPersonAuthoritativePrompt,
} from '@/services/persons/personService';
import { mockFileSystem } from '../mocks/file-system.mock';

describe('AI Person Service & Encrypted Portrait Pipeline (TDD)', () => {
  const sessionKey = QuickCrypto.randomBytes(32);
  let storedPersons: Person[] = [];

  beforeEach(async () => {
    storedPersons = [];
    mockFileSystem._reset();
    jest.restoreAllMocks();

    const db = await getDatabase();
    jest.spyOn(db, 'insert').mockImplementation((table: unknown) => {
      return {
        values: async (val: Person) => {
          if (table === persons) {
            storedPersons.push({ ...val });
          }
        },
      } as unknown as ReturnType<typeof db.insert>;
    });

    jest.spyOn(db, 'select').mockImplementation(() => {
      return {
        from: () => {
          const all = Promise.resolve(storedPersons) as Promise<Person[]> & {
            where: () => Promise<Person[]> & { limit: () => Promise<Person[]> };
            orderBy: () => Promise<Person[]>;
          };
          all.where = () => {
            const res = Promise.resolve(storedPersons) as Promise<Person[]> & {
              limit: () => Promise<Person[]>;
            };
            res.limit = () => Promise.resolve(storedPersons);
            return res;
          };
          all.orderBy = () => Promise.resolve(storedPersons);
          return all;
        },
      } as unknown as ReturnType<typeof db.select>;
    });

    jest.spyOn(db, 'update').mockImplementation(() => {
      return {
        set: (patch: Partial<Person>) => ({
          where: async () => {
            if (storedPersons[0]) {
              Object.assign(storedPersons[0], patch);
            }
          },
        }),
      } as unknown as ReturnType<typeof db.update>;
    });

    jest.spyOn(db, 'delete').mockImplementation(() => {
      return {
        where: async () => {
          storedPersons = [];
        },
      } as unknown as ReturnType<typeof db.delete>;
    });

    await FileSystem.writeAsStringAsync(
      '/mock/cache/celeste_avatar.jpg',
      Buffer.from('Portrait photo bytes').toString('base64'),
      { encoding: FileSystem.EncodingType.Base64 },
    );
  });

  it('creates an AI Person with unique name enforcement and encrypted sandbox avatar', async () => {
    const celeste = await createPerson({
      name: 'Celeste',
      bio: 'Parisian Atelier',
      tonePreset: 'soft-romantic',
      personalityPrompt: 'You are Celeste, a sensual French stylist.',
      avatarUri: '/mock/cache/celeste_avatar.jpg',
      sessionKey,
    });

    expect(celeste.name).toBe('Celeste');
    expect(celeste.avatarEncryptedPath).toContain('avatars/');
    expect(mockFileSystem._storage.has('/mock/cache/celeste_avatar.jpg')).toBe(false);

    // Duplicate case-insensitive name rejected
    await expect(
      createPerson({
        name: '  celeste ',
        personalityPrompt: 'Duplicate',
      }),
    ).rejects.toThrow('A person named "celeste" already exists');

    // Avatar decrypts cleanly in memory
    const avatarUri = await decryptPersonAvatarUri(celeste, sessionKey, { strict: true });
    expect(avatarUri?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('rejects 1-byte tampered encrypted avatar ciphertext', async () => {
    const celeste = await createPerson({
      name: 'Valentina',
      personalityPrompt: 'Bold velvet muse.',
      avatarUri: '/mock/cache/celeste_avatar.jpg',
      sessionKey,
    });

    const thumbPath = `/mock/documents/${celeste.avatarThumbPath!}`;
    const tamperedBuf = Buffer.from(mockFileSystem._storage.get(thumbPath)!, 'base64');
    tamperedBuf[0] = tamperedBuf[0] ^ 0xff;
    mockFileSystem._storage.set(thumbPath, tamperedBuf.toString('base64'));

    await expect(decryptPersonAvatarUri(celeste, sessionKey, { strict: true })).rejects.toThrow();
  });

  it('updates Person profile and shreds encrypted avatars on delete', async () => {
    const person = await createPerson({
      name: 'Sora',
      personalityPrompt: 'Tokyo minimalist',
      avatarUri: '/mock/cache/celeste_avatar.jpg',
      sessionKey,
    });

    await updatePerson(person.id, { bio: 'Updated Bio' });
    expect(storedPersons[0].bio).toBe('Updated Bio');

    const fullPath = `/mock/documents/${person.avatarEncryptedPath!}`;
    expect(mockFileSystem._storage.has(fullPath)).toBe(true);

    await deletePerson(person.id);
    expect(mockFileSystem._storage.has(fullPath)).toBe(false);
    expect(storedPersons).toHaveLength(0);
  });

  it('composes authoritative prompt uniting personality, tone preset, and personal memory', async () => {
    const person = await createPerson({
      name: 'Celeste',
      bio: 'Atelier',
      tonePreset: 'playful-teasing',
      personalityPrompt: 'Always celebrate sheer textures.',
      memoryText: '## Fabrics & Textures That Make Me Tingle\n- Black Chantilly lace',
    });

    const prompt = buildPersonAuthoritativePrompt(person, {
      includeMemoryTrailerInstruction: true,
    });

    expect(prompt).toContain('You are "Celeste" (Atelier).');
    expect(prompt).toContain('Always celebrate sheer textures.');
    expect(prompt).toContain('Playful & Teasing');
    expect(prompt).toContain('Black Chantilly lace');
    expect(prompt).toContain('<memory_add>');
  });
});
