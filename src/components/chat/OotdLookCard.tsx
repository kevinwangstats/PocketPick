import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Buffer } from '@craftzdog/react-native-buffer';
import { DecryptedOotdLook, OotdSlotSelection, OutfitSlotKey } from '../../engine/types';
import { decryptImageBuffer } from '../../services/media/imagePipeline';
import { getCachedThumbnail, setCachedThumbnail } from '../../services/media/thumbnailCache';
import { useTheme } from '../../theme';

export interface OotdLookCardProps {
  look: DecryptedOotdLook;
  sessionKey: Buffer | null;
  unveilModeDefault?: boolean;
  onSwapSlot: (look: DecryptedOotdLook, slot: OutfitSlotKey) => Promise<void>;
  onRerollUnlocked: (look: DecryptedOotdLook, lockedSlots: OutfitSlotKey[]) => Promise<void>;
  onToggleFavorite: (look: DecryptedOotdLook) => Promise<void>;
  onMarkWorn: (look: DecryptedOotdLook) => Promise<void>;
  onSendFitCheck: (look: DecryptedOotdLook) => Promise<void>;
  onPressSlotPhoto?: (photoId: string) => void;
}

const SlotThumbnail: React.FC<{
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

  if (slot.isMissing) {
    return (
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: theme.borderRadius ? 8 : 0,
          backgroundColor: theme.colors.badgeBg,
          borderColor: theme.colors.cardBorder,
          borderWidth: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
        }}
      >
        <Text style={{ color: theme.colors.textMuted, fontSize: 9, textAlign: 'center' }}>
          Removed from Wardrobe
        </Text>
      </View>
    );
  }

  return uri ? (
    <Image
      source={{ uri }}
      style={{
        width: 72,
        height: 72,
        borderRadius: theme.borderRadius ? 8 : 0,
      }}
      resizeMode="cover"
    />
  ) : (
    <View
      style={{
        width: 72,
        height: 72,
        borderRadius: theme.borderRadius ? 8 : 0,
        backgroundColor: theme.colors.badgeBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>...</Text>
    </View>
  );
};

export const OotdLookCard: React.FC<OotdLookCardProps> = ({
  look,
  sessionKey,
  unveilModeDefault = true,
  onSwapSlot,
  onRerollUnlocked,
  onToggleFavorite,
  onMarkWorn,
  onSendFitCheck,
  onPressSlotPhoto,
}) => {
  const { theme } = useTheme();
  const [revealedSlots, setRevealedSlots] = useState<Record<string, boolean>>(() => {
    if (!unveilModeDefault) {
      const all: Record<string, boolean> = {};
      for (const s of look.slots) all[s.slot] = true;
      return all;
    }
    return {};
  });
  const [lockedSlots, setLockedSlots] = useState<OutfitSlotKey[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const allRevealed = look.slots.every((s) => Boolean(revealedSlots[s.slot]));

  const handleRevealSlot = (slotKey: OutfitSlotKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRevealedSlots((prev) => ({ ...prev, [slotKey]: true }));
  };

  const handleRevealAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const all: Record<string, boolean> = {};
    for (const s of look.slots) all[s.slot] = true;
    setRevealedSlots(all);
  };

  const toggleLock = (slotKey: OutfitSlotKey) => {
    Haptics.selectionAsync().catch(() => {});
    setLockedSlots((prev) =>
      prev.includes(slotKey) ? prev.filter((s) => s !== slotKey) : [...prev, slotKey],
    );
  };

  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.cardBorder,
        borderWidth: 1,
        borderRadius: theme.borderRadius ? 12 : 0,
        padding: 12,
        marginTop: 8,
      }}
    >
      {/* Card Header */}
      <View className="flex-row justify-between items-center mb-2.5">
        <Text
          style={{
            color: theme.colors.accent,
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            fontFamily: theme.isMono ? 'Courier' : undefined,
          }}
        >
          {look.triggerType === 'secret'
            ? 'Secret Underneath'
            : look.triggerType === 'style'
              ? 'Styled Look'
              : 'OOTD Pick'}
        </Text>

        {!allRevealed ? (
          <Pressable
            onPress={handleRevealAll}
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius: theme.borderRadius ? 10 : 0,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: theme.colors.accentText, fontSize: 10, fontWeight: '700' }}>
              Reveal All
            </Text>
          </Pressable>
        ) : (
          <Pressable
            disabled={isBusy}
            onPress={async () => {
              setIsBusy(true);
              try {
                await onRerollUnlocked(look, lockedSlots);
              } finally {
                setIsBusy(false);
              }
            }}
          >
            <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '600' }}>
              Re-roll Unlocked
            </Text>
          </Pressable>
        )}
      </View>

      {/* Skin-Outward Slot List */}
      <View className="gap-2">
        {look.slots.map((slot) => {
          const isRevealed = Boolean(revealedSlots[slot.slot]);
          const isLocked = lockedSlots.includes(slot.slot);

          if (!isRevealed) {
            return (
              <Pressable
                key={slot.slot}
                onPress={() => handleRevealSlot(slot.slot)}
                style={{
                  backgroundColor: theme.colors.badgeBg,
                  borderColor: theme.colors.cardBorder,
                  borderWidth: 1,
                  borderRadius: theme.borderRadius ? 10 : 0,
                  padding: 12,
                }}
                className="flex-row items-center justify-between active:opacity-80"
              >
                <View>
                  <Text
                    style={{
                      color: theme.colors.accent,
                      fontWeight: '700',
                      fontSize: 12,
                      textTransform: 'uppercase',
                    }}
                  >
                    {slot.slot}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                    Tap to unveil this piece
                  </Text>
                </View>
                <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '700' }}>
                  Unveil →
                </Text>
              </Pressable>
            );
          }

          return (
            <View
              key={slot.slot}
              style={{
                backgroundColor: theme.isDark ? '#000000' : theme.colors.background,
                borderColor: isLocked ? theme.colors.accent : theme.colors.cardBorder,
                borderWidth: 1,
                borderRadius: theme.borderRadius ? 10 : 0,
                padding: 8,
              }}
              className="flex-row items-center gap-2.5"
            >
              <Pressable
                onPress={() => {
                  if (slot.photoId && !slot.isMissing && onPressSlotPhoto) {
                    onPressSlotPhoto(slot.photoId);
                  }
                }}
              >
                <SlotThumbnail slot={slot} sessionKey={sessionKey} />
              </Pressable>

              <View className="flex-1">
                <Text
                  style={{
                    color: theme.colors.accent,
                    fontSize: 10,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                  }}
                >
                  {slot.slot}
                </Text>
                <Text
                  style={{
                    color: theme.colors.textPrimary,
                    fontSize: 13,
                    fontWeight: '700',
                    textTransform: 'capitalize',
                  }}
                  numberOfLines={1}
                >
                  {slot.itemLabel}
                </Text>
                {Boolean(slot.description) && (
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11 }} numberOfLines={2}>
                    {slot.description}
                  </Text>
                )}

                <View className="flex-row gap-3 mt-1.5">
                  <Pressable onPress={() => toggleLock(slot.slot)}>
                    <Text
                      style={{
                        color: isLocked ? theme.colors.accent : theme.colors.textMuted,
                        fontSize: 11,
                        fontWeight: '600',
                      }}
                    >
                      {isLocked ? 'Locked' : 'Lock'}
                    </Text>
                  </Pressable>
                  {!isLocked && (
                    <Pressable
                      disabled={isBusy}
                      onPress={async () => {
                        setIsBusy(true);
                        try {
                          await onSwapSlot(look, slot.slot);
                        } finally {
                          setIsBusy(false);
                        }
                      }}
                    >
                      <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '600' }}>
                        Swap
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Look Actions */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.colors.divider,
          marginTop: 10,
          paddingTop: 8,
        }}
        className="flex-row justify-between items-center flex-wrap gap-2"
      >
        <View className="flex-row gap-3">
          <Pressable onPress={() => onToggleFavorite(look)}>
            <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '700' }}>
              {look.isFavorite ? '♥ Saved Look' : '♡ Save Look'}
            </Text>
          </Pressable>
          <Pressable onPress={() => onMarkWorn(look)}>
            <Text
              style={{
                color: look.wornAt ? theme.colors.accent : theme.colors.textMuted,
                fontSize: 11,
                fontWeight: '600',
              }}
            >
              {look.wornAt ? '✓ Worn Today' : 'Worn Today'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => onSendFitCheck(look)}
          style={{
            backgroundColor: theme.colors.badgeBg,
            borderColor: theme.colors.accent,
            borderWidth: 1,
            borderRadius: theme.borderRadius ? 10 : 0,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '700' }}>
            Send Fit Check
          </Text>
        </Pressable>
      </View>
    </View>
  );
};
