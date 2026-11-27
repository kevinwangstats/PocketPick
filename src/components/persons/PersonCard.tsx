import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, Image, Animated, PanResponder } from 'react-native';
import { Buffer } from '@craftzdog/react-native-buffer';
import { Person } from '../../db/schema';
import { decryptPersonAvatarUri } from '../../services/persons/personService';
import { useTheme } from '../../theme';

const DELETE_REVEAL_WIDTH = 86;

export interface PersonCardProps {
  person: Person;
  sessionKey: Buffer | null;
  lastMessagePreview?: string | null;
  lastMessageTime?: Date | null;
  onPress: () => void;
  onEditPress: () => void;
  onDeletePress: () => void;
}

function formatRelativeTime(date?: Date | null): string {
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const PersonCard: React.FC<PersonCardProps> = ({
  person,
  sessionKey,
  lastMessagePreview,
  lastMessageTime,
  onPress,
  onEditPress,
  onDeletePress,
}) => {
  const { theme } = useTheme();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!sessionKey || !person.avatarThumbPath) {
      setAvatarUri(null);
      return;
    }

    decryptPersonAvatarUri(person, sessionKey)
      .then((uri) => {
        if (!cancelled) setAvatarUri(uri);
      })
      .catch(() => {
        if (!cancelled) setAvatarUri(null);
      });

    return () => {
      cancelled = true;
    };
  }, [person, sessionKey]);

  const snapTo = (toValue: number) => {
    isOpenRef.current = toValue !== 0;
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_evt, gesture) => {
        const base = isOpenRef.current ? -DELETE_REVEAL_WIDTH : 0;
        const next = Math.max(-DELETE_REVEAL_WIDTH, Math.min(0, base + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx < -35 || (isOpenRef.current && gesture.dx < 20)) {
          snapTo(-DELETE_REVEAL_WIDTH);
        } else {
          snapTo(0);
        }
      },
    }),
  ).current;

  const initials = person.name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  return (
    <View
      style={{
        marginBottom: 10,
        borderRadius: theme.borderRadius ? 14 : 0,
        overflow: 'hidden',
        backgroundColor: theme.colors.destructiveButtonBg,
      }}
    >
      {/* Revealed Swipe Delete Action */}
      <Pressable
        onPress={() => {
          snapTo(0);
          onDeletePress();
        }}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: DELETE_REVEAL_WIDTH,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.destructiveButtonBg,
        }}
      >
        <Text
          style={{ color: theme.colors.destructiveButtonText, fontWeight: '700', fontSize: 12 }}
        >
          DELETE
        </Text>
      </Pressable>

      {/* Foreground Card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          transform: [{ translateX }],
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.cardBorder,
          borderWidth: 1,
          borderRadius: theme.borderRadius ? 14 : 0,
        }}
      >
        <Pressable
          onPress={() => {
            if (isOpenRef.current) {
              snapTo(0);
            } else {
              onPress();
            }
          }}
          onLongPress={onEditPress}
          className="flex-row items-center p-3.5 active:opacity-85"
        >
          {/* Circular Portrait Avatar */}
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: theme.borderRadius ? 26 : 0,
              backgroundColor: theme.colors.badgeBg,
              borderColor: theme.colors.accent,
              borderWidth: 1.5,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              marginRight: 12,
            }}
          >
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={{ width: 52, height: 52 }}
                resizeMode="cover"
              />
            ) : (
              <Text
                style={{
                  color: theme.colors.accent,
                  fontWeight: '700',
                  fontSize: 18,
                  fontFamily: theme.isMono ? 'Courier' : undefined,
                }}
              >
                {initials}
              </Text>
            )}
          </View>

          {/* Name, Bio, Last Message */}
          <View className="flex-1 pr-2">
            <View className="flex-row justify-between items-center mb-0.5">
              <Text
                style={{
                  color: theme.colors.textPrimary,
                  fontWeight: '700',
                  fontSize: 16,
                  fontFamily: theme.isMono ? 'Courier' : undefined,
                }}
                numberOfLines={1}
              >
                {person.name}
              </Text>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: 11,
                  fontFamily: theme.isMono ? 'Courier' : undefined,
                }}
              >
                {formatRelativeTime(lastMessageTime ?? person.updatedAt)}
              </Text>
            </View>

            {person.bio && (
              <Text
                style={{
                  color: theme.colors.accent,
                  fontSize: 11,
                  fontWeight: '600',
                  marginBottom: 2,
                }}
                numberOfLines={1}
              >
                {person.bio}
              </Text>
            )}

            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: 12,
              }}
              numberOfLines={1}
            >
              {lastMessagePreview || 'Tap to start styling or send /ootd...'}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
};
