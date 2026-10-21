import { resolveResourcePath } from '../../services/media/pathResolver';
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

  // AI Analysis modal state
  const [isAiModalVisible, setIsAiModalVisible] = useState(false);
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

        const resolvedFilePath = resolveResourcePath(resource.encryptedFilePath);
        if (!resolvedFilePath) {
          throw new Error('Unable to resolve photo file path');
        }
        const ciphertextBase64 = await FileSystem.readAsStringAsync(resolvedFilePath, {
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

  // AI Suggestion: decrypts photo in-memory -> sends to multimodal vision AI -> fills editable input
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
      // 1. Fetch the vault master prompt
      const masterPrompt = await getVaultMasterPrompt(resource.vaultId);

      // 2. Obtain image base64 for multimodal vision models (e.g. Kimi kimi-k2.6, Gemini)
      let imageBase64ToSend = dataUri ?? undefined;
      if (
        !imageBase64ToSend &&
        resource.encryptedThumbnailPath &&
        resource.thumbnailIv &&
        resource.thumbnailTag
      ) {
        const resolvedThumb = resolveResourcePath(resource.encryptedThumbnailPath);
        if (resolvedThumb) {
          const cipherB64 = await FileSystem.readAsStringAsync(resolvedThumb, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const decryptedBuf = decryptBuffer(
            {
              ciphertext: cipherB64,
              iv: resource.thumbnailIv,
              tag: resource.thumbnailTag,
            },
            vaultKey,
            resource.vaultId,
          );
          imageBase64ToSend = `data:image/jpeg;base64,${decryptedBuf.toString('base64')}`;
        }
      }

      // If full image is larger than 3MB, use thumbnail to avoid API payload limits
      if (
        imageBase64ToSend &&
        imageBase64ToSend.length > 3 * 1024 * 1024 &&
        resource.encryptedThumbnailPath &&
        resource.thumbnailIv &&
        resource.thumbnailTag
      ) {
        const resolvedThumb = resolveResourcePath(resource.encryptedThumbnailPath);
        if (resolvedThumb) {
          const cipherB64 = await FileSystem.readAsStringAsync(resolvedThumb, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const decryptedBuf = decryptBuffer(
            {
              ciphertext: cipherB64,
              iv: resource.thumbnailIv,
              tag: resource.thumbnailTag,
            },
            vaultKey,
            resource.vaultId,
          );
          imageBase64ToSend = `data:image/jpeg;base64,${decryptedBuf.toString('base64')}`;
        }
      }

      if (!imageBase64ToSend) {
        throw new Error('Image data is still loading. Please wait a moment and try again.');
      }

      // 3. Query LLM directly with the visual photo asset
      const prompt =
        'Analyze this photo carefully. Generate a concise title, short description, and key searchable tags for what is shown in the image:';

      const response = await queryLlm({
        userPrompt: prompt,
        imageBase64: imageBase64ToSend,
        masterPrompt,
      });

      if (response.content) {
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

        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
        >
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
                style={{
                  width: screenWidth - 48,
                  height: Math.min(340, Math.floor(Dimensions.get('window').height * 0.38)),
                }}
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
              onPress={() => setIsAiModalVisible(true)}
              disabled={!resource}
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
                {theme.isUppercase ? 'AI ANALYZE' : 'AI Analyze'}
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
          visible={isAiModalVisible}
          onClose={() => setIsAiModalVisible(false)}
          imageBase64={dataUri ?? undefined}
          vaultId={resource?.vaultId ?? ''}
          vaultKey={vaultKey}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
};
