import { queryLlm } from '../../src/services/llm/llmClient';
import * as llmKeyStore from '../../src/services/llm/llmKeyStore';
import * as quotaManager from '../../src/services/quota/quotaManager';

describe('LLM Client (Multi-Provider & Quota Guard)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws an error if no API key is set', async () => {
    jest.spyOn(llmKeyStore, 'getLlmApiKey').mockResolvedValueOnce(null);

    await expect(
      queryLlm({
        userPrompt: 'Test prompt',
        contextText: 'Test context',
      }),
    ).rejects.toThrow('No LLM API key configured');
  });

  it('enforces monthly quota before making outgoing network call', async () => {
    jest.spyOn(llmKeyStore, 'getLlmApiKey').mockResolvedValueOnce('sk-test-key-1234');
    jest.spyOn(llmKeyStore, 'getLlmProvider').mockResolvedValueOnce('openai');

    const quotaSpy = jest.spyOn(quotaManager, 'incrementAndEnforceQuota').mockResolvedValueOnce(42);

    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Mocked LLM Analysis Output' } }],
      }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const response = await queryLlm({
      userPrompt: 'Summarize',
      contextText: 'PocketPick is a secure vault app.',
    });

    expect(quotaSpy).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(response.content).toBe('Mocked LLM Analysis Output');
    expect(response.provider).toBe('openai');
    expect(response.quotaUsed).toBe(42);
  });
});
