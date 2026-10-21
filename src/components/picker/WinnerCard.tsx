import React from 'react';
import { View, Image } from 'react-native';
import { DecryptedWinner } from '../../services/randomizer/types';
import { Card, H2, Body, Label, Mono, Button } from '../ui';
import { useTheme } from '../../theme';

export interface WinnerCardProps {
  winner: DecryptedWinner;
  onRePick: () => void;
  onConfirm: () => void;
}

export function WinnerCard({ winner, onRePick, onConfirm }: WinnerCardProps) {
  const { theme } = useTheme();

  return (
    <Card
      style={{
        borderColor: theme.colors.accent,
        borderWidth: 2,
      }}
      className="p-6 mt-4"
    >
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.divider,
        }}
        className="flex-row justify-between items-center mb-3 pb-2"
      >
        <Label style={{ color: theme.colors.accent }}>★ WINNING SELECTION</Label>
        <View
          style={{
            backgroundColor: theme.colors.badgeBg,
            borderColor: theme.colors.cardBorder,
            borderWidth: 1,
            borderRadius: theme.borderRadius ? 6 : 0,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Mono style={{ color: theme.colors.badgeText }} className="text-[10px] font-bold">
            {winner.isPhoto ? 'PHOTO' : 'TICKET'}
          </Mono>
        </View>
      </View>

      {winner.isPhoto && winner.thumbnailBase64 && (
        <View className="items-center mb-4">
          <Image
            source={{ uri: winner.thumbnailBase64 }}
            style={{
              width: 192,
              height: 192,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 10 : 0,
            }}
            resizeMode="cover"
          />
        </View>
      )}

      <H2 className="text-xl mb-1">{winner.title}</H2>

      {winner.content ? (
        <Body style={{ color: theme.colors.textSecondary }} className="text-sm mb-4">
          {winner.content}
        </Body>
      ) : null}

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: theme.colors.divider,
        }}
        className="flex-row items-center justify-between py-2 mb-4"
      >
        <Mono style={{ color: theme.colors.textMuted }} className="text-xs font-mono">
          ID: {winner.resource.id.slice(0, 10)}...
        </Mono>
        <Mono style={{ color: theme.colors.textMuted }} className="text-xs font-mono">
          MODE: UNIFORM (1/N)
        </Mono>
      </View>

      <View className="flex-row space-x-3 gap-3">
        <View className="flex-1">
          <Button variant="secondary" onPress={onRePick}>
            RE-PICK
          </Button>
        </View>
        <View className="flex-1">
          <Button variant="primary" onPress={onConfirm}>
            CONFIRM
          </Button>
        </View>
      </View>
    </Card>
  );
}
