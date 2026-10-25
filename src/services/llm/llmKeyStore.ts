import * as SecureStore from 'expo-secure-store';

export const OPENROUTER_API_KEY_STORAGE_KEY = 'POCKETPICK_OPENROUTER_API_KEY';
export const OPENROUTER_MODEL_STORAGE_KEY = 'POCKETPICK_OPENROUTER_MODEL';
export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash';

// Legacy keys for migration support
const LEGACY_STORAGE_KEYS = [
  'POCKETPICK_LLM_API_KEY',
  'POCKETPICK_LLM_API_KEY_gemini',
  'POCKETPICK_LLM_API_KEY_deepseek',
  'POCKETPICK_LLM_API_KEY_kimi',
];

export interface ModelPreset {
  id: string;
  label: string;
  providerLabel: string;
  description: string;
  multimodal: boolean;
}

export const OPENROUTER_MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'google/gemini-2.5-flash',
    label: 'GEMINI 2.5 FLASH',
    providerLabel: 'Google',
    description: 'Fast, multimodal vision & long-context',
    multimodal: true,
  },
  {
    id: 'deepseek/deepseek-chat',
    label: 'DEEPSEEK V3',
    providerLabel: 'DeepSeek',
    description: 'Top-tier general reasoning & coding',
    multimodal: false,
  },
  {
    id: 'deepseek/deepseek-r1',
    label: 'DEEPSEEK R1',
    providerLabel: 'DeepSeek',
    description: 'Advanced chain-of-thought reasoning',
    multimodal: false,
  },
  {
    id: 'moonshotai/kimi-k2.6',
    label: 'KIMI K2.6',
    providerLabel: 'Moonshot AI',
    description: 'Long-context multimodal reasoning',
    multimodal: true,
  },
];

/**
 * Retrieves the stored OpenRouter API key from iOS Keychain.
 */
export async function getOpenRouterApiKey(): Promise<string | null> {
  const key = await SecureStore.getItemAsync(OPENROUTER_API_KEY_STORAGE_KEY, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });

  if (key) {
    return key;
  }

  // Fallback to legacy single key if previously saved
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    const fallback = await SecureStore.getItemAsync(legacyKey, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    if (fallback) return fallback;
  }

  // Fallback to bundled environment variable for local development
  if (process.env.EXPO_PUBLIC_OPENROUTER_API_KEY) {
    return process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
  }

  return null;
}

/**
 * Persists the OpenRouter API key in iOS Keychain.
 */
export async function setOpenRouterApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new Error('API key cannot be empty');
  }
  await SecureStore.setItemAsync(OPENROUTER_API_KEY_STORAGE_KEY, trimmed, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

/**
 * Deletes the stored OpenRouter API key from iOS Keychain.
 */
export async function removeOpenRouterApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(OPENROUTER_API_KEY_STORAGE_KEY);
  for (const legacy of LEGACY_STORAGE_KEYS) {
    await SecureStore.deleteItemAsync(legacy).catch(() => {});
  }
}

/**
 * Checks if an OpenRouter API key is configured.
 */
export async function isOpenRouterKeyConfigured(): Promise<boolean> {
  const key = await getOpenRouterApiKey();
  return Boolean(key && key.length > 0);
}

/**
 * Retrieves the configured OpenRouter model (default: google/gemini-2.5-flash).
 */
export async function getOpenRouterModel(): Promise<string> {
  const model = await SecureStore.getItemAsync(OPENROUTER_MODEL_STORAGE_KEY);
  if (model && model.trim().length > 0) {
    return model.trim();
  }
  return DEFAULT_OPENROUTER_MODEL;
}

/**
 * Saves the selected OpenRouter model ID.
 */
export async function setOpenRouterModel(model: string): Promise<void> {
  const trimmed = model.trim();
  if (!trimmed) {
    throw new Error('Model identifier cannot be empty');
  }
  await SecureStore.setItemAsync(OPENROUTER_MODEL_STORAGE_KEY, trimmed);
}

/**
 * Masks an API key for safe UI presentation (e.g. sk-or-...••••1234).
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  const prefix = key.slice(0, 5);
  const suffix = key.slice(-4);
  return `${prefix}...••••${suffix}`;
}

// Backward compatibility adapters
export type LlmProvider = 'openrouter';

export const DEFAULT_LLM_MODELS: Record<string, string> = {
  openrouter: DEFAULT_OPENROUTER_MODEL,
};

export async function getLlmApiKey(): Promise<string | null> {
  return getOpenRouterApiKey();
}

export async function setLlmApiKey(key: string): Promise<void> {
  return setOpenRouterApiKey(key);
}

export async function removeLlmApiKey(): Promise<void> {
  return removeOpenRouterApiKey();
}

export async function getLlmProvider(): Promise<string> {
  return 'openrouter';
}
