import { queryLlm } from '../../src/services/llm/llmClient';
import * as llmKeyStore from '../../src/services/llm/llmKeyStore';
import * as quotaManager from '../../src/services/quota/quotaManager';

describe('LLM Client (Gemini & DeepSeek with Quota Guard)', () => {
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

  it('enforces monthly quota and queries DeepSeek with deepseek-v4-flash', async () => {
    jest.spyOn(llmKeyStore, 'getLlmApiKey').mockResolvedValueOnce('sk-deepseek-1234');
    jest.spyOn(llmKeyStore, 'getLlmProvider').mockResolvedValueOnce('deepseek');

    const quotaSpy = jest.spyOn(quotaManager, 'incrementAndEnforceQuota').mockResolvedValueOnce(42);

    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'DeepSeek V4 Analysis Output' } }],
      }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const response = await queryLlm({
      userPrompt: 'Summarize',
      contextText: 'PocketPick is a secure vault app.',
    });

    expect(quotaSpy).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(response.content).toBe('DeepSeek V4 Analysis Output');
    expect(response.provider).toBe('deepseek');
    expect(response.model).toBe('deepseek-v4-flash');
    expect(response.quotaUsed).toBe(42);
  });

  it('queries Gemini with gemini-3.8-flash', async () => {
    jest.spyOn(llmKeyStore, 'getLlmApiKey').mockResolvedValueOnce('gemini-key-5678');
    jest.spyOn(llmKeyStore, 'getLlmProvider').mockResolvedValueOnce('gemini');

    jest.spyOn(quotaManager, 'incrementAndEnforceQuota').mockResolvedValueOnce(43);

    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Gemini 3.8 Flash Output' }] } }],
      }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const response = await queryLlm({
      userPrompt: 'Extract',
      contextText: 'Data payload',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(response.content).toBe('Gemini 3.8 Flash Output');
    expect(response.provider).toBe('gemini');
    expect(response.model).toBe('gemini-3.8-flash');
  });
});
