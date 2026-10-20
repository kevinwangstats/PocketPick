import QuickCrypto from 'react-native-quick-crypto';
import { eq, and } from 'drizzle-orm';
import { getDatabase } from '../../db/client';
import { resources, Resource } from '../../db/schema';
import { encryptString, decryptString } from '../../crypto/cipher';

export interface TicketPayload {
  title: string;
  content: string;
  weight?: number;
}

export interface DecryptedTicket {
  id: string;
  vaultId: string;
  title: string;
  content: string;
  weight: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Creates an envelope-encrypted text ticket inside the specified vault.
 */
export async function createTicket(
  vaultId: string,
  payload: TicketPayload,
  vaultKey: Buffer,
): Promise<string> {
  if (!payload.title.trim()) {
    throw new Error('Ticket title is required');
  }

  const db = await getDatabase();
  const ticketId = QuickCrypto.randomBytes(16).toString('hex');

  const serialized = JSON.stringify({
    title: payload.title.trim(),
    content: payload.content?.trim() ?? '',
  });

  const encrypted = encryptString(serialized, vaultKey, vaultId);

  await db.insert(resources).values({
    id: ticketId,
    vaultId,
    type: 'ticket',
    weight: payload.weight ?? 1,
    encryptedPayload: encrypted.ciphertext,
    payloadIv: encrypted.iv,
    payloadTag: encrypted.tag,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return ticketId;
}

/**
 * Fetches all tickets in a vault and decrypts them in memory using the active vault key.
 */
export async function getDecryptedTickets(
  vaultId: string,
  vaultKey: Buffer,
): Promise<DecryptedTicket[]> {
  const db = await getDatabase();
  const rows: Resource[] = await db
    .select()
    .from(resources)
    .where(and(eq(resources.vaultId, vaultId), eq(resources.type, 'ticket')));

  const decryptedList: DecryptedTicket[] = [];

  for (const row of rows) {
    if (!row.encryptedPayload || !row.payloadIv || !row.payloadTag) {
      continue;
    }

    try {
      const plaintext = decryptString(
        {
          ciphertext: row.encryptedPayload,
          iv: row.payloadIv,
          tag: row.payloadTag,
        },
        vaultKey,
        vaultId,
      );

      const parsed = JSON.parse(plaintext);
      decryptedList.push({
        id: row.id,
        vaultId: row.vaultId,
        title: parsed.title,
        content: parsed.content,
        weight: row.weight,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    } catch (err) {
      console.error(`Failed to decrypt ticket ${row.id}:`, err);
    }
  }

  return decryptedList;
}

/**
 * Updates a ticket's encrypted payload and weight.
 */
export async function updateTicket(
  ticketId: string,
  vaultId: string,
  payload: TicketPayload,
  vaultKey: Buffer,
): Promise<void> {
  const db = await getDatabase();

  const serialized = JSON.stringify({
    title: payload.title.trim(),
    content: payload.content?.trim() ?? '',
  });

  const encrypted = encryptString(serialized, vaultKey, vaultId);

  await db
    .update(resources)
    .set({
      weight: payload.weight ?? 1,
      encryptedPayload: encrypted.ciphertext,
      payloadIv: encrypted.iv,
      payloadTag: encrypted.tag,
      updatedAt: new Date(),
    })
    .where(eq(resources.id, ticketId));
}

/**
 * Deletes a ticket record from the database.
 */
export async function deleteTicket(ticketId: string): Promise<void> {
  const db = await getDatabase();
  await db.delete(resources).where(eq(resources.id, ticketId));
}
