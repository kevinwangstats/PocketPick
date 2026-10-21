import { queryLlm } from '../../src/services/llm/llmClient';
import * as llmKeyStore from '../../src/services/llm/llmKeyStore';
import * as quotaManager from '../../src/services/quota/quotaManager';
import * as SecureStore from 'expo-secure-store';

describe('LLM Client (Gemini, DeepSeek, & Kimi with Quota Guard)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws an error if no API key is set for active provider', async () => {
    jest.spyOn(llmKeyStore, 'getLlmProvider').mockResolvedValueOnce('gemini');
    jest.spyOn(llmKeyStore, 'getLlmApiKey').mockResolvedValueOnce(null);

    await expect(
      queryLlm({
        userPrompt: 'Test prompt',
        contextText: 'Test context',
      }),
    ).rejects.toThrow('No LLM API key configured for GEMINI');
  });

  it('queries Kimi with default kimi-k2.6 model', async () => {
    jest.spyOn(llmKeyStore, 'getLlmProvider').mockResolvedValueOnce('kimi');
    jest.spyOn(llmKeyStore, 'getLlmApiKey').mockResolvedValueOnce('sk-kimi-token');

    const quotaSpy = jest.spyOn(quotaManager, 'incrementAndEnforceQuota').mockResolvedValueOnce(15);

    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Kimi K2.6 Analysis Output' } }],
      }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const response = await queryLlm({
      userPrompt: 'Summarize photo receipt',
      contextText: 'Receipt details: $42',
    });

    expect(quotaSpy).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.moonshot.cn/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer sk-kimi-token',
        },
        body: expect.stringContaining('"model":"kimi-k2.6"'),
      }),
    );
    expect(response.content).toBe('Kimi K2.6 Analysis Output');
    expect(response.provider).toBe('kimi');
    expect(response.model).toBe('kimi-k2.6');
    expect(response.quotaUsed).toBe(15);
  });

  it('enforces monthly quota and queries DeepSeek with deepseek-v4-flash', async () => {
    jest.spyOn(llmKeyStore, 'getLlmProvider').mockResolvedValueOnce('deepseek');
    jest.spyOn(llmKeyStore, 'getLlmApiKey').mockResolvedValueOnce('sk-deepseek-1234');

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
    jest.spyOn(llmKeyStore, 'getLlmProvider').mockResolvedValueOnce('gemini');
    jest.spyOn(llmKeyStore, 'getLlmApiKey').mockResolvedValueOnce('gemini-key-5678');

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

  it('stores and isolates separate keys per provider in SecureStore', async () => {
    await llmKeyStore.setLlmApiKey('gemini-key', 'gemini');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'POCKETPICK_LLM_API_KEY_gemini',
      'gemini-key',
      expect.anything(),
    );

    await llmKeyStore.setLlmApiKey('deepseek-key', 'deepseek');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'POCKETPICK_LLM_API_KEY_deepseek',
      'deepseek-key',
      expect.anything(),
    );

    await llmKeyStore.setLlmApiKey('kimi-key', 'kimi');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'POCKETPICK_LLM_API_KEY_kimi',
      'kimi-key',
      expect.anything(),
    );
  });
});
