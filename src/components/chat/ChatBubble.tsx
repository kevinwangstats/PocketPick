import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Buffer } from '@craftzdog/react-native-buffer';
import { Photo } from '../../db/schema';
import { DecryptedChatMessage } from '../../services/chat/types';
import { DecryptedOotdLook, OutfitSlotKey } from '../../engine/types';
import { decryptImageBuffer } from '../../services/media/imagePipeline';
import { getCachedThumbnail, setCachedThumbnail } from '../../services/media/thumbnailCache';
import { OotdLookCard } from './OotdLookCard';
import { useTheme } from '../../theme';

export interface ChatBubbleProps {
  message: DecryptedChatMessage;
  personInitials: string;
  personAvatarUri: string | null;
  sessionKey: Buffer | null;
  unveilModeDefault: boolean;
  hasRetry?: boolean;
  onRetry?: (message: DecryptedChatMessage) => void;
  onPressPhoto?: (photo: Photo) => void;
  onPressSlotPhoto?: (photoId: string) => void;
  onLongPress?: (message: DecryptedChatMessage) => void;
  onSwapSlot: (look: DecryptedOotdLook, slot: OutfitSlotKey) => Promise<void>;
  onRerollUnlocked: (look: DecryptedOotdLook, lockedSlots: OutfitSlotKey[]) => Promise<void>;
  onToggleFavorite: (look: DecryptedOotdLook) => Promise<void>;
  onMarkWorn: (look: DecryptedOotdLook) => Promise<void>;
  onSendFitCheck: (look: DecryptedOotdLook) => Promise<void>;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  personInitials,
  personAvatarUri,
  sessionKey,
  unveilModeDefault,
  hasRetry = false,
  onRetry,
  onPressPhoto,
  onPressSlotPhoto,
  onLongPress,
  onSwapSlot,
  onRerollUnlocked,
  onToggleFavorite,
  onMarkWorn,
  onSendFitCheck,
}) => {
  const { theme } = useTheme();
  const isUser = message.role === 'user';
  const [photoThumbUri, setPhotoThumbUri] = useState<string | null>(() =>
    message.photo ? (getCachedThumbnail(message.photo.id) ?? null) : null,
  );

  useEffect(() => {
    let cancelled = false;
    const photo = message.photo;
    if (!photo || photoThumbUri || !sessionKey) return;

    decryptImageBuffer({
      encryptedPath: photo.encryptedThumbnailPath,
      iv: photo.thumbnailIv,
      tag: photo.thumbnailTag,
      sessionKey,
      aad: photo.id,
    })
      .then((buf) => {
        if (!cancelled) {
          const uri = `data:image/jpeg;base64,${buf.toString('base64')}`;
          setCachedThumbnail(photo.id, uri);
          setPhotoThumbUri(uri);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [message.photo, photoThumbUri, sessionKey]);

  const timeLabel = message.createdAt.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
        marginBottom: 12,
        paddingHorizontal: 12,
      }}
    >
      {!isUser && (
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: theme.borderRadius ? 15 : 0,
            backgroundColor: theme.colors.badgeBg,
            borderColor: theme.colors.accent,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            marginRight: 8,
          }}
        >
          {personAvatarUri ? (
            <Image
              source={{ uri: personAvatarUri }}
              style={{ width: 30, height: 30 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '700' }}>
              {personInitials}
            </Text>
          )}
        </View>
      )}

      <Pressable
        onLongPress={() => onLongPress?.(message)}
        style={{
          maxWidth: '82%',
          backgroundColor: isUser ? theme.colors.accent : theme.colors.card,
          borderColor: isUser ? theme.colors.accent : theme.colors.cardBorder,
          borderWidth: 1,
          borderRadius: theme.borderRadius ? 16 : 0,
          padding: 11,
        }}
      >
        {/* Inline Encrypted Photo Thumbnail */}
        {message.photo && photoThumbUri && (
          <Pressable
            onPress={() => onPressPhoto?.(message.photo!)}
            style={{
              marginBottom: 6,
              borderRadius: theme.borderRadius ? 10 : 0,
              overflow: 'hidden',
            }}
          >
            <Image
              source={{ uri: photoThumbUri }}
              style={{ width: 200, height: 200 }}
              resizeMode="cover"
            />
          </Pressable>
        )}

        <Text
          style={{
            color: isUser ? theme.colors.accentText : theme.colors.textPrimary,
            fontSize: 14,
            lineHeight: 20,
            fontFamily: theme.isMono ? 'Courier' : undefined,
          }}
        >
          {message.text}
        </Text>

        {/* Embedded Interactive OOTD Look Card */}
        {message.ootdLook && (
          <OotdLookCard
            look={message.ootdLook}
            sessionKey={sessionKey}
            unveilModeDefault={unveilModeDefault}
            onSwapSlot={onSwapSlot}
            onRerollUnlocked={onRerollUnlocked}
            onToggleFavorite={onToggleFavorite}
            onMarkWorn={onMarkWorn}
            onSendFitCheck={onSendFitCheck}
            onPressSlotPhoto={onPressSlotPhoto}
          />
        )}

        <View className="flex-row justify-between items-center mt-1.5 gap-3">
          <Text
            style={{
              color: isUser ? theme.colors.accentText : theme.colors.textMuted,
              opacity: isUser ? 0.8 : 1,
              fontSize: 10,
            }}
          >
            {timeLabel}
          </Text>
          {hasRetry && onRetry && (
            <Pressable onPress={() => onRetry(message)}>
              <Text
                style={{
                  color: isUser ? theme.colors.accentText : theme.colors.accent,
                  fontSize: 11,
                  fontWeight: '700',
                  textDecorationLine: 'underline',
                }}
              >
                Retry
              </Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </View>
  );
};
