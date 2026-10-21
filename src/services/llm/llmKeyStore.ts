import * as SecureStore from 'expo-secure-store';

export type LlmProvider = 'gemini' | 'deepseek' | 'kimi';

export const DEFAULT_LLM_MODELS: Record<LlmProvider, string> = {
  gemini: 'gemini-3.8-flash',
  deepseek: 'deepseek-v4-flash',
  kimi: 'kimi-k2.6',
};

const LEGACY_API_KEY_STORAGE_KEY = 'POCKETPICK_LLM_API_KEY';
const PROVIDER_STORAGE_KEY = 'POCKETPICK_LLM_PROVIDER';

function getStorageKeyForProvider(provider: LlmProvider): string {
  return `POCKETPICK_LLM_API_KEY_${provider}`;
}

/**
 * Retrieves the stored LLM API key for a specific provider (or the currently active provider).
 */
export async function getLlmApiKey(provider?: LlmProvider): Promise<string | null> {
  const targetProvider = provider ?? (await getLlmProvider());
  const providerKey = await SecureStore.getItemAsync(getStorageKeyForProvider(targetProvider), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });

  if (providerKey) {
    return providerKey;
  }

  // Fallback to legacy single key if provider is active
  if (!provider) {
    const legacyKey = await SecureStore.getItemAsync(LEGACY_API_KEY_STORAGE_KEY, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    if (legacyKey) return legacyKey;
  }

  // Fallback to bundled environment variables (e.g. MOONSHOT_API_KEY passed from Mac host during dev)
  if (targetProvider === 'kimi' && process.env.EXPO_PUBLIC_MOONSHOT_API_KEY) {
    return process.env.EXPO_PUBLIC_MOONSHOT_API_KEY;
  }

  return null;
}

/**
 * Persists the LLM API key for a specific provider in iOS Keychain.
 */
export async function setLlmApiKey(key: string, provider?: LlmProvider): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new Error('API key cannot be empty');
  }
  const targetProvider = provider ?? (await getLlmProvider());
  await SecureStore.setItemAsync(getStorageKeyForProvider(targetProvider), trimmed, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

/**
 * Deletes the stored LLM API key for a specific provider from iOS Keychain.
 */
export async function removeLlmApiKey(provider?: LlmProvider): Promise<void> {
  const targetProvider = provider ?? (await getLlmProvider());
  await SecureStore.deleteItemAsync(getStorageKeyForProvider(targetProvider));
  await SecureStore.deleteItemAsync(LEGACY_API_KEY_STORAGE_KEY).catch(() => {});
}

/**
 * Retrieves status of all configured provider keys.
 */
export async function getAllConfiguredProviderKeys(): Promise<Record<LlmProvider, boolean>> {
  const providers: LlmProvider[] = ['gemini', 'deepseek', 'kimi'];
  const result: Record<LlmProvider, boolean> = {
    gemini: false,
    deepseek: false,
    kimi: false,
  };

  for (const p of providers) {
    const key = await getLlmApiKey(p);
    result[p] = Boolean(key && key.length > 0);
  }

  return result;
}

/**
 * Retrieves the configured LLM provider (default: gemini).
 */
export async function getLlmProvider(): Promise<LlmProvider> {
  const provider = await SecureStore.getItemAsync(PROVIDER_STORAGE_KEY);
  if (provider === 'gemini' || provider === 'deepseek' || provider === 'kimi') {
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
