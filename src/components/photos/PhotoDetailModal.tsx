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
import * as Haptics from 'expo-haptics';
import { Buffer } from '@craftzdog/react-native-buffer';
import { Photo, PhotoKind, WardrobeCategory, WARDROBE_CATEGORIES } from '../../db/schema';
import { decryptImageBuffer } from '../../services/media/imagePipeline';
import {
  getDecryptedPhotoMetadata,
  savePhotoMetadata,
  analyzeAndClassifyPhoto,
  movePhotoKind,
} from '../../services/photos/photoService';
import { CANONICAL_ITEM_CHIPS } from '../../services/photos/types';
import { isOpenRouterKeyConfigured } from '../../services/llm/llmKeyStore';
import { Label, ErrorText, Button } from '../ui';
import { useTheme } from '../../theme';

export interface PhotoDetailModalProps {
  visible: boolean;
  photo: Photo | null;
  sessionKey: Buffer | null;
  onClose: () => void;
  onDelete?: (photoId: string) => Promise<void>;
  onUpdated?: () => Promise<void>;
}

export const PhotoDetailModal: React.FC<PhotoDetailModalProps> = ({
  visible,
  photo,
  sessionKey,
  onClose,
  onDelete,
  onUpdated,
}) => {
  const { theme } = useTheme();
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<WardrobeCategory>('others');
  const [photoKind, setPhotoKind] = useState<PhotoKind>('wardrobe');
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadContent() {
      if (!visible || !photo || !sessionKey) {
        setDataUri(null);
        setIsDirty(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const meta = getDecryptedPhotoMetadata(photo, sessionKey);
        if (!isCancelled) {
          setCategory(photo.category);
          setPhotoKind(photo.photoKind);
          setItemName(meta.item);
          setDescription(meta.description);
          setIsDirty(false);
        }

        const decryptedBytes = await decryptImageBuffer({
          encryptedPath: photo.encryptedFilePath,
          iv: photo.fileIv,
          tag: photo.fileTag,
          sessionKey,
          aad: photo.id,
        });

        if (!isCancelled) {
          setDataUri(`data:image/jpeg;base64,${decryptedBytes.toString('base64')}`);
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
      setDataUri(null);
    };
  }, [visible, photo, sessionKey]);

  const handleSave = async () => {
    if (!photo || !sessionKey) return;
    setIsSaving(true);
    try {
      await savePhotoMetadata(
        photo.id,
        {
          category,
          photoKind,
          item: itemName,
          description,
        },
        sessionKey,
      );
      setIsDirty(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await onUpdated?.();
      Alert.alert('Saved', 'Photo metadata encrypted and saved.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save metadata');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!photo || !sessionKey) return;
    const hasKey = await isOpenRouterKeyConfigured();
    if (!hasKey) {
      Alert.alert(
        'OpenRouter Key Needed',
        'Add your OpenRouter API key in Settings to use AI suggestions.',
      );
      return;
    }

    setIsSuggesting(true);
    try {
      const classified = await analyzeAndClassifyPhoto(photo, sessionKey);
      setCategory(classified.category);
      if (classified.item) setItemName(classified.item);
      if (classified.description) setDescription(classified.description);
      setPhotoKind(classified.photoKind);
      setIsDirty(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      Alert.alert('AI Assist Failed', err instanceof Error ? err.message : 'Unable to analyze');
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleToggleKind = async () => {
    if (!photo) return;
    const nextKind: PhotoKind = photoKind === 'wardrobe' ? 'past_ootd' : 'wardrobe';
    await movePhotoKind(photo.id, nextKind);
    setPhotoKind(nextKind);
    Haptics.selectionAsync().catch(() => {});
    await onUpdated?.();
  };

  const handleDelete = async () => {
    if (!photo || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(photo.id);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Delete error');
    } finally {
      setIsDeleting(false);
    }
  };

  const screenWidth = Dimensions.get('window').width;
  const quickChips = CANONICAL_ITEM_CHIPS[category] ?? [];

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
          <Label>
            {photoKind === 'wardrobe' ? 'WARDROBE ITEM (APP-ONLY)' : 'PAST OOTD PHOTO (APP-ONLY)'}
          </Label>
          <Pressable
            onPress={onClose}
            style={{
              backgroundColor: theme.colors.badgeBg,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 8 : 0,
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
          {/* Image Canvas */}
          <View
            style={{
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 12 : 0,
              marginBottom: 14,
              padding: 8,
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="large" color={theme.colors.accent} />
            ) : error ? (
              <ErrorText>{error}</ErrorText>
            ) : dataUri ? (
              <Image
                source={{ uri: dataUri }}
                style={{
                  width: screenWidth - 48,
                  height: Math.min(300, Math.floor(Dimensions.get('window').height * 0.34)),
                }}
                resizeMode="contain"
              />
            ) : null}
          </View>

          {/* Metadata Card */}
          <View
            style={{
              padding: 14,
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 12 : 0,
              marginBottom: 14,
            }}
          >
            <View className="flex-row justify-between items-center mb-2">
              <Label>CATEGORY (STRICT)</Label>
              <Pressable
                onPress={handleToggleKind}
                style={{
                  backgroundColor: theme.colors.badgeBg,
                  borderColor: theme.colors.cardBorder,
                  borderWidth: 1,
                  borderRadius: theme.borderRadius ? 8 : 0,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.badgeText,
                    fontSize: 10,
                    fontWeight: '700',
                  }}
                >
                  {photoKind === 'wardrobe' ? 'Move to Past OOTD' : 'Move to Wardrobe'}
                </Text>
              </Pressable>
            </View>

            {/* 5 Allowable Categories */}
            <View className="flex-row flex-wrap gap-1.5 mb-4">
              {WARDROBE_CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      setCategory(cat);
                      setIsDirty(true);
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: theme.borderRadius ? 14 : 0,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                      backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.inputBg,
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? theme.colors.accent : theme.colors.textPrimary,
                        fontSize: 11,
                        fontWeight: isSelected ? '700' : '500',
                        textTransform: 'capitalize',
                      }}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Item Field */}
            <Label className="mb-1.5">ITEM</Label>
            <TextInput
              value={itemName}
              onChangeText={(val) => {
                setItemName(val);
                setIsDirty(true);
              }}
              placeholder="e.g. tshirt, pants, lace bra, panties..."
              placeholderTextColor={theme.colors.inputPlaceholder}
              style={{
                backgroundColor: theme.colors.inputBg,
                borderColor: theme.colors.inputBorder,
                borderWidth: 1,
                borderRadius: theme.borderRadius ? 8 : 0,
                color: theme.colors.inputText,
                paddingHorizontal: 10,
                paddingVertical: 8,
                fontSize: 13,
                marginBottom: 8,
              }}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-1.5">
                {quickChips.map((chip) => (
                  <Pressable
                    key={chip}
                    onPress={() => {
                      setItemName(chip);
                      setIsDirty(true);
                    }}
                    style={{
                      backgroundColor: theme.colors.badgeBg,
                      borderColor: theme.colors.cardBorder,
                      borderWidth: 1,
                      borderRadius: theme.borderRadius ? 10 : 0,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ color: theme.colors.badgeText, fontSize: 11 }}>{chip}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Descriptions Field + AI Suggestion */}
            <View className="flex-row justify-between items-center mb-1.5">
              <Label>DESCRIPTIONS</Label>
              <Pressable
                onPress={handleAiSuggest}
                disabled={isSuggesting || !dataUri}
                style={{
                  backgroundColor: theme.colors.badgeBg,
                  borderColor: theme.colors.accent,
                  borderWidth: 1,
                  borderRadius: theme.borderRadius ? 8 : 0,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  opacity: isSuggesting ? 0.6 : 1,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.accent,
                    fontSize: 11,
                    fontWeight: '700',
                  }}
                >
                  {isSuggesting ? 'Analyzing...' : 'AI Suggestion'}
                </Text>
              </Pressable>
            </View>

            <TextInput
              value={description}
              onChangeText={(val) => {
                setDescription(val);
                setIsDirty(true);
              }}
              placeholder="Type color, fabric, fit, or tap AI Suggestion to auto-fill..."
              placeholderTextColor={theme.colors.inputPlaceholder}
              multiline
              numberOfLines={4}
              style={{
                minHeight: 88,
                textAlignVertical: 'top',
                backgroundColor: theme.colors.inputBg,
                borderColor: theme.colors.inputBorder,
                borderWidth: 1,
                borderRadius: theme.borderRadius ? 8 : 0,
                color: theme.colors.inputText,
                padding: 10,
                fontSize: 12,
                marginBottom: 12,
              }}
            />

            <View className="flex-row justify-between items-center">
              <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                {isDirty ? 'Unsaved edits' : 'Saved & encrypted'}
              </Text>
              <Button
                variant="primary"
                loading={isSaving}
                onPress={handleSave}
                className="h-9 px-5"
              >
                Save
              </Button>
            </View>
          </View>
        </ScrollView>

        {/* Footer Toolbar (Zero-Leak: No Raw Single-Photo Share Sheet) */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTopWidth: 1,
            borderTopColor: theme.colors.divider,
            paddingTop: 10,
          }}
        >
          <Label>APP-ONLY SANDBOX STORAGE</Label>
          {onDelete && photo && (
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
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >
                {isDeleting ? 'Shredding...' : 'Shred Photo'}
              </Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
