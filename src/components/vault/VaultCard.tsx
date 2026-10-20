import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  PanResponder,
  StyleSheet,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, Label, Body } from '../ui';
import { useTheme } from '../../theme';

export interface VaultCardProps {
  id: string;
  name: string;
  description?: string | null;
  isUnlocked: boolean;
  onPress: () => void;
  onLockPress?: () => void;
  onDeletePress?: () => void;
}

const BUTTON_WIDTH = 84;

export const VaultCard: React.FC<VaultCardProps> = ({
  name,
  description,
  isUnlocked,
  onPress,
  onLockPress,
  onDeletePress,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);
  const [, setIsOpenState] = useState(false);
  const { theme } = useTheme();

  const openSwipe = () => {
    Animated.timing(translateX, {
      toValue: -BUTTON_WIDTH,
      duration: 160,
      useNativeDriver: true,
    }).start();
    isOpenRef.current = true;
    setIsOpenState(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const closeSwipe = (callback?: () => void) => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      isOpenRef.current = false;
      setIsOpenState(false);
      callback?.();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (
        _: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        if (!onDeletePress) return false;
        const isHorizontal =
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        return isHorizontal;
      },
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const base = isOpenRef.current ? -BUTTON_WIDTH : 0;
        let newX = base + gestureState.dx;
        if (newX > 0) newX = 0;
        if (newX < -BUTTON_WIDTH - 25) {
          newX = -BUTTON_WIDTH - 25;
        }
        translateX.setValue(newX);
      },
      onPanResponderRelease: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (isOpenRef.current) {
          if (gestureState.dx > 20 || gestureState.vx > 0.3) {
            closeSwipe();
          } else {
            openSwipe();
          }
        } else {
          if (gestureState.dx < -30 || gestureState.vx < -0.3) {
            openSwipe();
          } else {
            closeSwipe();
          }
        }
      },
      onPanResponderTerminate: () => {
        if (isOpenRef.current) {
          openSwipe();
        } else {
          closeSwipe();
        }
      },
    }),
  ).current;

  const handleCardPress = () => {
    if (isOpenRef.current) {
      closeSwipe();
      return;
    }
    onPress();
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDeletePress?.();
    closeSwipe();
  };

  return (
    <View style={styles.container}>
      {/* Background Revealed Swipe Action */}
      {onDeletePress && (
        <View style={styles.actionContainer}>
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Delete vault ${name}`}
          >
            <Text style={styles.deleteText}>DELETE</Text>
          </Pressable>
        </View>
      )}

      {/* Front Swipable Card Surface */}
      <Animated.View style={[{ transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <Card>
          <Pressable onPress={handleCardPress} className="active:opacity-80">
            <View className="flex-row items-center justify-between mb-1.5">
              <Label className="text-white font-bold">{name}</Label>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: theme.borderRadius ? 6 : 0,
                  borderWidth: 1,
                  borderColor: isUnlocked ? theme.colors.accent : theme.colors.cardBorder,
                  backgroundColor: isUnlocked ? theme.colors.badgeBg : theme.colors.card,
                }}
              >
                <Text
                  style={{
                    color: isUnlocked ? theme.colors.badgeText : theme.colors.textMuted,
                    fontSize: 11,
                    fontWeight: isUnlocked ? '700' : '500',
                    fontFamily: theme.isMono ? 'Courier' : undefined,
                    textTransform: theme.isUppercase ? 'uppercase' : 'none',
                    letterSpacing: theme.isUppercase ? 1.5 : 0.5,
                  }}
                >
                  {isUnlocked
                    ? theme.isUppercase
                      ? 'UNLOCKED'
                      : 'Unlocked'
                    : theme.isUppercase
                      ? 'LOCKED'
                      : 'Locked'}
                </Text>
              </View>
            </View>

            {description ? (
              <Body className="text-zinc-400 text-sm mb-3">{description}</Body>
            ) : (
              <Body className="text-zinc-600 text-sm mb-3">No description provided.</Body>
            )}
          </Pressable>

          {isUnlocked && onLockPress && (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: theme.colors.divider,
                paddingTop: 10,
                marginTop: 4,
              }}
              className="flex-row justify-end items-center"
            >
              <Pressable
                onPress={onLockPress}
                hitSlop={8}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: theme.borderRadius ? 6 : 0,
                  backgroundColor: theme.colors.secondaryButtonBg,
                  borderColor: theme.colors.secondaryButtonBorder,
                  borderWidth: 1,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.secondaryButtonText,
                    fontSize: 11,
                    fontFamily: theme.isMono ? 'Courier' : undefined,
                    textTransform: theme.isUppercase ? 'uppercase' : 'none',
                    letterSpacing: theme.isUppercase ? 1.5 : 0.5,
                  }}
                >
                  {theme.isUppercase ? 'LOCK NOW' : 'Lock Vault'}
                </Text>
              </Pressable>
            </View>
          )}
        </Card>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  actionContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: BUTTON_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  deleteButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#450A0A',
  },
  deleteButtonPressed: {
    backgroundColor: '#7F1D1D',
  },
  deleteText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#F87171',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
