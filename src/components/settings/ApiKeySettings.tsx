import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Alert, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, Button, Input, Label, Mono, Body, H2 } from '../ui';
import {
  getOpenRouterApiKey,
  setOpenRouterApiKey,
  removeOpenRouterApiKey,
  getOpenRouterModel,
  setOpenRouterModel,
  maskApiKey,
  OPENROUTER_MODEL_PRESETS,
  DEFAULT_OPENROUTER_MODEL,
} from '../../services/llm/llmKeyStore';
import { useTheme } from '../../theme';

export function ApiKeySettings() {
  const { theme } = useTheme();
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [activeModel, setActiveModel] = useState<string>(DEFAULT_OPENROUTER_MODEL);
  const [isSavingKey, setIsSavingKey] = useState(false);

  const loadSettings = useCallback(async () => {
    const key = await getOpenRouterApiKey();
    setCurrentKey(key);
    const model = await getOpenRouterModel();
    setActiveModel(model);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveKey = async () => {
    if (!inputKey.trim()) return;
    setIsSavingKey(true);
    try {
      await setOpenRouterApiKey(inputKey);
      setInputKey('');
      await loadSettings();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Saved', 'OpenRouter API key securely stored in iOS Keychain.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleRemoveKey = async () => {
    Alert.alert(
      'Remove OpenRouter Key',
      'Are you sure you want to delete your stored OpenRouter API key from iOS Keychain?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeOpenRouterApiKey();
            await loadSettings();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          },
        },
      ],
    );
  };

  const handleSelectModelPreset = async (modelId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveModel(modelId);
    try {
      await setOpenRouterModel(modelId);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update model');
    }
  };

  return (
    <Card className="p-5 mb-6">
      <H2 className="mb-1">OPENROUTER GATEWAY</H2>
      <Body className="text-xs mb-4">
        Powered by OpenRouter with Grok 4.7 as default (and Gemini 3.8 Flash optional). Stored
        exclusively in hardware-backed iOS Keychain.
      </Body>

      {/* Key Status */}
      <Label className="mb-2">OPENROUTER KEY STATUS</Label>
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
        <View className="flex-row items-center gap-2 flex-1 mr-2">
          {currentKey && (
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#10B981',
              }}
            />
          )}
          <Mono className="text-xs">
            {currentKey ? maskApiKey(currentKey) : 'NO OPENROUTER KEY CONFIGURED'}
          </Mono>
        </View>
        {currentKey && (
          <Button variant="destructive" className="h-7 px-2" onPress={handleRemoveKey}>
            DELETE
          </Button>
        )}
      </View>

      {/* Update Key Input */}
      <Label className="mb-2">UPDATE OPENROUTER KEY</Label>
      <Input
        value={inputKey}
        onChangeText={setInputKey}
        placeholder="sk-or-v1-..."
        secureTextEntry
        className="mb-3"
      />

      <Button
        variant="primary"
        disabled={!inputKey.trim()}
        loading={isSavingKey}
        onPress={handleSaveKey}
        className="mb-6"
      >
        SAVE OPENROUTER KEY TO KEYCHAIN
      </Button>

      {/* Model Selection */}
      <Label className="mb-2">ACTIVE MODEL SELECTION</Label>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {OPENROUTER_MODEL_PRESETS.map((preset) => {
          const isSelected = activeModel === preset.id;

          return (
            <Pressable
              key={preset.id}
              onPress={() => handleSelectModelPreset(preset.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={{
                borderRadius: theme.borderRadius ? 8 : 0,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.card,
                paddingVertical: 10,
                paddingHorizontal: 12,
              }}
              className="flex-1 min-w-[45%] active:opacity-85"
            >
              <View className="flex-row items-center justify-between">
                <Text
                  style={{
                    color: isSelected ? theme.colors.accent : theme.colors.textPrimary,
                    fontWeight: isSelected ? '700' : '600',
                    fontSize: 11,
                    fontFamily: theme.isMono ? 'Courier' : undefined,
                    letterSpacing: theme.isUppercase ? 1 : 0.2,
                  }}
                >
                  {preset.label}
                </Text>
                {preset.multimodal && (
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: 9,
                      fontFamily: theme.isMono ? 'Courier' : undefined,
                    }}
                  >
                    VISION
                  </Text>
                )}
              </View>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 10,
                  marginTop: 2,
                  fontFamily: theme.isMono ? 'Courier' : undefined,
                }}
              >
                {preset.description}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Active Model Endpoint Bar */}
      <View
        style={{
          backgroundColor: theme.isDark ? '#000000' : theme.colors.background,
          borderColor: theme.colors.cardBorder,
          borderWidth: 1,
          borderRadius: theme.borderRadius ? 8 : 0,
          padding: 10,
        }}
      >
        <Label className="text-[10px]">CURRENT TARGET ENDPOINT</Label>
        <Mono className="text-xs mt-0.5">openrouter: {activeModel}</Mono>
      </View>
    </Card>
  );
}
