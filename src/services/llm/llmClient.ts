import {
  getOpenRouterApiKey,
  getOpenRouterModel,
  DEFAULT_OPENROUTER_MODEL,
  isAllowedOpenRouterModel,
} from './llmKeyStore';
import { incrementAndEnforceQuota } from '../quota/quotaManager';

export type MessageContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

export interface ConversationTurnInput {
  role: 'user' | 'assistant';
  text: string;
  imageBase64?: string;
}

export interface LlmAnalysisRequest {
  systemPrompt?: string;
  userPrompt: string;
  contextText?: string;
  imageBase64?: string;
  masterPrompt?: string;
  model?: string;
  temperature?: number;
}

export interface LlmConversationRequest {
  systemPrompt?: string;
  masterPrompt?: string;
  turns: ConversationTurnInput[];
  model?: string;
  temperature?: number;
}

export interface LlmAnalysisResponse {
  content: string;
  provider: 'openrouter';
  model: string;
  quotaUsed: number;
}

/**
 * Builds authoritative system instructions by placing the Persona / Vault Master Prompt
 * at the highest priority level in the system prompt hierarchy.
 */
export function buildSystemInstructions(masterPrompt?: string, systemPrompt?: string): string {
  const sections: string[] = [];

  if (masterPrompt && masterPrompt.trim().length > 0) {
    sections.push(
      `=== VAULT MASTER DIRECTIVES (HIGHEST PRIORITY) ===\n` +
        `The user has configured the following permanent directives for all operations inside this context.\n` +
        `You MUST strictly adhere to these instructions, persona, styling, format constraints, and tone above any default response pattern:\n\n` +
        `"""\n${masterPrompt.trim()}\n"""\n` +
        `=================================================`,
    );
  }

  if (systemPrompt && systemPrompt.trim().length > 0) {
    sections.push(systemPrompt.trim());
  } else if (!masterPrompt || masterPrompt.trim().length === 0) {
    sections.push(
      'You are an AI stylist and companion inside PocketPick OOTD, a private encrypted mobile wardrobe app. Provide clear, expressive, and attentive responses.',
    );
  }

  return sections.join('\n\n');
}

function formatImageUrl(imageBase64: string): string {
  return imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
}

function buildTurnContent(text: string, imageBase64?: string): MessageContent {
  if (!imageBase64) {
    return text;
  }

  const parts: Array<
    { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
  > = [];

  if (text.trim().length > 0) {
    parts.push({ type: 'text', text });
  } else {
    parts.push({ type: 'text', text: 'Please look at this photo.' });
  }

  parts.push({
    type: 'image_url',
    image_url: { url: formatImageUrl(imageBase64) },
  });

  return parts;
}

async function resolveTargetModel(requestedModel?: string): Promise<string> {
  if (requestedModel && isAllowedOpenRouterModel(requestedModel)) {
    return requestedModel;
  }
  const configuredModel = await getOpenRouterModel();
  return configuredModel || DEFAULT_OPENROUTER_MODEL;
}

async function dispatchOpenRouterRequest(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: MessageContent }>,
  requestedModel?: string,
  temperature = 0.7,
): Promise<LlmAnalysisResponse> {
  const apiKey = await getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error(
      'No OpenRouter API key configured. Please add an OpenRouter API key in Settings.',
    );
  }

  const modelToUse = await resolveTargetModel(requestedModel);

  // Enforce monthly quota barrier FIRST. Throws QuotaExceededError if limit reached.
  const quotaUsed = await incrementAndEnforceQuota();

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
        temperature,
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

/**
 * Sends a single-turn query to the configured model via OpenRouter.ai.
 */
export async function queryLlm(request: LlmAnalysisRequest): Promise<LlmAnalysisResponse> {
  let userText = request.userPrompt;
  if (request.contextText && request.contextText.trim().length > 0) {
    userText = `${userText}\n\n---\n${request.contextText.trim()}`;
  }

  const systemInstruction = buildSystemInstructions(request.masterPrompt, request.systemPrompt);
  const userMessageContent = buildTurnContent(userText, request.imageBase64);

  return dispatchOpenRouterRequest(
    [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userMessageContent },
    ],
    request.model,
    request.temperature ?? 0.7,
  );
}

/**
 * Sends a multi-turn conversation (optionally containing multimodal image turns)
 * to the configured model via OpenRouter.ai.
 */
export async function queryLlmConversation(
  request: LlmConversationRequest,
): Promise<LlmAnalysisResponse> {
  if (!request.turns || request.turns.length === 0) {
    throw new Error('Conversation request requires at least one turn.');
  }

  const systemInstruction = buildSystemInstructions(request.masterPrompt, request.systemPrompt);
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: MessageContent }> = [
    { role: 'system', content: systemInstruction },
    ...request.turns.map((turn) => ({
      role: turn.role,
      content: buildTurnContent(turn.text, turn.imageBase64),
    })),
  ];

  return dispatchOpenRouterRequest(messages, request.model, request.temperature ?? 0.7);
}
