import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, Pressable } from 'react-native';
import { Buffer } from '@craftzdog/react-native-buffer';
import { DecryptedOotdLook, OotdSlotSelection } from '../../engine/types';
import { decryptImageBuffer } from '../../services/media/imagePipeline';
import { getCachedThumbnail, setCachedThumbnail } from '../../services/media/thumbnailCache';
import { Card } from '../ui';
import { useTheme } from '../../theme';

export interface LookbookCardProps {
  look: DecryptedOotdLook;
  personName: string;
  sessionKey: Buffer | null;
  onToggleFavorite: (look: DecryptedOotdLook) => void;
  onJumpToChat: (personId: string) => void;
}

const LookbookThumb: React.FC<{
  slot: OotdSlotSelection;
  sessionKey: Buffer | null;
}> = ({ slot, sessionKey }) => {
  const { theme } = useTheme();
  const [uri, setUri] = useState<string | null>(() =>
    slot.photoId ? (getCachedThumbnail(slot.photoId) ?? null) : null,
  );

  useEffect(() => {
    let cancelled = false;
    if (
      uri ||
      slot.isMissing ||
      !slot.photoId ||
      !slot.thumbnailPath ||
      !slot.thumbnailIv ||
      !slot.thumbnailTag ||
      !sessionKey
    ) {
      return;
    }

    decryptImageBuffer({
      encryptedPath: slot.thumbnailPath,
      iv: slot.thumbnailIv,
      tag: slot.thumbnailTag,
      sessionKey,
      aad: slot.photoId,
    })
      .then((buf) => {
        if (!cancelled) {
          const dataUri = `data:image/jpeg;base64,${buf.toString('base64')}`;
          if (slot.photoId) setCachedThumbnail(slot.photoId, dataUri);
          setUri(dataUri);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [slot, sessionKey, uri]);

  return (
    <View style={{ width: 68, alignItems: 'center' }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: theme.borderRadius ? 8 : 0,
          backgroundColor: theme.colors.badgeBg,
          borderColor: theme.colors.cardBorder,
          borderWidth: 1,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {slot.isMissing ? (
          <Text style={{ color: theme.colors.textMuted, fontSize: 9, textAlign: 'center' }}>
            Removed
          </Text>
        ) : uri ? (
          <Image source={{ uri }} style={{ width: 64, height: 64 }} resizeMode="cover" />
        ) : (
          <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>...</Text>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: theme.colors.textSecondary,
          fontSize: 10,
          marginTop: 3,
          textTransform: 'capitalize',
        }}
      >
        {slot.itemLabel}
      </Text>
    </View>
  );
};

export const LookbookCard: React.FC<LookbookCardProps> = ({
  look,
  personName,
  sessionKey,
  onToggleFavorite,
  onJumpToChat,
}) => {
  const { theme } = useTheme();
  const dateLabel = (look.wornAt ?? look.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card className="p-3.5 mb-3">
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center gap-2">
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontWeight: '700',
              fontSize: 14,
            }}
          >
            Styled by {personName}
          </Text>
          <View
            style={{
              backgroundColor: theme.colors.badgeBg,
              borderRadius: theme.borderRadius ? 6 : 0,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: theme.colors.badgeText, fontSize: 9, fontWeight: '700' }}>
              {look.triggerType.toUpperCase()}
            </Text>
          </View>
        </View>

        <Pressable onPress={() => onToggleFavorite(look)} hitSlop={8}>
          <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '700' }}>
            {look.isFavorite ? '♥ Saved' : '♡ Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
        <View className="flex-row gap-2">
          {look.slots.map((slot) => (
            <LookbookThumb key={`${look.id}-${slot.slot}`} slot={slot} sessionKey={sessionKey} />
          ))}
        </View>
      </ScrollView>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.colors.divider,
          paddingTop: 8,
        }}
        className="flex-row justify-between items-center"
      >
        <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
          {look.wornAt ? `Worn ${dateLabel}` : `Created ${dateLabel}`}
          {look.fitcheckPhotoId ? ' • Fit Check ✓' : ''}
        </Text>
        <Pressable onPress={() => onJumpToChat(look.personId)}>
          <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '600' }}>
            Open Chat →
          </Text>
        </Pressable>
      </View>
    </Card>
  );
};
