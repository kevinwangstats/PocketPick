import {
  appSecurity,
  persons,
  photos,
  chatMessages,
  ootdLooks,
  apiQuotas,
  WARDROBE_CATEGORIES,
  PHOTO_KINDS,
} from '@/db/schema';
import { getDatabase, closeDatabase } from '@/db/client';
import { open } from '@op-engineering/op-sqlite';

describe('OOTD Drizzle Schema & Database Client Initialization', () => {
  beforeEach(() => {
    closeDatabase();
    jest.clearAllMocks();
  });

  afterEach(() => {
    closeDatabase();
  });

  it('defines strict 5-category wardrobe enum and photo kind enum', () => {
    expect(WARDROBE_CATEGORIES).toEqual(['top', 'bottom', 'underwear', 'hosiery', 'others']);
    expect(PHOTO_KINDS).toEqual(['wardrobe', 'past_ootd']);
  });

  it('defines all canonical OOTD table schema configurations', () => {
    expect(appSecurity.salt).toBeDefined();
    expect(appSecurity.verifierCipher).toBeDefined();

    expect(persons.name).toBeDefined();
    expect(persons.personalityPrompt).toBeDefined();
    expect(persons.memoryText).toBeDefined();

    expect(photos.photoKind).toBeDefined();
    expect(photos.category).toBeDefined();
    expect(photos.encryptedItem).toBeDefined();
    expect(photos.encryptedDescription).toBeDefined();

    expect(chatMessages.personId).toBeDefined();
    expect(chatMessages.encryptedContent).toBeDefined();

    expect(ootdLooks.personId).toBeDefined();
    expect(ootdLooks.encryptedSlots).toBeDefined();
    expect(ootdLooks.fitcheckPhotoId).toBeDefined();

    expect(apiQuotas.periodMonth).toBeDefined();
    expect(apiQuotas.requestCount).toBeDefined();
  });

  it('initializes the database with SQLCipher encryption key and runs table creation', async () => {
    const db = await getDatabase();
    expect(db).toBeDefined();

    expect(open).toHaveBeenCalledTimes(1);
    const openCall = (open as jest.Mock).mock.calls[0][0];
    expect(openCall.name).toBe('pocketpick.db');
    expect(openCall.encryptionKey).toHaveLength(64);
  });

  it('returns singleton database instance on repeated getDatabase calls', async () => {
    const db1 = await getDatabase();
    const db2 = await getDatabase();
    expect(db1).toBe(db2);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
