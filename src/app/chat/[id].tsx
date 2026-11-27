import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { eq } from 'drizzle-orm';
import { useSessionStore } from '@/stores/useSessionStore';
import { getDatabase } from '@/db/client';
import { Person, Photo, photos } from '@/db/schema';
import { getPersonById, decryptPersonAvatarUri } from '@/services/persons/personService';
import {
  getChatMessages,
  sendChatMessage,
  retryAssistantReply,
  deleteChatMessage,
  clearPersonChat,
  sendFitCheckForLook,
} from '@/services/chat/chatService';
import { ChatAttachmentInput, DecryptedChatMessage } from '@/services/chat/types';
import { useChatDraftStore } from '@/services/chat/chatDraftStore';
import { getOotdPreferences } from '@/services/settings/ootdPreferences';
import { bulkMovePhotoKind } from '@/services/photos/photoService';
import { DecryptedOotdLook, OutfitSlotKey } from '@/engine/types';
import { swapOutfitSlot } from '@/engine/outfitPicker';
import { updateOotdLookSlots, toggleLookFavorite, markLookWornToday } from '@/engine/lookbookStore';
import { buildQuickSlotsCommandText } from '@/engine/constraintParser';
import {
  ChatBubble,
  ChatComposer,
  OotdQuickBuilderSheet,
  PhotoPickerModal,
  StagedAttachmentPreview,
} from '@/components/chat';
import { PhotoDetailModal } from '@/components/photos';
import { PersonFormModal } from '@/components/persons';
import { PersonalityMemoryModal } from '@/components/settings';
import { useTheme } from '@/theme';

export default function ChatDetailScreen() {
  const { id: personId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const appSessionKey = useSessionStore((state) => state.appSessionKey);

  const draftText = useChatDraftStore((s) => (personId ? (s.drafts[personId] ?? '') : ''));
  const setDraft = useChatDraftStore((s) => s.setDraft);
  const clearDraft = useChatDraftStore((s) => s.clearDraft);

  const [person, setPerson] = useState<Person | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [messages, setMessages] = useState<DecryptedChatMessage[]>([]);
  const [unveilDefault, setUnveilDefault] = useState(true);
  const [cooldownDays, setCooldownDays] = useState(3);

  const [stagedAttachment, setStagedAttachment] = useState<{
    input: ChatAttachmentInput;
    preview: StagedAttachmentPreview;
  } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [failedMsgIds, setFailedMsgIds] = useState<Record<string, boolean>>({});
  const [undoMovedPhotoId, setUndoMovedPhotoId] = useState<string | null>(null);

  const [isQuickBuilderOpen, setIsQuickBuilderOpen] = useState(false);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [inspectPhoto, setInspectPhoto] = useState<Photo | null>(null);
  const [isEditPersonOpen, setIsEditPersonOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);

  const flatListRef = useRef<FlatList<DecryptedChatMessage>>(null);

  const loadChat = useCallback(async () => {
    if (!personId || !appSessionKey) return;
    const [p, msgs, prefs] = await Promise.all([
      getPersonById(personId),
      getChatMessages(personId, appSessionKey),
      getOotdPreferences(),
    ]);
    setPerson(p);
    setMessages(msgs);
    setUnveilDefault(prefs.unveilModeDefault);
    setCooldownDays(prefs.cooldownDays);

    if (p && p.avatarThumbPath) {
      decryptPersonAvatarUri(p, appSessionKey)
        .then((u) => setAvatarUri(u))
        .catch(() => setAvatarUri(null));
    } else {
      setAvatarUri(null);
    }
  }, [personId, appSessionKey]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  const handleSend = async (
    overrideText?: string,
    overrideSlots?: OutfitSlotKey[],
    forceStyleMode?: 'random' | 'ai',
  ) => {
    if (!personId || !appSessionKey || isSending) return;
    const textToSend = overrideText !== undefined ? overrideText : draftText;
    if (!textToSend.trim() && !stagedAttachment && !overrideSlots?.length) return;

    setIsSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const attachmentInput = stagedAttachment?.input ?? null;
    if (overrideText === undefined) {
      clearDraft(personId);
    }
    setStagedAttachment(null);

    try {
      const res = await sendChatMessage({
        personId,
        text: textToSend,
        attachment: attachmentInput,
        overrideSlots,
        forceStyleMode,
        sessionKey: appSessionKey,
      });

      if (res.autoMovedToPastOotdPhotoId) {
        setUndoMovedPhotoId(res.autoMovedToPastOotdPhotoId);
      }

      if (res.error) {
        setFailedMsgIds((prev) => ({ ...prev, [res.userMessage.id]: true }));
      }

      await loadChat();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      Alert.alert('Message Error', err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleRetryMessage = async (msg: DecryptedChatMessage) => {
    if (!personId || !appSessionKey || isSending) return;
    setIsSending(true);
    try {
      const res = await retryAssistantReply({
        personId,
        userMessage: msg,
        sessionKey: appSessionKey,
      });
      if (!res.error) {
        setFailedMsgIds((prev) => {
          const next = { ...prev };
          delete next[msg.id];
          return next;
        });
      }
      await loadChat();
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenAttachmentMenu = () => {
    Alert.alert('Attach Private Photo', 'Photos stay encrypted inside the app.', [
      {
        text: 'Take Private Photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
          if (!res.canceled && res.assets[0]?.uri) {
            setStagedAttachment({
              input: { kind: 'new_photo', uri: res.assets[0].uri },
              preview: { uri: res.assets[0].uri, label: 'Private Camera Capture' },
            });
          }
        },
      },
      {
        text: 'Import from Library',
        onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,
          });
          if (!res.canceled && res.assets[0]?.uri) {
            setStagedAttachment({
              input: { kind: 'new_photo', uri: res.assets[0].uri },
              preview: { uri: res.assets[0].uri, label: 'Imported Photo' },
            });
          }
        },
      },
      {
        text: 'Pick from App Photos',
        onPress: () => setIsPhotoPickerOpen(true),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSwapSlot = async (look: DecryptedOotdLook, slotKey: OutfitSlotKey) => {
    if (!appSessionKey) return;
    const swapped = await swapOutfitSlot({
      existingSlots: look.slots,
      targetSlot: slotKey,
      cooldownDays,
      sessionKey: appSessionKey,
    });
    if (swapped.swappedSelection) {
      await updateOotdLookSlots(look.id, swapped.updatedSlots, appSessionKey);
      Haptics.selectionAsync().catch(() => {});
      await loadChat();
    }
  };

  const handleRerollUnlocked = async (look: DecryptedOotdLook, lockedSlots: OutfitSlotKey[]) => {
    if (!appSessionKey) return;
    let workingSlots = [...look.slots];
    for (const s of look.slots) {
      if (!lockedSlots.includes(s.slot)) {
        const res = await swapOutfitSlot({
          existingSlots: workingSlots,
          targetSlot: s.slot,
          cooldownDays,
          sessionKey: appSessionKey,
        });
        workingSlots = res.updatedSlots;
      }
    }
    await updateOotdLookSlots(look.id, workingSlots, appSessionKey);
    Haptics.selectionAsync().catch(() => {});
    await loadChat();
  };

  const handleToggleFavorite = async (look: DecryptedOotdLook) => {
    await toggleLookFavorite(look.id, !look.isFavorite);
    Haptics.selectionAsync().catch(() => {});
    await loadChat();
  };

  const handleMarkWorn = async (look: DecryptedOotdLook) => {
    const ids = look.slots.map((s) => s.photoId).filter((id): id is string => Boolean(id));
    await markLookWornToday(look.id, ids);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await loadChat();
  };

  const handleSendFitCheck = async (look: DecryptedOotdLook) => {
    if (!personId || !appSessionKey) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera Required', 'Camera permission is needed for a private Fit Check.');
      return;
    }
    const capture = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (capture.canceled || !capture.assets[0]?.uri) return;

    setIsSending(true);
    try {
      await sendFitCheckForLook({
        personId,
        look,
        photoUri: capture.assets[0].uri,
        sessionKey: appSessionKey,
      });
      await loadChat();
    } finally {
      setIsSending(false);
    }
  };

  const handlePressSlotPhoto = async (photoId: string) => {
    const db = await getDatabase();
    const rows = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
    if (rows[0]) {
      setInspectPhoto(rows[0]);
    }
  };

  const initials = (person?.name ?? 'AI')
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable
              onPress={() => setIsEditPersonOpen(true)}
              className="flex-row items-center gap-2"
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: 28, height: 28, borderRadius: 14 }}
                />
              ) : null}
              <View>
                <Text style={{ color: theme.colors.headerText, fontWeight: '700', fontSize: 15 }}>
                  {person?.name ?? 'Stylist'}
                </Text>
                {person?.bio ? (
                  <Text style={{ color: theme.colors.textMuted, fontSize: 10 }} numberOfLines={1}>
                    {person.bio}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ),
          headerRight: () => (
            <View className="flex-row gap-3">
              <Pressable onPress={() => setIsMemoryOpen(true)}>
                <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '600' }}>
                  Memory
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!personId) return;
                  Alert.alert('Clear Chat', `Delete all messages with ${person?.name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: async () => {
                        await clearPersonChat(personId);
                        await loadChat();
                      },
                    },
                  ]);
                }}
              >
                <Text style={{ color: theme.colors.destructiveButtonText, fontSize: 12 }}>
                  Clear
                </Text>
              </Pressable>
            </View>
          ),
        }}
      />

      {undoMovedPhotoId && (
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.accent,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
          className="flex-row justify-between items-center"
        >
          <Text style={{ color: theme.colors.textPrimary, fontSize: 11, flex: 1 }}>
            Photo auto-filed to Past OOTD (body detected)
          </Text>
          <View className="flex-row gap-3">
            <Pressable onPress={() => router.push('/(tabs)/past-ootd')}>
              <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 11 }}>
                View
              </Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                await bulkMovePhotoKind([undoMovedPhotoId], 'wardrobe');
                setUndoMovedPhotoId(null);
              }}
            >
              <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 11 }}>
                Undo
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingVertical: 14, flexGrow: 1 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8 py-16">
            <Text
              style={{
                color: theme.colors.textMuted,
                textAlign: 'center',
                fontSize: 13,
              }}
            >
              Say hello to {person?.name ?? 'your stylist'}, share a photo, or tap ✨ OOTD for your
              daily look.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ChatBubble
            message={item}
            personInitials={initials}
            personAvatarUri={avatarUri}
            sessionKey={appSessionKey}
            unveilModeDefault={unveilDefault}
            hasRetry={Boolean(failedMsgIds[item.id])}
            onRetry={handleRetryMessage}
            onPressPhoto={(p) => setInspectPhoto(p)}
            onPressSlotPhoto={handlePressSlotPhoto}
            onLongPress={(msg) => {
              Alert.alert('Delete Message', 'Remove this message?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteChatMessage(msg.id);
                    await loadChat();
                  },
                },
              ]);
            }}
            onSwapSlot={handleSwapSlot}
            onRerollUnlocked={handleRerollUnlocked}
            onToggleFavorite={handleToggleFavorite}
            onMarkWorn={handleMarkWorn}
            onSendFitCheck={handleSendFitCheck}
          />
        )}
        ListFooterComponent={
          isSending ? (
            <View className="px-4 py-2">
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontStyle: 'italic' }}>
                {person?.name ?? 'Stylist'} is styling...
              </Text>
            </View>
          ) : undefined
        }
      />

      <ChatComposer
        text={draftText}
        onChangeText={(val) => personId && setDraft(personId, val)}
        stagedAttachment={stagedAttachment?.preview ?? null}
        onClearAttachment={() => setStagedAttachment(null)}
        onOpenAttachmentMenu={handleOpenAttachmentMenu}
        onOpenQuickBuilder={() => setIsQuickBuilderOpen(true)}
        onQuickCommand={(cmd) => handleSend(cmd)}
        onSend={() => handleSend()}
        isSending={isSending}
      />

      <OotdQuickBuilderSheet
        visible={isQuickBuilderOpen}
        onClose={() => setIsQuickBuilderOpen(false)}
        onSubmit={(slots, mode, note) => {
          const cmdText = buildQuickSlotsCommandText(slots, mode, note);
          handleSend(cmdText, slots, mode);
        }}
      />

      <PhotoPickerModal
        visible={isPhotoPickerOpen}
        sessionKey={appSessionKey}
        onClose={() => setIsPhotoPickerOpen(false)}
        onSelectPhoto={(photo) => {
          setStagedAttachment({
            input: { kind: 'existing_photo', photoId: photo.id },
            preview: {
              existingPhoto: photo,
              label: `App Photo (${photo.category})`,
            },
          });
        }}
      />

      <PhotoDetailModal
        visible={Boolean(inspectPhoto)}
        photo={inspectPhoto}
        sessionKey={appSessionKey}
        onClose={() => setInspectPhoto(null)}
        onUpdated={loadChat}
      />

      <PersonFormModal
        visible={isEditPersonOpen}
        person={person}
        sessionKey={appSessionKey}
        onClose={() => setIsEditPersonOpen(false)}
        onSaved={() => loadChat()}
        onOpenMemory={() => setIsMemoryOpen(true)}
      />

      <PersonalityMemoryModal
        visible={isMemoryOpen}
        person={person}
        onClose={() => setIsMemoryOpen(false)}
        onSaved={loadChat}
      />
    </KeyboardAvoidingView>
  );
}
