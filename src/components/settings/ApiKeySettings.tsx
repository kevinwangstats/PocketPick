import React, { useState, useEffect, useCallback } from 'react';
import { View, Pressable, Alert, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  getLlmApiKey,
  setLlmApiKey,
  removeLlmApiKey,
  getLlmProvider,
  setLlmProvider,
  getAllConfiguredProviderKeys,
  LlmProvider,
  DEFAULT_LLM_MODELS,
  maskApiKey,
} from '../../services/llm/llmKeyStore';
import { Card, H2, Label, Body, Mono, Input, Button } from '../ui';
import { useTheme } from '../../theme';

interface ProviderDef {
  id: LlmProvider;
  label: string;
  modelLabel: string;
}

const PROVIDERS: ProviderDef[] = [
  { id: 'gemini', label: 'GEMINI', modelLabel: 'gemini 3.8 flash' },
  { id: 'deepseek', label: 'DEEPSEEK', modelLabel: 'deepseek v4 flash' },
  { id: 'kimi', label: 'KIMI', modelLabel: 'kimi-k2.6' },
];

export function ApiKeySettings() {
  const { theme } = useTheme();
  const [selectedProvider, setSelectedProvider] = useState<LlmProvider>('gemini');
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [configuredMap, setConfiguredMap] = useState<Record<LlmProvider, boolean>>({
    gemini: false,
    deepseek: false,
    kimi: false,
  });

  const loadSettings = useCallback(async (targetProvider?: LlmProvider) => {
    const activeProv = targetProvider ?? (await getLlmProvider());
    setSelectedProvider(activeProv);
    const key = await getLlmApiKey(activeProv);
    setCurrentKey(key);
    const configured = await getAllConfiguredProviderKeys();
    setConfiguredMap(configured);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSelectProvider = async (p: LlmProvider) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedProvider(p);
    await setLlmProvider(p);
    setInputKey('');
    const key = await getLlmApiKey(p);
    setCurrentKey(key);
  };

  const handleSave = async () => {
    if (!inputKey.trim()) return;
    setIsSaving(true);
    try {
      await setLlmApiKey(inputKey, selectedProvider);
      await setLlmProvider(selectedProvider);
      setInputKey('');
      await loadSettings(selectedProvider);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Saved',
        `${selectedProvider.toUpperCase()} API key securely stored in iOS Keychain.`,
      );
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    Alert.alert(
      `Remove ${selectedProvider.toUpperCase()} Key`,
      `Are you sure you want to delete your stored API key for ${selectedProvider.toUpperCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeLlmApiKey(selectedProvider);
            await loadSettings(selectedProvider);
          },
        },
      ],
    );
  };

  return (
    <Card className="p-5 mb-6">
      <H2 className="mb-1">LLM CONFIGURATION</H2>
      <Body className="text-xs mb-4">
        Hold separate API keys for Gemini, DeepSeek, and Kimi. Keys are isolated in hardware-backed
        iOS Keychain.
      </Body>

      <Label className="mb-2">PROVIDER & ACTIVE MODEL</Label>
      <View className="flex-row gap-2 mb-4">
        {PROVIDERS.map((p) => {
          const isSelected = selectedProvider === p.id;
          const isConfigured = configuredMap[p.id];

          return (
            <Pressable
              key={p.id}
              onPress={() => handleSelectProvider(p.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={{
                borderRadius: theme.borderRadius ? 10 : 0,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.card,
                paddingVertical: 10,
                paddingHorizontal: 8,
              }}
              className="flex-1 items-center active:opacity-85"
            >
              <View className="flex-row items-center gap-1">
                <Text
                  style={{
                    color: isSelected ? theme.colors.accent : theme.colors.textPrimary,
                    fontWeight: isSelected ? '700' : '600',
                    fontSize: 12,
                    fontFamily: theme.isMono ? 'Courier' : undefined,
                    letterSpacing: theme.isUppercase ? 1 : 0.2,
                  }}
                >
                  {p.label}
                </Text>
                {isConfigured && (
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: '#10B981',
                    }}
                  />
                )}
              </View>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 10,
                  marginTop: 3,
                  fontFamily: theme.isMono ? 'Courier' : undefined,
                }}
              >
                {p.modelLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          backgroundColor: theme.isDark ? '#000000' : theme.colors.background,
          borderColor: theme.colors.cardBorder,
          borderWidth: 1,
          borderRadius: theme.borderRadius ? 8 : 0,
          padding: 10,
        }}
        className="mb-4"
      >
        <Label className="text-[10px]">ACTIVE MODEL ENDPOINT</Label>
        <Mono className="text-xs mt-0.5">
          {selectedProvider}: {DEFAULT_LLM_MODELS[selectedProvider]}
        </Mono>
      </View>

      <Label className="mb-2">{selectedProvider.toUpperCase()} KEY STATUS</Label>
      <View
        style={{
          backgroundColor: theme.isDark ? '#000000' : theme.colors.background,
          borderColor: theme.colors.cardBorder,
          borderWidth: 1,
          borderRadius: theme.borderRadius ? 8 : 0,
          padding: 12,
        }}
        className="mb-4 flex-row justify-between items-center"
      >
        <Mono className="text-xs">
          {currentKey
            ? maskApiKey(currentKey)
            : `NO ${selectedProvider.toUpperCase()} KEY CONFIGURED`}
        </Mono>
        {currentKey && (
          <Button variant="destructive" className="h-7 px-2" onPress={handleRemove}>
            DELETE
          </Button>
        )}
      </View>

      <Label className="mb-2">UPDATE {selectedProvider.toUpperCase()} KEY</Label>
      <Input
        value={inputKey}
        onChangeText={setInputKey}
        placeholder={`Paste ${selectedProvider.toUpperCase()} API key`}
        secureTextEntry
        className="mb-4"
      />

      <Button variant="primary" disabled={!inputKey.trim()} loading={isSaving} onPress={handleSave}>
        {`SAVE ${selectedProvider.toUpperCase()} KEY TO KEYCHAIN`}
      </Button>
    </Card>
  );
}
