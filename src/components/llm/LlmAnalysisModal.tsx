import React, { useState } from 'react';
import { View, Modal, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { PROMPT_PRESETS } from '../../services/llm/promptTemplates';
import { queryLlm } from '../../services/llm/llmClient';
import { getVaultMasterPrompt } from '../../services/vault/vaultService';
import { createTicket } from '../../services/tickets/ticketService';
import { Card, H2, Label, Body, Mono, Button, ErrorText } from '../ui';

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
      <View className="flex-1 bg-black/90 justify-center items-center p-4">
        <Card className="w-full max-h-[85%] border-2 border-white p-5 bg-black">
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <View className="flex-row justify-between items-center mb-4">
              <H2 className="text-white text-lg">ON-DEVICE OCR & LLM</H2>
              <Button variant="secondary" className="h-7 px-2" onPress={onClose}>
                CLOSE
              </Button>
            </View>

            {/* Step 1: Extracted OCR inspection */}
            <Label className="text-zinc-400 mb-2">RECOGNIZED TEXT (INSPECT / REDACT)</Label>
            <View className="p-3 bg-zinc-950 border border-zinc-800 mb-4 max-h-36">
              <ScrollView>
                <Mono className="text-xs text-zinc-300">
                  {extractedText || '[NO TEXT DETECTED]'}
                </Mono>
              </ScrollView>
            </View>

            {/* Step 2: Presets */}
            <Label className="text-zinc-400 mb-2">PROMPT PRESETS</Label>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {PROMPT_PRESETS.map((preset) => (
                <Pressable
                  key={preset.id}
                  onPress={() => {
                    setSelectedPrompt(preset.prompt);
                    setCustomPrompt('');
                  }}
                  className={`px-2.5 py-1.5 border ${
                    selectedPrompt === preset.prompt && !customPrompt
                      ? 'border-white bg-white'
                      : 'border-zinc-800 bg-zinc-950'
                  }`}
                >
                  <Label
                    className={
                      selectedPrompt === preset.prompt && !customPrompt
                        ? 'text-black'
                        : 'text-zinc-400'
                    }
                  >
                    {preset.label}
                  </Label>
                </Pressable>
              ))}
            </View>

            {/* Custom prompt input */}
            <TextInput
              value={customPrompt}
              onChangeText={setCustomPrompt}
              placeholder="Or enter custom instruction..."
              placeholderTextColor="#71717A"
              className="border border-zinc-800 bg-black text-white p-3 font-mono text-xs mb-4"
            />

            {error && <ErrorText className="mb-3">{error}</ErrorText>}

            <Button
              variant="primary"
              loading={loading}
              disabled={!extractedText || loading}
              onPress={handleExecute}
              className="mb-4"
            >
              RUN LLM QUERY
            </Button>

            {/* LLM Result */}
            {llmOutput && (
              <View className="mt-4 border-t border-zinc-800 pt-4">
                <Label className="text-white mb-2">LLM RESPONSE</Label>
                <View className="p-3 bg-zinc-950 border border-zinc-700 mb-4">
                  <Body className="text-xs text-zinc-200">{llmOutput}</Body>
                </View>

                <Button
                  variant="secondary"
                  loading={savingTicket}
                  disabled={savingTicket || !vaultKey}
                  onPress={handleSaveAsTicket}
                >
                  SAVE AS ENCRYPTED TICKET
                </Button>
              </View>
            )}
          </ScrollView>
        </Card>
      </View>
    </Modal>
  );
}
