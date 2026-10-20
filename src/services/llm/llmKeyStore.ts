import * as SecureStore from 'expo-secure-store';

export type LlmProvider = 'gemini' | 'deepseek';

export const DEFAULT_LLM_MODELS: Record<LlmProvider, string> = {
  gemini: 'gemini-3.8-flash',
  deepseek: 'deepseek-v4-flash',
};

const API_KEY_STORAGE_KEY = 'POCKETPICK_LLM_API_KEY';
const PROVIDER_STORAGE_KEY = 'POCKETPICK_LLM_PROVIDER';

/**
 * Retrieves the stored LLM API key from iOS Keychain.
 */
export async function getLlmApiKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(API_KEY_STORAGE_KEY, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

/**
 * Persists the LLM API key in iOS Keychain.
 */
export async function setLlmApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new Error('API key cannot be empty');
  }
  await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, trimmed, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

/**
 * Deletes the stored LLM API key from iOS Keychain.
 */
export async function removeLlmApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
}

/**
 * Retrieves the configured LLM provider (default: gemini).
 */
export async function getLlmProvider(): Promise<LlmProvider> {
  const provider = await SecureStore.getItemAsync(PROVIDER_STORAGE_KEY);
  if (provider === 'gemini' || provider === 'deepseek') {
    return provider;
  }
  return 'gemini';
}

/**
 * Saves the selected LLM provider.
 */
export async function setLlmProvider(provider: LlmProvider): Promise<void> {
  await SecureStore.setItemAsync(PROVIDER_STORAGE_KEY, provider);
}

/**
 * Masks an API key for safe UI presentation (e.g. sk-...••••1234).
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  const prefix = key.slice(0, 4);
  const suffix = key.slice(-4);
  return `${prefix}...••••${suffix}`;
}
