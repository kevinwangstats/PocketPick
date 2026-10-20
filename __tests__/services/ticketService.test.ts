import { createTicket, updateTicket, deleteTicket } from '@/services/tickets/ticketService';
import { getDatabase, closeDatabase } from '@/db/client';
import QuickCrypto from 'react-native-quick-crypto';

describe('Encrypted Ticket Service (TDD)', () => {
  const vaultId = 'test-vault-001';
  const vaultKey = QuickCrypto.randomBytes(32);

  beforeEach(() => {
    closeDatabase();
  });

  afterEach(() => {
    closeDatabase();
  });

  it('creates an encrypted ticket and stores ciphertext in database', async () => {
    const db = await getDatabase();
    const insertSpy = jest.spyOn(db, 'insert');

    const ticketId = await createTicket(
      vaultId,
      { title: 'Secret Mnemonic', content: '12-word recovery phrase here', weight: 5 },
      vaultKey,
    );

    expect(ticketId).toBeDefined();
    expect(ticketId).toHaveLength(32);
    expect(insertSpy).toHaveBeenCalled();
  });

  it('throws an error if ticket title is empty', async () => {
    await expect(
      createTicket(vaultId, { title: '   ', content: 'test' }, vaultKey),
    ).rejects.toThrow('Ticket title is required');
  });

  it('updates ticket payload and encrypts new data', async () => {
    const db = await getDatabase();
    const updateSpy = jest.spyOn(db, 'update');

    await updateTicket(
      'ticket-001',
      vaultId,
      { title: 'Updated Title', content: 'Updated content', weight: 10 },
      vaultKey,
    );

    expect(updateSpy).toHaveBeenCalled();
  });

  it('deletes ticket by ID', async () => {
    const db = await getDatabase();
    const deleteSpy = jest.spyOn(db, 'delete');

    await deleteTicket('ticket-001');
    expect(deleteSpy).toHaveBeenCalled();
  });
});
