import React from 'react';
import { View, Image } from 'react-native';
import { DecryptedWinner } from '../../services/randomizer/types';
import { Card, H2, Body, Label, Mono, Button } from '../ui';

export interface WinnerCardProps {
  winner: DecryptedWinner;
  onRePick: () => void;
  onConfirm: () => void;
}

export function WinnerCard({ winner, onRePick, onConfirm }: WinnerCardProps) {
  return (
    <Card className="border-2 border-white bg-zinc-950 p-6 mt-4">
      <View className="flex-row justify-between items-center mb-3 border-b border-zinc-800 pb-2">
        <Label className="text-white tracking-widest">★ WINNING SELECTION</Label>
        <View className="bg-white px-2 py-0.5">
          <Mono className="text-[10px] text-black font-bold">
            {winner.isPhoto ? 'PHOTO' : 'TICKET'}
          </Mono>
        </View>
      </View>

      {winner.isPhoto && winner.thumbnailBase64 && (
        <View className="items-center mb-4">
          <Image
            source={{ uri: winner.thumbnailBase64 }}
            className="w-48 h-48 border border-zinc-700 bg-zinc-900"
            resizeMode="cover"
          />
        </View>
      )}

      <H2 className="text-white text-xl mb-1">{winner.title}</H2>

      {winner.content ? <Body className="text-zinc-400 text-sm mb-4">{winner.content}</Body> : null}

      <View className="flex-row items-center justify-between py-2 border-t border-zinc-900 mb-4">
        <Mono className="text-xs text-zinc-500 font-mono">
          ID: {winner.resource.id.slice(0, 10)}...
        </Mono>
        <Mono className="text-xs text-zinc-500 font-mono">MODE: UNIFORM (1/N)</Mono>
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
