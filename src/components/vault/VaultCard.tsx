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
        <Card className="bg-black">
          <Pressable onPress={handleCardPress} className="active:opacity-80">
            <View className="flex-row items-center justify-between mb-1.5">
              <Label className="text-white font-bold">{name}</Label>
              <View
                className={`px-2 py-0.5 border ${
                  isUnlocked ? 'bg-white border-white' : 'bg-black border-zinc-700'
                }`}
              >
                <Text
                  className={`text-xs font-mono uppercase tracking-wider ${
                    isUnlocked ? 'text-black font-bold' : 'text-zinc-400'
                  }`}
                >
                  {isUnlocked ? 'UNLOCKED' : 'LOCKED'}
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
            <View className="border-t border-zinc-800 pt-2.5 mt-1 flex-row justify-end items-center">
              <Pressable
                onPress={onLockPress}
                hitSlop={8}
                className="px-3 py-1 bg-zinc-900 border border-zinc-700 active:bg-zinc-800"
              >
                <Text className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                  LOCK NOW
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
    backgroundColor: '#000000',
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
