import React from 'react';
import { View } from 'react-native';
import { Resource } from '../../db/schema';
import { PickerState } from '../../services/randomizer/types';
import { Card, Mono, Label, Body } from '../ui';
import { useTheme } from '../../theme';

export interface ShuffleDisplayProps {
  state: PickerState;
  displayItem: Resource | null;
  totalPoolSize: number;
}

export function ShuffleDisplay({ state, displayItem, totalPoolSize }: ShuffleDisplayProps) {
  const { theme } = useTheme();
  const isCycling = state === 'shuffling' || state === 'decelerating';

  return (
    <Card className="items-center justify-center p-8 min-h-[220px]">
      {state === 'idle' && (
        <View className="items-center">
          <Label className="mb-2">CSPRNG RANDOMIZER READY</Label>
          <Mono
            style={{ color: theme.colors.textPrimary }}
            className="text-2xl font-bold tracking-widest"
          >
            {totalPoolSize > 0 ? `POOL: ${totalPoolSize} ITEMS` : 'NO ITEMS IN POOL'}
          </Mono>
          <Body style={{ color: theme.colors.textMuted }} className="text-xs mt-2 font-mono">
            {totalPoolSize > 0 ? 'UNBIASED CRYPTOGRAPHIC SAMPLING' : 'ADD TICKETS OR PHOTOS FIRST'}
          </Body>
        </View>
      )}

      {isCycling && (
        <View className="items-center w-full">
          <Label className="mb-3 tracking-widest">
            {state === 'shuffling' ? '• SHUFFLING POOL •' : '•• DECELERATING ••'}
          </Label>
          <View
            style={{
              backgroundColor: theme.colors.badgeBg,
              borderColor: theme.colors.accent,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 10 : 0,
              paddingVertical: 16,
              paddingHorizontal: 24,
              width: '100%',
              alignItems: 'center',
            }}
          >
            <Mono
              style={{ color: theme.colors.accent }}
              className="text-xl font-bold tracking-widest"
            >
              {displayItem
                ? `ID: ${displayItem.id.slice(0, 12).toUpperCase()}`
                : 'SAMPLING CSPRNG...'}
            </Mono>
            {displayItem && (
              <Mono style={{ color: theme.colors.textSecondary }} className="text-xs mt-1">
                TYPE: {displayItem.type.toUpperCase()} | W: {displayItem.weight}
              </Mono>
            )}
          </View>
        </View>
      )}

      {state === 'revealed' && (
        <View className="items-center">
          <Label className="mb-2 tracking-widest">SELECTION SECURED</Label>
          <Mono style={{ color: theme.colors.textSecondary }} className="text-xs tracking-wider">
            SHA512/AES-256 VERIFIED
          </Mono>
        </View>
      )}
    </Card>
  );
}
