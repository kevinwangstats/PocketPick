import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, Label, Body } from '../ui';

export interface VaultCardProps {
  id: string;
  name: string;
  description?: string | null;
  isUnlocked: boolean;
  onPress: () => void;
  onLockPress?: () => void;
}

export const VaultCard: React.FC<VaultCardProps> = ({
  name,
  description,
  isUnlocked,
  onPress,
  onLockPress,
}) => {
  return (
    <Card className="mb-3">
      <Pressable onPress={onPress} className="active:opacity-80">
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
        <View className="border-t border-zinc-800 pt-2.5 mt-1 flex-row justify-end">
          <Pressable
            onPress={onLockPress}
            className="px-3 py-1 bg-zinc-900 border border-zinc-700 active:bg-zinc-800"
          >
            <Text className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
              LOCK NOW
            </Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
};
