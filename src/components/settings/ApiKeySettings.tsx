import React, { useState, useEffect } from 'react';
import { View, Pressable, Alert } from 'react-native';
import {
  getLlmApiKey,
  setLlmApiKey,
  removeLlmApiKey,
  getLlmProvider,
  setLlmProvider,
  LlmProvider,
  DEFAULT_LLM_MODELS,
  maskApiKey,
} from '../../services/llm/llmKeyStore';
import { Card, H2, Label, Body, Mono, Input, Button } from '../ui';

export function ApiKeySettings() {
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [provider, setProviderState] = useState<LlmProvider>('gemini');
  const [inputKey, setInputKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const key = await getLlmApiKey();
    const prov = await getLlmProvider();
    setCurrentKey(key);
    setProviderState(prov);
  };

  const handleSave = async () => {
    if (!inputKey.trim()) return;
    setIsSaving(true);
    try {
      await setLlmApiKey(inputKey);
      await setLlmProvider(provider);
      setInputKey('');
      await loadSettings();
      Alert.alert('Saved', 'API key securely stored in iOS Keychain.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    Alert.alert('Remove API Key', 'Are you sure you want to delete your stored API key?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeLlmApiKey();
          await loadSettings();
        },
      },
    ]);
  };

  const providers: { id: LlmProvider; label: string; modelLabel: string }[] = [
    { id: 'gemini', label: 'GEMINI', modelLabel: 'gemini 3.8 flash' },
    { id: 'deepseek', label: 'DEEPSEEK', modelLabel: 'deepseek v4 flash' },
  ];

  return (
    <Card className="p-5 border border-zinc-800 bg-zinc-950 mb-6">
      <H2 className="text-white text-lg mb-1">LLM CONFIGURATION</H2>
      <Body className="text-zinc-500 text-xs mb-4">
        Stored strictly inside hardware-backed iOS Keychain. Never leaves your device except for
        direct API requests.
      </Body>

      <Label className="text-zinc-400 mb-2">PROVIDER & ACTIVE MODEL</Label>
      <View className="flex-row space-x-2 gap-2 mb-4">
        {providers.map((p) => {
          const isSelected = provider === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setProviderState(p.id)}
              className={`flex-1 py-2.5 px-2 items-center border ${
                isSelected ? 'border-white bg-white' : 'border-zinc-800 bg-black'
              }`}
            >
              <Label className={isSelected ? 'text-black font-bold' : 'text-zinc-300'}>
                {p.label}
              </Label>
              <Mono
                className={`text-[10px] mt-0.5 ${isSelected ? 'text-zinc-800' : 'text-zinc-500'}`}
              >
                {p.modelLabel}
              </Mono>
            </Pressable>
          );
        })}
      </View>

      <View className="mb-4 p-2.5 bg-black border border-zinc-800">
        <Label className="text-zinc-500 text-[10px]">DEFAULT MODEL ENDPOINT</Label>
        <Mono className="text-xs text-white">
          {provider}: {DEFAULT_LLM_MODELS[provider]}
        </Mono>
      </View>

      <Label className="text-zinc-400 mb-2">CURRENT KEY STATUS</Label>
      <View className="p-3 bg-black border border-zinc-800 mb-4 flex-row justify-between items-center">
        <Mono className="text-xs text-zinc-300">
          {currentKey ? maskApiKey(currentKey) : 'NO KEY CONFIGURED'}
        </Mono>
        {currentKey && (
          <Button variant="destructive" className="h-7 px-2" onPress={handleRemove}>
            DELETE
          </Button>
        )}
      </View>

      <Label className="text-zinc-400 mb-2">UPDATE KEY</Label>
      <Input
        value={inputKey}
        onChangeText={setInputKey}
        placeholder={`Paste ${provider.toUpperCase()} API key`}
        secureTextEntry
        className="mb-4"
      />

      <Button variant="primary" disabled={!inputKey.trim()} loading={isSaving} onPress={handleSave}>
        SAVE KEY TO KEYCHAIN
      </Button>
    </Card>
  );
}
