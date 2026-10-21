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
import { useTheme } from '../../theme';

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
  const { theme } = useTheme();

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
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          justifyContent: 'space-between',
          paddingTop: 48,
          paddingBottom: 24,
          paddingHorizontal: 16,
        }}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center mb-3">
          <Label>{theme.isUppercase ? 'ENCRYPTED MEDIA VIEWER' : 'Encrypted Media Viewer'}</Label>
          <Pressable
            onPress={onClose}
            style={{
              backgroundColor: theme.colors.badgeBg,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 6 : 0,
              paddingHorizontal: 10,
              paddingVertical: 5,
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
              {theme.isUppercase ? '[CLOSE]' : 'Close'}
            </Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
          {/* Photo Display */}
          <View
            style={{
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 220,
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 12 : 0,
              marginBottom: 16,
              padding: 8,
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="large" color={theme.colors.accent} />
            ) : error ? (
              <View
                style={{
                  padding: 16,
                  borderColor: theme.colors.destructiveButtonBorder,
                  backgroundColor: theme.colors.destructiveButtonBg,
                  borderRadius: theme.borderRadius ? 8 : 0,
                }}
              >
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
          <View
            style={{
              padding: 14,
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 12 : 0,
              marginBottom: 16,
            }}
          >
            <View className="flex-row justify-between items-center mb-2">
              <Label>
                {theme.isUppercase ? 'ASSOCIATED TEXT & NOTES' : 'Associated Text & Notes'}
              </Label>
              <Pressable
                onPress={handleAiSuggest}
                disabled={isSuggesting || !dataUri}
                style={{
                  backgroundColor: theme.colors.badgeBg,
                  borderColor: theme.colors.cardBorder,
                  borderWidth: 1,
                  borderRadius: theme.borderRadius ? 6 : 0,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.badgeText,
                    fontSize: 11,
                    fontFamily: theme.isMono ? 'Courier' : undefined,
                    fontWeight: '600',
                  }}
                >
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
              placeholderTextColor={theme.colors.inputPlaceholder}
              multiline
              numberOfLines={4}
              style={{
                minHeight: 80,
                textAlignVertical: 'top',
                backgroundColor: theme.colors.inputBg,
                borderColor: theme.colors.inputBorder,
                borderWidth: 1,
                borderRadius: theme.borderRadius ? 8 : 0,
                color: theme.colors.inputText,
                fontFamily: theme.isMono ? 'Courier' : undefined,
                padding: 10,
                fontSize: 12,
                marginBottom: 12,
              }}
            />

            <View className="flex-row justify-end items-center gap-2">
              {isTextDirty && (
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontFamily: theme.isMono ? 'Courier' : undefined,
                    fontSize: 11,
                    marginRight: 6,
                  }}
                >
                  [UNSAVED]
                </Text>
              )}
              <Button
                variant="primary"
                loading={isSavingText}
                disabled={isSavingText}
                onPress={handleSaveText}
                className="h-8 px-4"
              >
                {theme.isUppercase ? 'SAVE NOTE' : 'Save Note'}
              </Button>
            </View>
          </View>
        </ScrollView>

        {/* Action Toolbar */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTopWidth: 1,
            borderTopColor: theme.colors.divider,
            paddingTop: 12,
          }}
        >
          <Label>{resource?.id ? `ID: ${resource.id.substring(0, 8)}...` : ''}</Label>

          <View className="flex-row space-x-2 gap-2">
            <Pressable
              onPress={handleRunOcr}
              disabled={isOcrRunning || !resource}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: theme.colors.secondaryButtonBg,
                borderColor: theme.colors.secondaryButtonBorder,
                borderWidth: 1,
                borderRadius: theme.borderRadius ? 8 : 0,
              }}
            >
              <Text
                style={{
                  color: theme.colors.secondaryButtonText,
                  fontFamily: theme.isMono ? 'Courier' : undefined,
                  fontSize: 11,
                  fontWeight: '600',
                }}
              >
                {isOcrRunning ? 'EXTRACTING...' : theme.isUppercase ? 'FULL OCR' : 'Full OCR'}
              </Text>
            </Pressable>

            {onDelete && resource && (
              <Pressable
                onPress={handleDelete}
                disabled={isDeleting}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: theme.colors.destructiveButtonBg,
                  borderColor: theme.colors.destructiveButtonBorder,
                  borderWidth: 1,
                  borderRadius: theme.borderRadius ? 8 : 0,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.destructiveButtonText,
                    fontFamily: theme.isMono ? 'Courier' : undefined,
                    fontSize: 11,
                    fontWeight: '600',
                  }}
                >
                  {isDeleting ? 'SHREDDING...' : theme.isUppercase ? 'SHRED' : 'Shred'}
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
