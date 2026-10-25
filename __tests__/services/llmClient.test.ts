import { queryLlm, buildSystemInstructions } from '../../src/services/llm/llmClient';
import * as llmKeyStore from '../../src/services/llm/llmKeyStore';
import * as quotaManager from '../../src/services/quota/quotaManager';
import * as SecureStore from 'expo-secure-store';

describe('LLM Client (OpenRouter.ai Unified Gateway & Authoritative Master Prompt)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('builds system instructions with vault master directives having highest priority', () => {
    const instructions = buildSystemInstructions(
      'Format in uppercase JSON only.',
      'You are a receipt extractor.',
    );
    expect(instructions).toContain('=== VAULT MASTER DIRECTIVES (HIGHEST PRIORITY) ===');
    expect(instructions).toContain('Format in uppercase JSON only.');
    expect(instructions).toContain('You are a receipt extractor.');
  });

  it('throws an error if no OpenRouter API key is configured', async () => {
    jest.spyOn(llmKeyStore, 'getOpenRouterApiKey').mockResolvedValueOnce(null);

    await expect(
      queryLlm({
        userPrompt: 'Test prompt',
        contextText: 'Test context',
      }),
    ).rejects.toThrow('No OpenRouter API key configured');
  });

  it('queries OpenRouter with default model and standard headers', async () => {
    jest.spyOn(llmKeyStore, 'getOpenRouterApiKey').mockResolvedValueOnce('sk-or-v1-testkey1234');
    jest.spyOn(llmKeyStore, 'getOpenRouterModel').mockResolvedValueOnce('google/gemini-2.5-flash');

    const quotaSpy = jest.spyOn(quotaManager, 'incrementAndEnforceQuota').mockResolvedValueOnce(12);

    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Gemini 2.5 Flash Output via OpenRouter' } }],
      }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const response = await queryLlm({
      userPrompt: 'Summarize photo receipt',
      contextText: 'Receipt details: $42',
    });

    expect(quotaSpy).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer sk-or-v1-testkey1234',
          'HTTP-Referer': 'https://pocketpick.app',
          'X-Title': 'PocketPick',
        },
        body: expect.stringContaining('"model":"google/gemini-2.5-flash"'),
      }),
    );
    expect(response.content).toBe('Gemini 2.5 Flash Output via OpenRouter');
    expect(response.provider).toBe('openrouter');
    expect(response.model).toBe('google/gemini-2.5-flash');
    expect(response.quotaUsed).toBe(12);
  });

  it('allows dynamic model override (e.g. DeepSeek V3 / R1 / Kimi)', async () => {
    jest.spyOn(llmKeyStore, 'getOpenRouterApiKey').mockResolvedValueOnce('sk-or-v1-testkey1234');

    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'DeepSeek R1 Reasoning Output' } }],
      }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const response = await queryLlm({
      userPrompt: 'Complex math proof',
      model: 'deepseek/deepseek-r1',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"deepseek/deepseek-r1"'),
      }),
    );
    expect(response.content).toBe('DeepSeek R1 Reasoning Output');
    expect(response.model).toBe('deepseek/deepseek-r1');
  });

  it('injects vault master prompt as authoritative system directive', async () => {
    jest.spyOn(llmKeyStore, 'getOpenRouterApiKey').mockResolvedValueOnce('sk-or-v1-testkey1234');

    let parsedBody: any = null;
    const mockFetch = jest.fn().mockImplementation((_url, opts) => {
      parsedBody = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Formatted Output' } }],
        }),
      });
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await queryLlm({
      userPrompt: 'Extract date and amount',
      masterPrompt: 'Output in JSON format with merchant, date, total.',
    });

    expect(parsedBody).toBeDefined();
    const systemMessage = parsedBody.messages.find((m: any) => m.role === 'system');
    expect(systemMessage).toBeDefined();
    expect(systemMessage.content).toContain('=== VAULT MASTER DIRECTIVES (HIGHEST PRIORITY) ===');
    expect(systemMessage.content).toContain('Output in JSON format with merchant, date, total.');
  });

  it('sends multimodal image payload with OpenAI image_url format', async () => {
    jest.spyOn(llmKeyStore, 'getOpenRouterApiKey').mockResolvedValueOnce('sk-or-v1-testkey1234');

    let parsedBody: any = null;
    const mockFetch = jest.fn().mockImplementation((_url, opts) => {
      parsedBody = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Multimodal Vision Output' } }],
        }),
      });
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await queryLlm({
      userPrompt: 'Analyze this photo',
      imageBase64: 'data:image/jpeg;base64,9j4AAQSkZJRgABAQ',
    });

    expect(parsedBody).toBeDefined();
    const userMessage = parsedBody.messages.find((m: any) => m.role === 'user');
    expect(Array.isArray(userMessage.content)).toBe(true);
    expect(userMessage.content[0]).toEqual({ type: 'text', text: 'Analyze this photo' });
    expect(userMessage.content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,9j4AAQSkZJRgABAQ' },
    });
  });

  it('handles OpenRouter API errors gracefully', async () => {
    jest.spyOn(llmKeyStore, 'getOpenRouterApiKey').mockResolvedValueOnce('sk-or-v1-invalid');

    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized: Invalid API key',
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(
      queryLlm({
        userPrompt: 'Hello',
      }),
    ).rejects.toThrow('OpenRouter API error (401): Unauthorized: Invalid API key');
  });

  it('stores and retrieves OpenRouter key and model in SecureStore', async () => {
    await llmKeyStore.setOpenRouterApiKey('sk-or-v1-secret-key');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'POCKETPICK_OPENROUTER_API_KEY',
      'sk-or-v1-secret-key',
      expect.anything(),
    );

    await llmKeyStore.setOpenRouterModel('deepseek/deepseek-chat');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'POCKETPICK_OPENROUTER_MODEL',
      'deepseek/deepseek-chat',
    );
  });

  it('masks OpenRouter API key safely', () => {
    expect(llmKeyStore.maskApiKey('sk-or-v1-1234567890abcdef')).toBe('sk-or...••••cdef');
    expect(llmKeyStore.maskApiKey('short')).toBe('••••••••');
    expect(llmKeyStore.maskApiKey('')).toBe('');
  });
});
