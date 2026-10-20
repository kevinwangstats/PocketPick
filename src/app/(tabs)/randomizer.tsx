import React from 'react';
import { View, ScrollView } from 'react-native';
import { Card, H1, Body, Label } from '@/components/ui';

export default function RandomizerScreen() {
  return (
    <ScrollView className="flex-1 bg-black px-5 py-6">
      <Label className="mb-2">CSPRNG ENGINE READY</Label>
      <H1 className="mb-6">RANDOM PICKER</H1>

      <Card className="mb-6 items-center py-10">
        <Label className="mb-3">STATUS</Label>
        <Body className="text-zinc-500 text-center mb-6">
          Unlock a vault to begin cryptographically fair random selection.
        </Body>
        <View className="h-16 w-full border border-dashed border-zinc-800 items-center justify-center">
          <Label className="text-zinc-600">[ NO ACTIVE POOL ]</Label>
        </View>
      </Card>
    </ScrollView>
  );
}
