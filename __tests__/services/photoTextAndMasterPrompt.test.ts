import { savePhotoText, getPhotoText } from '@/services/media/photoTextService';
import { getVaultMasterPrompt, updateVaultMasterPrompt } from '@/services/vault/vaultService';
import { queryLlm } from '@/services/llm/llmClient';
import { Resource, vaults } from '@/db/schema';
import QuickCrypto from 'react-native-quick-crypto';
import { getDatabase } from '@/db/client';

jest.mock('@/services/llm/llmKeyStore', () => ({
  getOpenRouterApiKey: jest.fn(async () => 'sk-or-v1-testkey1234'),
  getOpenRouterModel: jest.fn(async () => 'google/gemini-2.5-flash'),
  DEFAULT_OPENROUTER_MODEL: 'google/gemini-2.5-flash',
  getLlmApiKey: jest.fn(async () => 'sk-or-v1-testkey1234'),
  getLlmProvider: jest.fn(async () => 'openrouter'),
}));

describe('Photo Text Association & Vault Master Prompt (TDD)', () => {
  const vaultId = 'test-vault-prompt-123';
  const vaultKey = QuickCrypto.randomBytes(32);
  const resourceId = 'photo-res-001';

  let mockResourceDb: any = {};
  let mockVaultDb: any = {};

  beforeEach(async () => {
    mockResourceDb = {
      id: resourceId,
      vaultId,
      type: 'photo',
      encryptedPayload: null,
      payloadIv: null,
      payloadTag: null,
    };

    mockVaultDb = {
      id: vaultId,
      name: 'Receipts & Archives',
      llmMasterPrompt: 'Always format in uppercase bullets with dates.',
    };

    const db = await getDatabase();

    jest.spyOn(db, 'update').mockImplementation((table: any) => {
      return {
        set: (updateValues: any) => ({
          where: (_clause: any) => {
            if (table === vaults) {
              Object.assign(mockVaultDb, updateValues);
            } else {
              Object.assign(mockResourceDb, updateValues);
            }
            return Promise.resolve();
          },
        }),
      } as any;
    });

    jest.spyOn(db, 'select').mockImplementation((_fields?: any) => {
      return {
        from: (table: any) => ({
          where: (_clause: any) => {
            if (table === vaults) {
              return Promise.resolve([mockVaultDb]);
            }
            return Promise.resolve([mockResourceDb]);
          },
        }),
      } as any;
    });
  });

  describe('Photo Text Association', () => {
    it('encrypts and saves associated text note for a photo', async () => {
      const userText = 'Store receipt for hardware wallet purchase on 2026-10-21';
      await savePhotoText(resourceId, userText, vaultKey, vaultId);

      // Verify that ciphertext is saved and not plaintext
      expect(mockResourceDb.encryptedPayload).toBeDefined();
      expect(mockResourceDb.encryptedPayload).not.toBe(userText);
      expect(mockResourceDb.payloadIv).toBeDefined();
      expect(mockResourceDb.payloadTag).toBeDefined();

      // Verify decryption recovers exact user text
      const decrypted = getPhotoText(mockResourceDb as Resource, vaultKey);
      expect(decrypted).toBe(userText);
    });

    it('clears payload columns when text is empty or trimmed whitespace', async () => {
      await savePhotoText(resourceId, '   ', vaultKey, vaultId);
      expect(mockResourceDb.encryptedPayload).toBeNull();
      expect(mockResourceDb.payloadIv).toBeNull();
      expect(mockResourceDb.payloadTag).toBeNull();
    });

    it('returns null if resource has no encrypted payload', () => {
      const emptyResource: Partial<Resource> = {
        id: 'no-text',
        vaultId,
        type: 'photo',
      };
      expect(getPhotoText(emptyResource as Resource, vaultKey)).toBeNull();
    });
  });

  describe('Vault Master Prompt', () => {
    it('retrieves vault-level LLM master prompt', async () => {
      const prompt = await getVaultMasterPrompt(vaultId);
      expect(prompt).toBe('Always format in uppercase bullets with dates.');
    });

    it('updates vault-level LLM master prompt', async () => {
      const newPrompt = 'Summarize receipts with merchant, date, and total.';
      await updateVaultMasterPrompt(vaultId, newPrompt);
      expect(mockVaultDb.llmMasterPrompt).toBe(newPrompt);
    });
  });

  describe('LLM Client Master Prompt Injection', () => {
    it('injects vault-level master prompt into authoritative system message', async () => {
      const originalFetch = (globalThis as any).fetch;
      let capturedBody: any = null;

      (globalThis as any).fetch = jest.fn().mockImplementation((_url: string, opts: any) => {
        capturedBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: 'Mocked LLM Response' } }],
            }),
        });
      });

      try {
        const masterPrompt = 'Format with strict monochrome tokens.';
        const result = await queryLlm({
          userPrompt: 'Extract receipt totals:',
          contextText: 'Store: TechCorp, Total: $199.00',
          masterPrompt,
        });

        expect(result.content).toBe('Mocked LLM Response');
        expect(capturedBody).toBeDefined();

        // The system message must contain the authoritative vault master directives
        const systemContent = capturedBody.messages.find((m: any) => m.role === 'system')?.content;
        expect(systemContent).toContain('=== VAULT MASTER DIRECTIVES (HIGHEST PRIORITY) ===');
        expect(systemContent).toContain('Format with strict monochrome tokens.');

        // The user message contains the user prompt and context
        const userContent = capturedBody.messages.find((m: any) => m.role === 'user')?.content;
        expect(userContent).toContain('Extract receipt totals:');
        expect(userContent).toContain('Store: TechCorp, Total: $199.00');
      } finally {
        (globalThis as any).fetch = originalFetch;
      }
    });
  });
});
