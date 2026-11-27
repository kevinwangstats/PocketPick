import {
  queryLlm,
  queryLlmConversation,
  buildSystemInstructions,
} from '../../src/services/llm/llmClient';
import * as llmKeyStore from '../../src/services/llm/llmKeyStore';
import * as quotaManager from '../../src/services/quota/quotaManager';
import * as SecureStore from 'expo-secure-store';

describe('LLM Client (OpenRouter.ai Unified Gateway & Grok Default)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore as unknown as { _reset?: () => void })._reset?.();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('uses x-ai/grok-4.7 as the default OpenRouter model', async () => {
    expect(llmKeyStore.DEFAULT_OPENROUTER_MODEL).toBe('x-ai/grok-4.7');
    const model = await llmKeyStore.getOpenRouterModel();
    expect(model).toBe('x-ai/grok-4.7');
  });

  it('builds system instructions with master directives having highest priority', () => {
    const instructions = buildSystemInstructions(
      'Speak like a Parisian atelier stylist.',
      'Be warm and teasing.',
    );
    expect(instructions).toContain('=== VAULT MASTER DIRECTIVES (HIGHEST PRIORITY) ===');
    expect(instructions).toContain('Speak like a Parisian atelier stylist.');
    expect(instructions).toContain('Be warm and teasing.');
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

  it('queries OpenRouter with Grok 4.7 default model and standard headers', async () => {
    jest.spyOn(llmKeyStore, 'getOpenRouterApiKey').mockResolvedValueOnce('sk-or-v1-testkey1234');
    jest.spyOn(llmKeyStore, 'getOpenRouterModel').mockResolvedValueOnce('x-ai/grok-4.7');

    const quotaSpy = jest.spyOn(quotaManager, 'incrementAndEnforceQuota').mockResolvedValueOnce(12);

    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Grok 4.7 Output via OpenRouter' } }],
      }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const response = await queryLlm({
      userPrompt: 'Suggest tags for this silk slip',
      contextText: 'Color: Champagne',
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
        body: expect.stringContaining('"model":"x-ai/grok-4.7"'),
      }),
    );
    expect(response.content).toBe('Grok 4.7 Output via OpenRouter');
    expect(response.provider).toBe('openrouter');
    expect(response.model).toBe('x-ai/grok-4.7');
    expect(response.quotaUsed).toBe(12);
  });

  it('allows dynamic model override between Grok 4.7 and Gemini 3.8 Flash', async () => {
    jest.spyOn(llmKeyStore, 'getOpenRouterApiKey').mockResolvedValueOnce('sk-or-v1-testkey1234');
    jest.spyOn(quotaManager, 'incrementAndEnforceQuota').mockResolvedValueOnce(13);

    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Gemini 3.8 Flash Output' } }],
      }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const response = await queryLlm({
      userPrompt: 'Quick vision check',
      model: 'google/gemini-3.8-flash',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"google/gemini-3.8-flash"'),
      }),
    );
    expect(response.content).toBe('Gemini 3.8 Flash Output');
    expect(response.model).toBe('google/gemini-3.8-flash');
  });

  it('rejects disallowed models when setting openrouter model', async () => {
    await expect(llmKeyStore.setOpenRouterModel('unsupported/model')).rejects.toThrow(
      'Model "unsupported/model" is not allowed. Only Grok 4.7 and Gemini 3.8 Flash are enabled.',
    );
  });

  it('supports multi-turn multimodal conversations via queryLlmConversation', async () => {
    jest.spyOn(llmKeyStore, 'getOpenRouterApiKey').mockResolvedValueOnce('sk-or-v1-testkey1234');
    jest.spyOn(llmKeyStore, 'getOpenRouterModel').mockResolvedValueOnce('x-ai/grok-4.7');
    jest.spyOn(quotaManager, 'incrementAndEnforceQuota').mockResolvedValueOnce(14);

    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'That lace edge looks divine on you.' } }],
      }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const response = await queryLlmConversation({
      masterPrompt: 'You are Celeste, a warm Parisian stylist.',
      turns: [
        { role: 'user', text: 'Should I wear emerald tonight?' },
        { role: 'assistant', text: 'Always emerald—especially silk.' },
        {
          role: 'user',
          text: 'How about this one?',
          imageBase64: '9j4AAQSkZJRgABAQ',
        },
      ],
    });

    const capturedBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      model: string;
      messages: Array<{ role: string; content: unknown }>;
    };

    expect(response.content).toBe('That lace edge looks divine on you.');
    expect(capturedBody.model).toBe('x-ai/grok-4.7');
    expect(capturedBody.messages).toHaveLength(4);
    expect(capturedBody.messages[0].role).toBe('system');
    expect(capturedBody.messages[0].content).toContain('You are Celeste, a warm Parisian stylist.');
    expect(capturedBody.messages[1]).toEqual({
      role: 'user',
      content: 'Should I wear emerald tonight?',
    });
    expect(capturedBody.messages[2]).toEqual({
      role: 'assistant',
      content: 'Always emerald—especially silk.',
    });
    expect(capturedBody.messages[3]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'How about this one?' },
        {
          type: 'image_url',
          image_url: { url: 'data:image/jpeg;base64,9j4AAQSkZJRgABAQ' },
        },
      ],
    });
  });

  it('rejects empty conversation turn arrays', async () => {
    await expect(queryLlmConversation({ turns: [] })).rejects.toThrow(
      'Conversation request requires at least one turn.',
    );
  });

  it('sends multimodal image payload with OpenAI image_url format', async () => {
    jest.spyOn(llmKeyStore, 'getOpenRouterApiKey').mockResolvedValueOnce('sk-or-v1-testkey1234');
    jest.spyOn(quotaManager, 'incrementAndEnforceQuota').mockResolvedValueOnce(15);

    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Multimodal Vision Output' } }],
      }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await queryLlm({
      userPrompt: 'Analyze this photo',
      imageBase64: 'data:image/jpeg;base64,9j4AAQSkZJRgABAQ',
    });

    const parsedBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      messages: Array<{ role: string; content: unknown }>;
    };
    const userMessage = parsedBody.messages.find((m) => m.role === 'user');
    expect(Array.isArray(userMessage?.content)).toBe(true);
    expect(userMessage?.content).toEqual([
      { type: 'text', text: 'Analyze this photo' },
      {
        type: 'image_url',
        image_url: { url: 'data:image/jpeg;base64,9j4AAQSkZJRgABAQ' },
      },
    ]);
  });

  it('handles OpenRouter API errors gracefully', async () => {
    jest.spyOn(llmKeyStore, 'getOpenRouterApiKey').mockResolvedValueOnce('sk-or-v1-invalid');
    jest.spyOn(quotaManager, 'incrementAndEnforceQuota').mockResolvedValueOnce(16);

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

    await llmKeyStore.setOpenRouterModel('google/gemini-3.8-flash');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'POCKETPICK_OPENROUTER_MODEL',
      'google/gemini-3.8-flash',
    );
  });

  it('masks OpenRouter API key safely', () => {
    expect(llmKeyStore.maskApiKey('sk-or-v1-1234567890abcdef')).toBe('sk-or...••••cdef');
    expect(llmKeyStore.maskApiKey('short')).toBe('••••••••');
    expect(llmKeyStore.maskApiKey('')).toBe('');
  });
});
