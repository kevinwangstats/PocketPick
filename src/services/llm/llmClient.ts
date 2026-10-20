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
 * Sends a query to the configured LLM provider (gemini or deepseek).
 * Defaults to:
 * - Gemini: gemini-3.8-flash
 * - DeepSeek: deepseek-v4-flash
 * Strictly enforces monthly quota guard before sending network request.
 * Appends the vault-level master prompt whenever present.
 */
export async function queryLlm(request: LlmAnalysisRequest): Promise<LlmAnalysisResponse> {
  const apiKey = await getLlmApiKey();
  if (!apiKey) {
    throw new Error('No LLM API key configured. Please add an API key in Settings.');
  }

  const provider = await getLlmProvider();
  const modelToUse = request.model ?? DEFAULT_LLM_MODELS[provider];

  // Enforce monthly quota barrier FIRST. Throws QuotaExceededError if limit reached.
  const quotaUsed = await incrementAndEnforceQuota();

  let fullPrompt = `${request.userPrompt}\n\n---\n${request.contextText}`;
  if (request.masterPrompt && request.masterPrompt.trim().length > 0) {
    fullPrompt = `${fullPrompt}\n\n[Vault Master Prompt]:\n${request.masterPrompt.trim()}`;
  }

  // 15-second timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    let resultText = '';

    if (provider === 'deepseek') {
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
