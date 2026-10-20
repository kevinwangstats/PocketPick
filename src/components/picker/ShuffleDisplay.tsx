import React from 'react';
import { View } from 'react-native';
import { Resource } from '../../db/schema';
import { PickerState } from '../../services/randomizer/types';
import { Card, Mono, Label, Body } from '../ui';

export interface ShuffleDisplayProps {
  state: PickerState;
  displayItem: Resource | null;
  totalPoolSize: number;
}

export function ShuffleDisplay({ state, displayItem, totalPoolSize }: ShuffleDisplayProps) {
  const isCycling = state === 'shuffling' || state === 'decelerating';

  return (
    <Card className="items-center justify-center p-8 min-h-[220px] border-2 border-zinc-800 bg-black">
      {state === 'idle' && (
        <View className="items-center">
          <Label className="text-zinc-500 mb-2">CSPRNG RANDOMIZER READY</Label>
          <Mono className="text-2xl font-bold tracking-widest text-zinc-300">
            {totalPoolSize > 0 ? `POOL: ${totalPoolSize} ITEMS` : 'NO ITEMS IN POOL'}
          </Mono>
          <Body className="text-xs text-zinc-600 mt-2 font-mono">
            {totalPoolSize > 0 ? 'UNBIASED CRYPTOGRAPHIC SAMPLING' : 'ADD TICKETS OR PHOTOS FIRST'}
          </Body>
        </View>
      )}

      {isCycling && (
        <View className="items-center">
          <Label className="text-white mb-3 tracking-widest animate-pulse">
            {state === 'shuffling' ? '• SHUFFLING POOL •' : '•• DECELERATING ••'}
          </Label>
          <View className="bg-zinc-900 border border-zinc-700 px-6 py-4 rounded-none w-full items-center">
            <Mono className="text-xl font-bold text-white tracking-widest">
              {displayItem
                ? `ID: ${displayItem.id.slice(0, 12).toUpperCase()}`
                : 'SAMPLING CSPRNG...'}
            </Mono>
            {displayItem && (
              <Mono className="text-xs text-zinc-400 mt-1">
                TYPE: {displayItem.type.toUpperCase()} | W: {displayItem.weight}
              </Mono>
            )}
          </View>
        </View>
      )}

      {state === 'revealed' && (
        <View className="items-center">
          <Label className="text-white mb-2 tracking-widest">SELECTION SECURED</Label>
          <Mono className="text-xs text-zinc-400 tracking-wider">SHA512/AES-256 VERIFIED</Mono>
        </View>
      )}
    </Card>
  );
}
