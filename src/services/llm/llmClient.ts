import { getLlmApiKey, getLlmProvider, LlmProvider, DEFAULT_LLM_MODELS } from './llmKeyStore';
import { incrementAndEnforceQuota } from '../quota/quotaManager';

export interface LlmAnalysisRequest {
  systemPrompt?: string;
  userPrompt: string;
  contextText: string;
  masterPrompt?: string;
  model?: string;
}

export interface LlmAnalysisResponse {
  content: string;
  provider: LlmProvider;
  model: string;
  quotaUsed: number;
}

/**
 * Sends a query to the configured LLM provider (gemini, deepseek, or kimi).
 * Defaults to:
 * - Gemini: gemini-3.8-flash
 * - DeepSeek: deepseek-v4-flash
 * - Kimi: kimi-k2.6
 * Strictly enforces monthly quota guard before sending network request.
 * Appends the vault-level master prompt whenever present.
 */
export async function queryLlm(request: LlmAnalysisRequest): Promise<LlmAnalysisResponse> {
  const provider = await getLlmProvider();
  const apiKey = await getLlmApiKey(provider);
  if (!apiKey) {
    throw new Error(
      `No LLM API key configured for ${provider.toUpperCase()}. Please add an API key in Settings.`,
    );
  }

  const modelToUse = request.model ?? DEFAULT_LLM_MODELS[provider];

  // Enforce monthly quota barrier FIRST. Throws QuotaExceededError if limit reached.
  const quotaUsed = await incrementAndEnforceQuota();

  let fullPrompt = `${request.userPrompt}

---
${request.contextText}`;
  if (request.masterPrompt && request.masterPrompt.trim().length > 0) {
    fullPrompt = `${fullPrompt}

[Vault Master Prompt]:
${request.masterPrompt.trim()}`;
  }

  // 15-second timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    let resultText = '';

    if (provider === 'kimi') {
      // Moonshot operates dual endpoints: api.moonshot.ai (global/open platform) and api.moonshot.cn (domestic CN).
      // Query api.moonshot.ai first, falling back to api.moonshot.cn if 401 authentication failure occurs.
      const endpoints = [
        'https://api.moonshot.ai/v1/chat/completions',
        'https://api.moonshot.cn/v1/chat/completions',
      ];

      let lastError: Error | null = null;
      let succeeded = false;

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: modelToUse,
              messages: [
                ...(request.systemPrompt
                  ? [{ role: 'system', content: request.systemPrompt }]
                  : []),
                { role: 'user', content: fullPrompt },
              ],
              temperature: 0.2,
            }),
            signal: controller.signal,
          });

          if (res.ok) {
            const data = await res.json();
            resultText = data.choices?.[0]?.message?.content ?? '';
            succeeded = true;
            break;
          }

          const errorBody = await res.text();
          lastError = new Error(`Kimi API error (${res.status}): ${errorBody}`);

          // If error is not 401 authentication, or this is the last endpoint, fail fast
          if (res.status !== 401) {
            throw lastError;
          }
        } catch (err) {
          lastError = err as Error;
          if (controller.signal.aborted) {
            throw err;
          }
        }
      }

      if (!succeeded) {
        throw lastError ?? new Error('Kimi API request failed on all Moonshot endpoints');
      }
    } else if (provider === 'deepseek') {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
            { role: 'user', content: fullPrompt },
          ],
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`DeepSeek API error (${res.status}): ${errorBody}`);
      }

      const data = await res.json();
      resultText = data.choices?.[0]?.message?.content ?? '';
    } else if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            ...(request.systemPrompt
              ? { system_instruction: { parts: [{ text: request.systemPrompt }] } }
              : {}),
          }),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errorBody}`);
      }

      const data = await res.json();
      resultText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }

    return {
      content: resultText.trim(),
      provider,
      model: modelToUse,
      quotaUsed,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
