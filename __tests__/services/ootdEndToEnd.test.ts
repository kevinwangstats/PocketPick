import * as FileSystem from 'expo-file-system';
import QuickCrypto from 'react-native-quick-crypto';
import { getDatabase } from '@/db/client';
import {
  appSecurity,
  persons,
  photos,
  chatMessages,
  ootdLooks,
  AppSecurity,
  Person,
  Photo,
  ChatMessage,
  OotdLook,
} from '@/db/schema';
import { useSessionStore } from '@/stores/useSessionStore';
import { initializeAppPassphrase } from '@/services/auth/appAuthService';
import { createPerson, getPersonById } from '@/services/persons/personService';
import { ingestPhoto, deletePhoto } from '@/services/photos/photoService';
import { sendChatMessage, sendFitCheckForLook } from '@/services/chat/chatService';
import { swapOutfitSlot } from '@/engine/outfitPicker';
import { getOotdLookById, updateOotdLookSlots } from '@/engine/lookbookStore';
import { exportEncryptedBackup, importEncryptedBackup } from '@/services/backup/backupService';
import * as llmClient from '@/services/llm/llmClient';
import { mockFileSystem } from '../mocks/file-system.mock';

describe('PocketPick OOTD End-to-End Lifecycle Integration (TDD)', () => {
  let dbSecurity: AppSecurity | null = null;
  let dbPersons: Person[] = [];
  let dbPhotos: Photo[] = [];
  let dbChats: ChatMessage[] = [];
  let dbLooks: OotdLook[] = [];

  beforeEach(async () => {
    dbSecurity = null;
    dbPersons = [];
    dbPhotos = [];
    dbChats = [];
    dbLooks = [];
    mockFileSystem._reset();
    useSessionStore.getState().lockApp();
    jest.restoreAllMocks();

    const db = await getDatabase();
    jest.spyOn(db, 'insert').mockImplementation((table: unknown) => {
      return {
        values: async (val: Record<string, unknown>) => {
          if (table === appSecurity) dbSecurity = val as unknown as AppSecurity;
          else if (table === persons) dbPersons.push({ ...(val as unknown as Person) });
          else if (table === photos) dbPhotos.push({ ...(val as unknown as Photo) });
          else if (table === chatMessages) dbChats.push({ ...(val as unknown as ChatMessage) });
          else if (table === ootdLooks) dbLooks.push({ ...(val as unknown as OotdLook) });
        },
      } as unknown as ReturnType<typeof db.insert>;
    });

    jest.spyOn(db, 'update').mockImplementation((table: unknown) => {
      return {
        set: (patch: Record<string, unknown>) => ({
          where: async () => {
            if (table === persons && dbPersons[0]) Object.assign(dbPersons[0], patch);
            if (table === ootdLooks && dbLooks[0]) Object.assign(dbLooks[0], patch);
          },
        }),
      } as unknown as ReturnType<typeof db.update>;
    });

    function extractClauseStrings(node: unknown): string[] {
      const found: string[] = [];
      const visited = new Set<unknown>();
      const stack: unknown[] = [node];
      while (stack.length > 0) {
        const cur = stack.pop();
        if (!cur || typeof cur !== 'object' || visited.has(cur)) continue;
        visited.add(cur);
        if ('value' in cur && typeof (cur as { value: unknown }).value === 'string') {
          found.push((cur as { value: string }).value);
        }
        if ('value' in cur && Array.isArray((cur as { value: unknown }).value)) {
          for (const v of (cur as { value: unknown[] }).value) {
            if (typeof v === 'string') found.push(v);
          }
        }
        for (const child of Object.values(cur as Record<string, unknown>)) {
          if (child && typeof child === 'object' && !visited.has(child)) stack.push(child);
        }
      }
      return found;
    }

    jest.spyOn(db, 'delete').mockImplementation((table: unknown) => {
      return {
        where: async (clause: unknown) => {
          const vals = extractClauseStrings(clause);
          if (table === photos) {
            dbPhotos = dbPhotos.filter((p) => !vals.includes(p.id));
          }
        },
      } as unknown as ReturnType<typeof db.delete>;
    });

    jest.spyOn(db, 'select').mockImplementation(() => {
      return {
        from: (table: unknown) => {
          const getRows = () => {
            if (table === appSecurity) return dbSecurity ? [dbSecurity] : [];
            if (table === persons) return dbPersons;
            if (table === photos) return dbPhotos;
            if (table === chatMessages) return dbChats;
            if (table === ootdLooks) return dbLooks;
            return [];
          };
          const rows = getRows();
          const makeChain = (filtered: unknown[]) => {
            const res = Promise.resolve(filtered) as unknown as Promise<unknown[]> & {
              limit: (n: number) => Promise<unknown[]>;
              orderBy: () => Promise<unknown[]>;
            };
            res.limit = (n: number) => Promise.resolve(filtered.slice(0, n));
            res.orderBy = () => Promise.resolve(filtered);
            return res;
          };

          const root = makeChain(rows) as ReturnType<typeof makeChain> & {
            where: (clause: unknown) => ReturnType<typeof makeChain>;
          };
          root.where = (clause: unknown) => {
            const vals = extractClauseStrings(clause);
            if (vals.length === 0) return makeChain(rows);

            if (table === photos) {
              const matched = dbPhotos.filter(
                (p) =>
                  vals.includes(p.id) || vals.includes(p.fileHash) || vals.includes(p.photoKind),
              );
              return makeChain(matched);
            }
            if (table === persons) {
              const matched = dbPersons.filter((p) => vals.includes(p.id) || vals.includes(p.name));
              return makeChain(matched);
            }
            if (table === chatMessages) {
              const matched = dbChats.filter(
                (c) => vals.includes(c.personId) || vals.includes(c.id),
              );
              return makeChain(matched);
            }
            if (table === ootdLooks) {
              const matched = dbLooks.filter(
                (l) => vals.includes(l.id) || vals.includes(l.personId),
              );
              return makeChain(matched);
            }
            return makeChain(rows);
          };
          return root;
        },
      } as unknown as ReturnType<typeof db.select>;
    });
  });

  it('executes full OOTD flow from unlock -> persona -> wardrobe -> /ootd -> fit check -> backup -> zeroize', async () => {
    // 1. Unified Master Passphrase setup
    const sessionKey = await initializeAppPassphrase('velvet-master-2026');
    expect(useSessionStore.getState().isUnlocked).toBe(true);

    // 2. Create AI Person with encrypted portrait
    await FileSystem.writeAsStringAsync(
      '/mock/cache/avatar.jpg',
      Buffer.from('Celeste portrait').toString('base64'),
      { encoding: FileSystem.EncodingType.Base64 },
    );
    const celeste = await createPerson({
      name: 'Celeste',
      bio: 'Parisian Atelier',
      tonePreset: 'soft-romantic',
      personalityPrompt: 'You adore silk and Chantilly lace.',
      avatarUri: '/mock/cache/avatar.jpg',
      sessionKey,
    });

    // 3. Ingest Wardrobe garments (including bra + panties)
    const garments = [
      { file: 'top.jpg', cat: 'top' as const, item: 'tshirt', kind: 'wardrobe' as const },
      { file: 'pants.jpg', cat: 'bottom' as const, item: 'pants', kind: 'wardrobe' as const },
      { file: 'bra.jpg', cat: 'underwear' as const, item: 'lace bra', kind: 'wardrobe' as const },
      {
        file: 'panties.jpg',
        cat: 'underwear' as const,
        item: 'silk panties',
        kind: 'wardrobe' as const,
      },
      {
        file: 'panties2.jpg',
        cat: 'underwear' as const,
        item: 'lace thong',
        kind: 'wardrobe' as const,
      },
    ];
    for (const g of garments) {
      const p = `/mock/cache/${g.file}`;
      await FileSystem.writeAsStringAsync(p, Buffer.from(`bytes-${g.file}`).toString('base64'), {
        encoding: FileSystem.EncodingType.Base64,
      });
      await ingestPhoto(p, sessionKey, { photoKind: g.kind, category: g.cat, item: g.item });
    }

    // 4. Single-pass chat turn updating plain-text memory
    jest
      .spyOn(llmClient, 'queryLlmConversation')
      .mockResolvedValueOnce({
        content:
          'I will remember how much black silk makes you feel electric.\n<memory_add>[{"section":"Fabrics & Textures That Make Me Tingle","item":"Black liquid silk"}]</memory_add>',
        provider: 'openrouter',
        model: 'x-ai/grok-4.7',
        quotaUsed: 1,
      })
      .mockResolvedValueOnce({
        content: 'Just your lace bra and silk panties tonight—pure intimacy.',
        provider: 'openrouter',
        model: 'x-ai/grok-4.7',
        quotaUsed: 2,
      })
      .mockResolvedValueOnce({
        content: 'That mirror fit check is breathtaking!',
        provider: 'openrouter',
        model: 'x-ai/grok-4.7',
        quotaUsed: 3,
      });

    await sendChatMessage({
      personId: celeste.id,
      text: 'Black liquid silk makes me tingle!',
      sessionKey,
    });
    const updatedCeleste = await getPersonById(celeste.id);
    expect(updatedCeleste?.memoryText).toContain('- Black liquid silk');

    // 5. Trigger "/ootd with no top and no pants"
    const ootdRes = await sendChatMessage({
      personId: celeste.id,
      text: '/ootd with no top and no pants',
      sessionKey,
    });
    const look = ootdRes.assistantMessage?.ootdLook;
    expect(look).toBeTruthy();
    expect(look?.slots.map((s) => s.slot)).toEqual(['bra', 'panties']);

    // 6. Swap panties slot
    const swapped = await swapOutfitSlot({
      existingSlots: look!.slots,
      targetSlot: 'panties',
      sessionKey,
    });
    await updateOotdLookSlots(look!.id, swapped.updatedSlots, sessionKey);

    // 7. Send Fit Check (saved directly to Past OOTD)
    await FileSystem.writeAsStringAsync(
      '/mock/cache/fitcheck.jpg',
      Buffer.from('Fit check mirror selfie').toString('base64'),
      { encoding: FileSystem.EncodingType.Base64 },
    );
    await sendFitCheckForLook({
      personId: celeste.id,
      look: look!,
      photoUri: '/mock/cache/fitcheck.jpg',
      sessionKey,
    });
    expect(dbLooks[0].fitcheckPhotoId).toBeTruthy();

    // 8. Delete first garment -> tombstone safety on look
    const firstId = dbPhotos[0].id;
    await deletePhoto(firstId);
    const hydrated = await getOotdLookById(look!.id, sessionKey);
    expect(hydrated).toBeTruthy();

    // 9. Backup export & import round-trip
    let archiveData = '';
    await exportEncryptedBackup({
      sessionKey,
      backupPassphrase: 'e2e-backup-password',
      includeChats: true,
      shareArchive: async (uri) => {
        archiveData = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      },
    });
    expect(archiveData).not.toContain('Black liquid silk');

    const destKey = QuickCrypto.randomBytes(32);
    await FileSystem.writeAsStringAsync('/mock/cache/in.ootdbackup', archiveData, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const imported = await importEncryptedBackup({
      archiveUri: '/mock/cache/in.ootdbackup',
      backupPassphrase: 'e2e-backup-password',
      sessionKey: destKey,
    });
    expect(imported.personsImported).toBe(1);

    // 10. Lock app and verify session key zeroized
    useSessionStore.getState().lockApp();
    expect(useSessionStore.getState().isUnlocked).toBe(false);
    expect(sessionKey.equals(Buffer.alloc(32, 0))).toBe(true);
  });
});
