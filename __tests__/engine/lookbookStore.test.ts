import QuickCrypto from 'react-native-quick-crypto';
import { getDatabase } from '@/db/client';
import { ootdLooks, OotdLook } from '@/db/schema';
import { saveOotdLook, getOotdLookById, decryptLookSlotsStrict } from '@/engine/lookbookStore';
import { OotdSlotSelection } from '@/engine/types';

describe('OOTD Lookbook Store, Tombstones & Tamper Rejection (TDD)', () => {
  const sessionKey = QuickCrypto.randomBytes(32);
  let storedLooks: OotdLook[] = [];
  let existingPhotoIds: string[] = [];

  beforeEach(async () => {
    storedLooks = [];
    existingPhotoIds = ['photo-1'];
    jest.restoreAllMocks();

    const db = await getDatabase();
    jest.spyOn(db, 'insert').mockImplementation((table: unknown) => {
      return {
        values: async (val: OotdLook) => {
          if (table === ootdLooks) {
            storedLooks.push({ ...val });
          }
        },
      } as unknown as ReturnType<typeof db.insert>;
    });

    jest.spyOn(db, 'select').mockImplementation(() => {
      return {
        from: (table: unknown) => ({
          where: () => {
            if (table === ootdLooks) {
              const res = Promise.resolve(storedLooks) as Promise<OotdLook[]> & {
                limit: () => Promise<OotdLook[]>;
              };
              res.limit = () => Promise.resolve(storedLooks);
              return res;
            }
            const photoRows = existingPhotoIds.map((id) => ({ id }));
            return Promise.resolve(photoRows);
          },
        }),
      } as unknown as ReturnType<typeof db.select>;
    });
  });

  it('encrypts OOTD look slots and recovers them cleanly', async () => {
    const slots: OotdSlotSelection[] = [
      {
        slot: 'bra',
        category: 'underwear',
        photoId: 'photo-1',
        itemLabel: 'chantilly lace bra',
        description: 'Black floral lace',
        thumbnailPath: 'photos/photo-1_thumb.enc',
        thumbnailIv: 'iv',
        thumbnailTag: 'tag',
      },
    ];

    const saved = await saveOotdLook({
      personId: 'person-celeste',
      triggerType: 'ootd',
      slots,
      sessionKey,
      isFavorite: true,
    });

    expect(storedLooks[0].encryptedSlots).not.toContain('chantilly');
    const fetched = await getOotdLookById(saved.id, sessionKey);
    expect(fetched?.slots[0].itemLabel).toBe('chantilly lace bra');
    expect(fetched?.slots[0].isMissing).toBeFalsy();
  });

  it('marks deleted wardrobe photos as graceful tombstones while preserving item labels', async () => {
    const slots: OotdSlotSelection[] = [
      {
        slot: 'top',
        category: 'top',
        photoId: 'deleted-photo-99',
        itemLabel: 'crimson silk camisole',
        description: 'Deleted item',
        thumbnailPath: 'photos/deleted-photo-99_thumb.enc',
        thumbnailIv: 'iv',
        thumbnailTag: 'tag',
      },
    ];

    const saved = await saveOotdLook({
      personId: 'person-celeste',
      triggerType: 'ootd',
      slots,
      sessionKey,
    });

    const fetched = await getOotdLookById(saved.id, sessionKey);
    expect(fetched?.slots[0].isMissing).toBe(true);
    expect(fetched?.slots[0].itemLabel).toBe('crimson silk camisole');
    expect(fetched?.slots[0].thumbnailPath).toBeNull();
  });

  it('rejects 1-byte tampering on encrypted look slots', async () => {
    await saveOotdLook({
      personId: 'person-celeste',
      triggerType: 'secret',
      slots: [],
      sessionKey,
    });

    const tampered = { ...storedLooks[0] };
    const buf = Buffer.from(tampered.encryptedSlots, 'base64');
    buf[0] = buf[0] ^ 0xff;
    tampered.encryptedSlots = buf.toString('base64');

    expect(() => decryptLookSlotsStrict(tampered, sessionKey)).toThrow();
  });
});
