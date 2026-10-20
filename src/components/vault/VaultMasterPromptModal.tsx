import React, { useState, useEffect } from 'react';
import { View, Modal, ScrollView, TextInput, Pressable, Text, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, H2, Label, Body, Button } from '../ui';
import { getVaultMasterPrompt, updateVaultMasterPrompt } from '../../services/vault/vaultService';

export interface VaultMasterPromptModalProps {
  visible: boolean;
  vaultId: string;
  vaultName: string;
  onClose: () => void;
  onSaved?: () => void;
}

const MASTER_PROMPT_PRESETS = [
  {
    label: 'CONCISE BULLETS',
    prompt:
      'Always output in concise, high-contrast bullet points. Highlight dates, numbers, and action items.',
  },
  {
    label: 'FINANCE & RECEIPTS',
    prompt:
      'Extract merchant names, transaction dates, tax, and total monetary amounts. Categorize expenses clearly.',
  },
  {
    label: 'DOCUMENT & ARCHIVE',
    prompt:
      'Structure analysis with Document Title, Document Type, Subject Summary, and Key Data Fields.',
  },
  {
    label: 'TECHNICAL / DEV',
    prompt:
      'Identify code snippets, error messages, system architectures, credentials, and technical specifications.',
  },
];

export const VaultMasterPromptModal: React.FC<VaultMasterPromptModalProps> = ({
  visible,
  vaultId,
  vaultName,
  onClose,
  onSaved,
}) => {
  const [promptText, setPromptText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible && vaultId) {
      setIsLoading(true);
      getVaultMasterPrompt(vaultId)
        .then((saved) => {
          setPromptText(saved);
        })
        .catch((err) => {
          console.error('Failed to load master prompt:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [visible, vaultId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateVaultMasterPrompt(vaultId, promptText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Saved',
        'Vault master prompt has been updated and will be appended to all LLM queries in this vault.',
      );
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save master prompt');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/90 justify-center items-center p-4">
        <Card className="w-full max-h-[85%] border-2 border-white p-5 bg-black">
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Label className="text-zinc-500">VAULT CONFIGURATION</Label>
                <H2 className="text-white text-base">LLM MASTER PROMPT</H2>
              </View>
              <Pressable
                onPress={onClose}
                className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 active:bg-zinc-800"
              >
                <Text className="text-white font-mono text-xs uppercase">CLOSE</Text>
              </Pressable>
            </View>

            <Body className="text-zinc-400 text-xs mb-3">
              This master prompt is automatically appended whenever an LLM prompt or photo text
              suggestion is made inside &quot;{vaultName}&quot;.
            </Body>

            <Label className="text-zinc-400 mb-2">PROMPT PRESETS</Label>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {MASTER_PROMPT_PRESETS.map((preset) => (
                <Pressable
                  key={preset.label}
                  onPress={() => setPromptText(preset.prompt)}
                  className="px-2.5 py-1.5 border border-zinc-800 bg-zinc-950 active:border-white"
                >
                  <Text className="text-xs font-mono text-zinc-300">{preset.label}</Text>
                </Pressable>
              ))}
            </View>

            <Label className="text-zinc-400 mb-2">VAULT MASTER PROMPT</Label>
            <TextInput
              value={promptText}
              onChangeText={setPromptText}
              placeholder="e.g. Always format responses in clean bullet points with actionable takeaways..."
              placeholderTextColor="#52525B"
              multiline
              numberOfLines={5}
              style={{ minHeight: 110, textAlignVertical: 'top' }}
              className="border border-zinc-700 bg-zinc-950 text-white p-3 font-mono text-xs mb-4"
              editable={!isLoading && !isSaving}
            />

            <View className="flex-row gap-2">
              <Button
                variant="secondary"
                onPress={() => setPromptText('')}
                className="flex-1"
                disabled={!promptText || isSaving}
              >
                CLEAR
              </Button>
              <Button variant="primary" loading={isSaving} onPress={handleSave} className="flex-1">
                SAVE PROMPT
              </Button>
            </View>
          </ScrollView>
        </Card>
      </View>
    </Modal>
  );
};
