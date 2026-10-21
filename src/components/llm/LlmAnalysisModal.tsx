import React, { useState } from 'react';
import { View, Modal, ScrollView, Pressable, TextInput, Alert, Text } from 'react-native';
import { PROMPT_PRESETS } from '../../services/llm/promptTemplates';
import { queryLlm } from '../../services/llm/llmClient';
import { getVaultMasterPrompt } from '../../services/vault/vaultService';
import { createTicket } from '../../services/tickets/ticketService';
import { Card, H2, Label, Body, Mono, Button, ErrorText } from '../ui';
import { useTheme } from '../../theme';

export interface LlmAnalysisModalProps {
  visible: boolean;
  onClose: () => void;
  extractedText: string;
  vaultId: string;
  vaultKey: Buffer | null;
  onTicketCreated?: () => void;
}

export function LlmAnalysisModal({
  visible,
  onClose,
  extractedText,
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
        contextText: extractedText,
        masterPrompt,
      });
      setLlmOutput(response.content);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'LLM Query failed');
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
      const title = firstLine.trim() || 'LLM Analysis Result';

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
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <View className="flex-row justify-between items-center mb-4">
              <H2 className="text-base">
                {theme.isUppercase ? 'ON-DEVICE OCR & LLM' : 'On-Device OCR & LLM'}
              </H2>
              <Button variant="secondary" className="h-7 px-2" onPress={onClose}>
                {theme.isUppercase ? 'CLOSE' : 'Close'}
              </Button>
            </View>

            {/* Step 1: Extracted OCR inspection */}
            <Label className="mb-2">RECOGNIZED TEXT (INSPECT / REDACT)</Label>
            <View
              style={{
                backgroundColor: theme.colors.badgeBg,
                borderColor: theme.colors.cardBorder,
                borderWidth: 1,
                borderRadius: theme.borderRadius ? 8 : 0,
                padding: 12,
                marginBottom: 16,
                maxHeight: 140,
              }}
            >
              <ScrollView>
                <Mono style={{ color: theme.colors.textSecondary }} className="text-xs">
                  {extractedText || '[NO TEXT DETECTED]'}
                </Mono>
              </ScrollView>
            </View>

            {/* Step 2: Presets */}
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
              disabled={!extractedText || loading}
              onPress={handleExecute}
              className="mb-4"
            >
              {theme.isUppercase ? 'RUN LLM QUERY' : 'Run LLM Query'}
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
                <Label className="mb-2">LLM RESPONSE</Label>
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
