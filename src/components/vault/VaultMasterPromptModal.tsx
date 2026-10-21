import React, { useState, useEffect } from 'react';
import { View, Modal, ScrollView, TextInput, Pressable, Text, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, H2, Label, Body, Button } from '../ui';
import { getVaultMasterPrompt, updateVaultMasterPrompt } from '../../services/vault/vaultService';
import { useTheme } from '../../theme';

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
  const { theme } = useTheme();
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
      <View
        style={{
          flex: 1,
          backgroundColor: theme.isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        }}
      >
        <Card className="w-full max-h-[85%] p-5">
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-1 pr-2">
                <Label>VAULT CONFIGURATION</Label>
                <H2 className="text-base">
                  {theme.isUppercase ? 'LLM MASTER PROMPT' : 'LLM Master Prompt'}
                </H2>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  backgroundColor: theme.colors.badgeBg,
                  borderColor: theme.colors.cardBorder,
                  borderWidth: 1,
                  borderRadius: theme.borderRadius ? 6 : 0,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.accent,
                    fontFamily: theme.isMono ? 'Courier' : undefined,
                    fontWeight: '600',
                    fontSize: 12,
                  }}
                >
                  {theme.isUppercase ? 'CLOSE' : 'Close'}
                </Text>
              </Pressable>
            </View>

            <Body style={{ color: theme.colors.textSecondary }} className="text-xs mb-3">
              This master prompt is automatically appended whenever an LLM prompt or photo text
              suggestion is made inside &quot;{vaultName}&quot;.
            </Body>

            <Label className="mb-2">PROMPT PRESETS</Label>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {MASTER_PROMPT_PRESETS.map((preset) => (
                <Pressable
                  key={preset.label}
                  onPress={() => setPromptText(preset.prompt)}
                  style={{
                    backgroundColor: theme.colors.badgeBg,
                    borderColor: theme.colors.cardBorder,
                    borderWidth: 1,
                    borderRadius: theme.borderRadius ? 6 : 0,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.badgeText,
                      fontFamily: theme.isMono ? 'Courier' : undefined,
                      fontSize: 11,
                      fontWeight: '600',
                    }}
                  >
                    {preset.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Label className="mb-2">VAULT MASTER PROMPT</Label>
            <TextInput
              value={promptText}
              onChangeText={setPromptText}
              placeholder="e.g. Always format responses in clean bullet points with actionable takeaways..."
              placeholderTextColor={theme.colors.inputPlaceholder}
              multiline
              numberOfLines={5}
              style={{
                minHeight: 110,
                textAlignVertical: 'top',
                backgroundColor: theme.colors.inputBg,
                borderColor: theme.colors.inputBorder,
                borderWidth: 1,
                borderRadius: theme.borderRadius ? 8 : 0,
                color: theme.colors.inputText,
                fontFamily: theme.isMono ? 'Courier' : undefined,
                padding: 12,
                fontSize: 13,
                marginBottom: 16,
              }}
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
