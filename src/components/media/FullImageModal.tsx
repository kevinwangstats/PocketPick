import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  Image,
  ActivityIndicator,
  Pressable,
  Text,
  Dimensions,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Buffer } from '@craftzdog/react-native-buffer';
import { Resource } from '../../db/schema';
import { decryptBuffer } from '../../crypto/cipher';
import { Label, ErrorText, Button } from '../ui';
import { processEphemeralOcr } from '../../services/ocr/ephemeralProcessor';
import { queryLlm } from '../../services/llm/llmClient';
import { getVaultMasterPrompt } from '../../services/vault/vaultService';
import { getPhotoText, savePhotoText } from '../../services/media/photoTextService';
import { LlmAnalysisModal } from '../llm';

export interface FullImageModalProps {
  visible: boolean;
  resource: Resource | null;
  vaultKey: Buffer | null;
  onClose: () => void;
  onDelete?: (resourceId: string) => Promise<void>;
  onPhotoUpdated?: () => Promise<void>;
}

export const FullImageModal: React.FC<FullImageModalProps> = ({
  visible,
  resource,
  vaultKey,
  onClose,
  onDelete,
  onPhotoUpdated,
}) => {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Associated text state
  const [associatedText, setAssociatedText] = useState('');
  const [isSavingText, setIsSavingText] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isTextDirty, setIsTextDirty] = useState(false);

  // OCR modal state
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrModalVisible, setOcrModalVisible] = useState(false);
  const [extractedOcrText, setExtractedOcrText] = useState('');

  // Load photo & decrypted associated text
  useEffect(() => {
    let isCancelled = false;

    async function loadContent() {
      if (
        !visible ||
        !resource ||
        !vaultKey ||
        !resource.encryptedFilePath ||
        !resource.fileIv ||
        !resource.fileTag
      ) {
        setDataUri(null);
        setAssociatedText('');
        setIsTextDirty(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Decrypt associated text note if present
        const decryptedText = getPhotoText(resource, vaultKey);
        if (!isCancelled) {
          setAssociatedText(decryptedText ?? '');
          setIsTextDirty(false);
        }

        const ciphertextBase64 = await FileSystem.readAsStringAsync(resource.encryptedFilePath, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const decryptedBytes = decryptBuffer(
          {
            ciphertext: ciphertextBase64,
            iv: resource.fileIv,
            tag: resource.fileTag,
          },
          vaultKey,
          resource.vaultId,
        );

        const base64Image = `data:image/jpeg;base64,${decryptedBytes.toString('base64')}`;

        if (!isCancelled) {
          setDataUri(base64Image);
        }
      } catch (err) {
        if (!isCancelled) {
          setError((err as Error).message || 'Decryption failed');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadContent();

    return () => {
      isCancelled = true;
      setDataUri(null); // Invariant: Immediately discard decrypted full buffer on exit
    };
  }, [visible, resource, vaultKey]);

  // Handle saving the user-customized associated text
  const handleSaveText = async () => {
    if (!resource || !vaultKey) return;
    setIsSavingText(true);
    try {
      await savePhotoText(resource.id, associatedText, vaultKey, resource.vaultId);
      setIsTextDirty(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (onPhotoUpdated) {
        await onPhotoUpdated();
      }
      Alert.alert('Saved', 'Photo notes encrypted and saved.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setIsSavingText(false);
    }
  };

  // AI Suggestion: runs ephemeral OCR -> appends vault master prompt -> fills editable input
  const handleAiSuggest = async () => {
    if (
      !resource ||
      !vaultKey ||
      !resource.encryptedFilePath ||
      !resource.fileIv ||
      !resource.fileTag
    ) {
      return;
    }

    setIsSuggesting(true);
    setError(null);
    try {
      // 1. Run ephemeral OCR on image bytes
      const ocrResult = await processEphemeralOcr({
        encryptedFilePath: resource.encryptedFilePath,
        key: vaultKey,
        iv: resource.fileIv,
        tag: resource.fileTag,
        vaultId: resource.vaultId,
      });

      // 2. Fetch the vault master prompt
      const masterPrompt = await getVaultMasterPrompt(resource.vaultId);

      // 3. Query LLM to synthesize a description/suggestion
      const prompt = ocrResult.trim()
        ? 'Generate a concise description, title, and key details for this document/photo based on the text:'
        : 'Generate a short description and suggested tags for this encrypted photo:';

      const response = await queryLlm({
        userPrompt: prompt,
        contextText: ocrResult || 'Visual photo asset',
        masterPrompt,
      });

      if (response.content) {
        // Place into editable text field so user can customize before saving
        setAssociatedText(response.content);
        setIsTextDirty(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } catch (err) {
      Alert.alert(
        'AI Assist Failed',
        err instanceof Error ? err.message : 'Unable to generate suggestion',
      );
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleRunOcr = async () => {
    if (
      !resource ||
      !vaultKey ||
      !resource.encryptedFilePath ||
      !resource.fileIv ||
      !resource.fileTag
    ) {
      return;
    }

    setIsOcrRunning(true);
    setError(null);
    try {
      const text = await processEphemeralOcr({
        encryptedFilePath: resource.encryptedFilePath,
        key: vaultKey,
        iv: resource.fileIv,
        tag: resource.fileTag,
        vaultId: resource.vaultId,
      });
      setExtractedOcrText(text);
      setOcrModalVisible(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OCR failed');
    } finally {
      setIsOcrRunning(false);
    }
  };

  const handleDelete = async () => {
    if (!resource || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(resource.id);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Delete error');
    } finally {
      setIsDeleting(false);
    }
  };

  const screenWidth = Dimensions.get('window').width;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-black justify-between py-10 px-4"
      >
        {/* Header */}
        <View className="flex-row justify-between items-center mb-3">
          <Label className="text-zinc-400">ENCRYPTED MEDIA VIEWER</Label>
          <Pressable
            onPress={onClose}
            className="px-3 py-1 bg-zinc-900 border border-zinc-700 active:bg-zinc-800"
          >
            <Text className="text-white font-mono text-xs uppercase">[CLOSE]</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
          {/* Photo Display */}
          <View className="w-full items-center justify-center min-h-[220px] bg-zinc-950 border border-zinc-800 mb-4 p-2">
            {isLoading ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : error ? (
              <View className="p-4 border border-red-900 bg-red-950/20">
                <ErrorText>{error}</ErrorText>
              </View>
            ) : dataUri ? (
              <Image
                source={{ uri: dataUri }}
                style={{ width: screenWidth - 48, height: 260 }}
                resizeMode="contain"
              />
            ) : null}
          </View>

          {/* Associated Text & AI Suggestion Section */}
          <View className="p-3 bg-zinc-950 border border-zinc-800 mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Label className="text-white font-bold">ASSOCIATED TEXT & NOTES</Label>
              <Pressable
                onPress={handleAiSuggest}
                disabled={isSuggesting || !dataUri}
                className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 active:border-white"
              >
                <Text className="text-xs font-mono text-zinc-300">
                  {isSuggesting ? 'GENERATING...' : '+ AI SUGGEST'}
                </Text>
              </Pressable>
            </View>

            <TextInput
              value={associatedText}
              onChangeText={(val) => {
                setAssociatedText(val);
                setIsTextDirty(true);
              }}
              placeholder="Type photo notes, keywords, or tap + AI SUGGEST to auto-generate..."
              placeholderTextColor="#52525B"
              multiline
              numberOfLines={4}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
              className="border border-zinc-800 bg-black text-white p-2.5 font-mono text-xs mb-3"
            />

            <View className="flex-row justify-end items-center gap-2">
              {isTextDirty && (
                <Text className="text-xs font-mono text-zinc-500 mr-2">[UNSAVED]</Text>
              )}
              <Button
                variant="primary"
                loading={isSavingText}
                disabled={isSavingText}
                onPress={handleSaveText}
                className="h-8 px-4"
              >
                SAVE NOTE
              </Button>
            </View>
          </View>
        </ScrollView>

        {/* Action Toolbar */}
        <View className="flex-row justify-between items-center border-t border-zinc-900 pt-3">
          <Label className="text-zinc-600 font-mono text-xs">
            {resource?.id ? `ID: ${resource.id.substring(0, 8)}...` : ''}
          </Label>

          <View className="flex-row space-x-2 gap-2">
            <Pressable
              onPress={handleRunOcr}
              disabled={isOcrRunning || !resource}
              className="px-3 py-2 bg-zinc-950 border border-zinc-700 active:border-white"
            >
              <Text className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                {isOcrRunning ? 'EXTRACTING...' : 'FULL OCR'}
              </Text>
            </Pressable>

            {onDelete && resource && (
              <Pressable
                onPress={handleDelete}
                disabled={isDeleting}
                className="px-3 py-2 bg-zinc-950 border border-red-900 active:bg-red-950"
              >
                <Text className="text-xs font-mono text-red-400 uppercase tracking-wider">
                  {isDeleting ? 'SHREDDING...' : 'SHRED'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <LlmAnalysisModal
          visible={ocrModalVisible}
          onClose={() => setOcrModalVisible(false)}
          extractedText={extractedOcrText}
          vaultId={resource?.vaultId ?? ''}
          vaultKey={vaultKey}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
};
