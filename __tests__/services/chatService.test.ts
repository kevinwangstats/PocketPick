import * as FileSystem from 'expo-file-system';
import QuickCrypto from 'react-native-quick-crypto';
import { getDatabase } from '@/db/client';
import { chatMessages, ChatMessage, Person, Photo } from '@/db/schema';
import {
  sendChatMessage,
  getChatMessages,
  retryAssistantReply,
  decryptMessageTextStrict,
} from '@/services/chat/chatService';
import * as personService from '@/services/persons/personService';
import * as personMemoryService from '@/services/persons/personMemoryService';
import * as photoService from '@/services/photos/photoService';
import * as llmClient from '@/services/llm/llmClient';
import * as outfitPicker from '@/engine/outfitPicker';
import * as lookbookStore from '@/engine/lookbookStore';
import { mockFileSystem } from '../mocks/file-system.mock';

describe('Encrypted Chat Service, Single-Pass Vision/Memory & Retry (TDD)', () => {
  const sessionKey = QuickCrypto.randomBytes(32);
  let storedMessages: ChatMessage[] = [];
  let storedPhotos: Photo[] = [];

  const celeste: Person = {
    id: 'person-celeste',
    name: 'Celeste',
    bio: 'Parisian Atelier',
    tonePreset: 'soft-romantic',
    personalityPrompt: 'Always respond like a warm Parisian stylist.',
    memoryText: '## Favorite Colors & Palettes\n- Deep emerald\n',
    memoryUpdatedAt: new Date(),
    avatarEncryptedPath: null,
    avatarIv: null,
    avatarTag: null,
    avatarThumbPath: null,
    avatarThumbIv: null,
    avatarThumbTag: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    storedMessages = [];
    storedPhotos = [];
    mockFileSystem._reset();
    jest.restoreAllMocks();

    jest.spyOn(personService, 'getPersonById').mockResolvedValue(celeste);
    jest.spyOn(personMemoryService, 'getPersonMemory').mockResolvedValue(celeste.memoryText);

    const db = await getDatabase();
    jest.spyOn(db, 'insert').mockImplementation((table: unknown) => {
      return {
        values: async (val: Record<string, unknown>) => {
          if (table === chatMessages) {
            storedMessages.push({ ...(val as unknown as ChatMessage) });
          } else {
            storedPhotos.push({ ...(val as unknown as Photo) });
          }
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
        from: (table: unknown) => ({
          where: () => {
            if (table === chatMessages) {
              const res = Promise.resolve(storedMessages) as Promise<ChatMessage[]> & {
                orderBy: () => Promise<ChatMessage[]>;
              };
              res.orderBy = () => Promise.resolve(storedMessages);
              return res;
            }
            const res = Promise.resolve(storedPhotos) as Promise<Photo[]> & {
              limit: () => Promise<Photo[]>;
            };
            res.limit = () => Promise.resolve(storedPhotos);
            return res;
          },
        }),
      } as unknown as ReturnType<typeof db.select>;
    });
  });

  it('encrypts chat messages locally and rejects 1-byte tampering', async () => {
    jest.spyOn(llmClient, 'queryLlmConversation').mockResolvedValueOnce({
      content: 'Silk always flatters emerald tones.',
      provider: 'openrouter',
      model: 'x-ai/grok-4.7',
      quotaUsed: 1,
    });

    const result = await sendChatMessage({
      personId: celeste.id,
      text: 'Do I suit emerald silk?',
      sessionKey,
    });

    expect(storedMessages).toHaveLength(2);
    expect(storedMessages[0].encryptedContent).not.toContain('emerald');
    expect(result.assistantMessage?.text).toBe('Silk always flatters emerald tones.');

    const loaded = await getChatMessages(celeste.id, sessionKey);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].text).toBe('Do I suit emerald silk?');

    // 1-byte tamper rejection
    const tampered = { ...storedMessages[0] };
    const buf = Buffer.from(tampered.encryptedContent, 'base64');
    buf[0] = buf[0] ^ 0xff;
    tampered.encryptedContent = buf.toString('base64');
    expect(() => decryptMessageTextStrict(tampered, sessionKey, celeste.id)).toThrow();
  });

  it('sends attached photo + chat text in 1 OpenRouter call, strips <memory_add>/<photo_meta>, and updates both', async () => {
    await FileSystem.writeAsStringAsync(
      '/mock/cache/mirror_tryon.jpg',
      Buffer.from('Mirror try-on bytes').toString('base64'),
      { encoding: FileSystem.EncodingType.Base64 },
    );

    const saveMetaSpy = jest.spyOn(photoService, 'savePhotoMetadata').mockResolvedValue();
    const applyMemSpy = jest
      .spyOn(personMemoryService, 'applyPiggybackMemoryUpdates')
      .mockResolvedValue('updated');

    const llmSpy = jest.spyOn(llmClient, 'queryLlmConversation').mockResolvedValueOnce({
      content: `That satin slip hugs your waist effortlessly!

<photo_meta>{"hasHumanBodyMainSubject": true, "category": "top", "item": "satin slip", "description": "Champagne bias-cut satin mirror shot"}</photo_meta>
<memory_add>[{"section": "Fabrics & Textures That Make Me Tingle", "item": "Champagne bias-cut satin"}]</memory_add>`,
      provider: 'openrouter',
      model: 'x-ai/grok-4.7',
      quotaUsed: 2,
    });

    const res = await sendChatMessage({
      personId: celeste.id,
      text: 'Look how this satin feels on me',
      attachment: { kind: 'new_photo', uri: '/mock/cache/mirror_tryon.jpg' },
      sessionKey,
    });

    expect(llmSpy).toHaveBeenCalledTimes(1);
    const turns = llmSpy.mock.calls[0][0].turns;
    expect(turns[turns.length - 1].imageBase64).toContain('data:image/jpeg;base64,');
    expect(turns[turns.length - 1].text).toContain('Look how this satin feels on me');

    expect(res.assistantMessage?.text).toBe('That satin slip hugs your waist effortlessly!');
    expect(res.autoMovedToPastOotdPhotoId).toBeTruthy();
    expect(saveMetaSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ photoKind: 'past_ootd', aiHasHumanBody: true }),
      sessionKey,
    );
    expect(applyMemSpy).toHaveBeenCalledWith(celeste.id, [
      { section: 'Fabrics & Textures That Make Me Tingle', item: 'Champagne bias-cut satin' },
    ]);
  });

  it('saves user message optimistically on API failure and supports clean retry', async () => {
    jest
      .spyOn(llmClient, 'queryLlmConversation')
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce({
        content: 'Recovered reply!',
        provider: 'openrouter',
        model: 'x-ai/grok-4.7',
        quotaUsed: 3,
      });

    const failed = await sendChatMessage({
      personId: celeste.id,
      text: 'Are you there?',
      sessionKey,
    });

    expect(failed.assistantMessage).toBeNull();
    expect(failed.error).toContain('Network timeout');
    expect(storedMessages).toHaveLength(1);

    const retried = await retryAssistantReply({
      personId: celeste.id,
      userMessage: failed.userMessage,
      sessionKey,
    });

    expect(retried.assistantMessage?.text).toBe('Recovered reply!');
    expect(storedMessages).toHaveLength(2);
  });

  it('still picks and delivers OOTD look card offline when OpenRouter fails', async () => {
    jest.spyOn(outfitPicker, 'pickOutfitFromWardrobe').mockResolvedValueOnce({
      triggerType: 'ootd',
      slots: [
        {
          slot: 'bra',
          category: 'underwear',
          photoId: 'bra-1',
          itemLabel: 'lace bra',
          description: 'Black Chantilly lace',
          thumbnailPath: 'photos/bra-1_thumb.enc',
          thumbnailIv: 'iv',
          thumbnailTag: 'tag',
        },
      ],
      excludedCategories: ['top', 'bottom'],
      emptySlots: [],
      usedAiCuration: false,
      rawConstraintText: 'with no top and no pants',
      totalWardrobeCount: 3,
    });

    jest.spyOn(lookbookStore, 'saveOotdLook').mockResolvedValueOnce({
      id: 'look-offline-1',
      personId: celeste.id,
      triggerType: 'ootd',
      slots: [
        {
          slot: 'bra',
          category: 'underwear',
          photoId: 'bra-1',
          itemLabel: 'lace bra',
          description: 'Black Chantilly lace',
          thumbnailPath: 'photos/bra-1_thumb.enc',
          thumbnailIv: 'iv',
          thumbnailTag: 'tag',
        },
      ],
      isFavorite: false,
      wornAt: null,
      fitcheckPhotoId: null,
      createdAt: new Date(),
    });

    jest.spyOn(llmClient, 'queryLlmConversation').mockRejectedValueOnce(new Error('Offline'));

    const res = await sendChatMessage({
      personId: celeste.id,
      text: '/ootd with no top and no pants',
      sessionKey,
    });

    expect(res.assistantMessage?.ootdLook?.id).toBe('look-offline-1');
    expect(res.error).toBe('Offline');
  });
});
