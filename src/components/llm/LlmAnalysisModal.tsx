import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, TextInput, Pressable, Alert, Image } from 'react-native';
import { PROMPT_PRESETS } from '../../services/llm/promptTemplates';
import { queryLlm } from '../../services/llm/llmClient';
import { getVaultMasterPrompt } from '../../services/vault/vaultService';
import { createTicket } from '../../services/tickets/ticketService';
import { Card, H2, Label, Body, Button, ErrorText } from '../ui';
import { useTheme } from '../../theme';

export interface LlmAnalysisModalProps {
  visible: boolean;
  onClose: () => void;
  imageBase64?: string;
  vaultId: string;
  vaultKey: Buffer | null;
  onTicketCreated?: () => void;
}

export function LlmAnalysisModal({
  visible,
  onClose,
  imageBase64,
  vaultId,
  vaultKey,
  onTicketCreated,
}: LlmAnalysisModalProps) {
  const { theme } = useTheme();
  const [selectedPrompt, setSelectedPrompt] = useState(PROMPT_PRESETS[0].prompt);
  const [customPrompt, setCustomPrompt] = useState('');
  const [llmOutput, setLlmOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingTicket, setSavingTicket] = useState(false);

  const handleExecute = async () => {
    const promptToUse = customPrompt.trim() || selectedPrompt;
    setLoading(true);
    setError(null);
    setLlmOutput(null);

    try {
      const masterPrompt = vaultId ? await getVaultMasterPrompt(vaultId) : undefined;
      const response = await queryLlm({
        userPrompt: promptToUse,
        imageBase64,
        masterPrompt,
      });
      setLlmOutput(response.content);
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : 'LLM Query failed';
      if (rawMessage.toLowerCase().includes('no api key found')) {
        setError(`${rawMessage}. Go to Settings > LLM Configuration to save your API key.`);
      } else {
        setError(rawMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsTicket = async () => {
    if (!llmOutput || !vaultKey || !vaultId) return;
    setSavingTicket(true);
    try {
      const firstLine = llmOutput
        .split('\n')[0]
        .replace(/^#+\s*/, '')
        .slice(0, 40);
      const title = firstLine.trim() || 'AI Photo Analysis Result';

      await createTicket(
        vaultId,
        {
          title,
          content: llmOutput,
          weight: 1,
        },
        vaultKey,
      );

      Alert.alert('Saved', 'Analysis saved as a new encrypted ticket.');
      if (onTicketCreated) {
        onTicketCreated();
      }
      onClose();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save ticket');
    } finally {
      setSavingTicket(false);
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
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <View className="flex-row justify-between items-center mb-4">
              <H2 className="text-base">
                {theme.isUppercase ? 'AI PHOTO ANALYSIS' : 'AI Photo Analysis'}
              </H2>
              <Button variant="secondary" className="h-7 px-2" onPress={onClose}>
                {theme.isUppercase ? 'CLOSE' : 'Close'}
              </Button>
            </View>

            {/* Photo preview banner if available */}
            {imageBase64 && (
              <View
                style={{
                  backgroundColor: theme.colors.badgeBg,
                  borderColor: theme.colors.cardBorder,
                  borderWidth: 1,
                  borderRadius: theme.borderRadius ? 8 : 0,
                  padding: 8,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Image
                  source={{ uri: imageBase64 }}
                  style={{ width: 44, height: 44, borderRadius: theme.borderRadius ? 4 : 0 }}
                  resizeMode="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontFamily: theme.isMono ? 'Courier' : undefined,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {theme.isUppercase ? 'DECRYPTED PHOTO ATTACHED' : 'Decrypted Photo Attached'}
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontFamily: theme.isMono ? 'Courier' : undefined,
                      fontSize: 10,
                    }}
                  >
                    {theme.isUppercase
                      ? 'READY FOR MULTIMODAL VISION REASONING'
                      : 'Ready for multimodal vision reasoning'}
                  </Text>
                </View>
              </View>
            )}

            {/* Presets */}
            <Label className="mb-2">PROMPT PRESETS</Label>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {PROMPT_PRESETS.map((preset) => {
                const isSelected = selectedPrompt === preset.prompt && !customPrompt;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => {
                      setSelectedPrompt(preset.prompt);
                      setCustomPrompt('');
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: theme.borderRadius ? 6 : 0,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                      backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.card,
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? theme.colors.accent : theme.colors.textMuted,
                        fontFamily: theme.isMono ? 'Courier' : undefined,
                        fontWeight: isSelected ? '700' : '500',
                        fontSize: 11,
                      }}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom prompt input */}
            <TextInput
              value={customPrompt}
              onChangeText={setCustomPrompt}
              placeholder="Or enter custom instruction..."
              placeholderTextColor={theme.colors.inputPlaceholder}
              style={{
                backgroundColor: theme.colors.inputBg,
                borderColor: theme.colors.inputBorder,
                borderWidth: 1,
                borderRadius: theme.borderRadius ? 8 : 0,
                color: theme.colors.inputText,
                fontFamily: theme.isMono ? 'Courier' : undefined,
                padding: 12,
                fontSize: 12,
                marginBottom: 16,
              }}
            />

            {error && <ErrorText className="mb-3">{error}</ErrorText>}

            <Button
              variant="primary"
              loading={loading}
              disabled={(!imageBase64 && !customPrompt) || loading}
              onPress={handleExecute}
              className="mb-4"
            >
              {theme.isUppercase ? 'RUN AI ANALYSIS' : 'Run AI Analysis'}
            </Button>

            {/* LLM Result */}
            {llmOutput && (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.divider,
                  paddingTop: 16,
                  marginTop: 16,
                }}
              >
                <Label className="mb-2">AI RESPONSE</Label>
                <View
                  style={{
                    backgroundColor: theme.colors.badgeBg,
                    borderColor: theme.colors.cardBorder,
                    borderWidth: 1,
                    borderRadius: theme.borderRadius ? 8 : 0,
                    padding: 12,
                    marginBottom: 16,
                  }}
                >
                  <Body style={{ color: theme.colors.textPrimary }} className="text-xs">
                    {llmOutput}
                  </Body>
                </View>

                <Button
                  variant="secondary"
                  loading={savingTicket}
                  disabled={savingTicket || !vaultKey}
                  onPress={handleSaveAsTicket}
                >
                  {theme.isUppercase ? 'SAVE AS ENCRYPTED TICKET' : 'Save as Encrypted Ticket'}
                </Button>
              </View>
            )}
          </ScrollView>
        </Card>
      </View>
    </Modal>
  );
}
