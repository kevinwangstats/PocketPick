import React from 'react';
import { View, ScrollView } from 'react-native';
import { Card, H1, Body, Label } from '@/components/ui';

export default function HistoryScreen() {
  return (
    <ScrollView className="flex-1 bg-black px-5 py-6">
      <Label className="mb-2">AUDIT TRAIL</Label>
      <H1 className="mb-6">SELECTION LOG</H1>

      <Card className="mb-4">
        <Label className="mb-2">IMMUTABLE LOCAL AUDIT</Label>
        <Body className="text-zinc-500 mb-2">
          Every draw is transactionally recorded into SQLCipher storage with high-precision
          timestamps.
        </Body>
        <View className="py-8 items-center justify-center border-t border-zinc-900 mt-4">
          <Label className="text-zinc-600">[ ZERO LOGGED SELECTIONS ]</Label>
        </View>
      </Card>
    </ScrollView>
  );
}
