import { getOpenRouterApiKey, getOpenRouterModel, DEFAULT_OPENROUTER_MODEL } from './llmKeyStore';
import { incrementAndEnforceQuota } from '../quota/quotaManager';

export interface LlmAnalysisRequest {
  systemPrompt?: string;
  userPrompt: string;
  contextText?: string;
  imageBase64?: string;
  masterPrompt?: string;
  model?: string;
}

export interface LlmAnalysisResponse {
  content: string;
  provider: 'openrouter';
  model: string;
  quotaUsed: number;
}

/**
 * Builds authoritative system instructions by placing the Vault Master Prompt
 * at the highest priority level in the system prompt hierarchy.
 */
export function buildSystemInstructions(masterPrompt?: string, systemPrompt?: string): string {
  const sections: string[] = [];

  if (masterPrompt && masterPrompt.trim().length > 0) {
    sections.push(
      `=== VAULT MASTER DIRECTIVES (HIGHEST PRIORITY) ===\n` +
        `The user has configured the following permanent directives for all operations inside this vault.\n` +
        `You MUST strictly adhere to these instructions, styling, format constraints, and domain requirements above any default response pattern:\n\n` +
        `"""\n${masterPrompt.trim()}\n"""\n` +
        `=================================================`,
    );
  }

  if (systemPrompt && systemPrompt.trim().length > 0) {
    sections.push(systemPrompt.trim());
  } else if (!masterPrompt || masterPrompt.trim().length === 0) {
    sections.push(
      'You are an AI assistant inside PocketPick, a high-security encrypted mobile vault application. Provide clear, accurate, and structured responses.',
    );
  }

  return sections.join('\n\n');
}

/**
 * Sends a query to the configured model via the unified OpenRouter.ai API gateway.
 * Allows using any model (e.g. Gemini 2.5 Flash, DeepSeek V3/R1, Kimi K2.6) with a single API key.
 * Strictly enforces monthly quota guard before sending network requests.
 * Injects vault-level master prompts into the authoritative system instruction.
 */
export async function queryLlm(request: LlmAnalysisRequest): Promise<LlmAnalysisResponse> {
  const apiKey = await getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error(
      'No OpenRouter API key configured. Please add an OpenRouter API key in Settings.',
    );
  }

  const modelToUse = request.model ?? (await getOpenRouterModel()) ?? DEFAULT_OPENROUTER_MODEL;

  // Enforce monthly quota barrier FIRST. Throws QuotaExceededError if limit reached.
  const quotaUsed = await incrementAndEnforceQuota();

  let userText = request.userPrompt;
  if (request.contextText && request.contextText.trim().length > 0) {
    userText = `${userText}\n\n---\n${request.contextText.trim()}`;
  }

  // Construct message content (text or multimodal OpenAI-compatible image_url)
  type MessageContent =
    | string
    | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

  let userMessageContent: MessageContent = userText;
  if (request.imageBase64) {
    const imageUrl = request.imageBase64.startsWith('data:')
      ? request.imageBase64
      : `data:image/jpeg;base64,${request.imageBase64}`;

    userMessageContent = [
      { type: 'text', text: userText },
      {
        type: 'image_url',
        image_url: {
          url: imageUrl,
        },
      },
    ];
  }

  const systemInstruction = buildSystemInstructions(request.masterPrompt, request.systemPrompt);

  const messages: Array<{ role: 'system' | 'user'; content: MessageContent }> = [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: userMessageContent },
  ];

  // 30-second timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://pocketpick.app',
        'X-Title': 'PocketPick',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`OpenRouter API error (${res.status}): ${errorBody}`);
    }

    const data = await res.json();
    const resultText = data.choices?.[0]?.message?.content ?? '';

    return {
      content: resultText.trim(),
      provider: 'openrouter',
      model: modelToUse,
      quotaUsed,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
