import { getLlmApiKey, getLlmProvider, LlmProvider } from './llmKeyStore';
import { incrementAndEnforceQuota } from '../quota/quotaManager';

export interface LlmAnalysisRequest {
  systemPrompt?: string;
  userPrompt: string;
  contextText: string;
}

export interface LlmAnalysisResponse {
  content: string;
  provider: LlmProvider;
  quotaUsed: number;
}

/**
 * Sends a query to the configured LLM provider.
 * Strictly enforces the 100-request monthly quota guard before sending any network request.
 */
export async function queryLlm(request: LlmAnalysisRequest): Promise<LlmAnalysisResponse> {
  const apiKey = await getLlmApiKey();
  if (!apiKey) {
    throw new Error('No LLM API key configured. Please add an API key in Settings.');
  }

  const provider = await getLlmProvider();

  // Enforce monthly quota barrier FIRST. Throws QuotaExceededError if limit reached.
  const quotaUsed = await incrementAndEnforceQuota();

  const fullPrompt = `${request.userPrompt}\n\n---\n${request.contextText}`;

  // 15-second timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    let resultText = '';

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
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
        throw new Error(`OpenAI API error (${res.status}): ${errorBody}`);
      }

      const data = await res.json();
      resultText = data.choices?.[0]?.message?.content ?? '';
    } else if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1024,
          ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
          messages: [{ role: 'user', content: fullPrompt }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Anthropic API error (${res.status}): ${errorBody}`);
      }

      const data = await res.json();
      resultText = data.content?.[0]?.text ?? '';
    } else if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
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
      quotaUsed,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
