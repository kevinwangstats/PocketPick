import React from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card, H1, Body, Label } from '@/components/ui';

export default function VaultDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScrollView className="flex-1 bg-black px-5 py-6">
      <Label className="mb-2">ACTIVE SESSION</Label>
      <H1 className="mb-6 font-mono text-xl">{id ?? 'UNKNOWN VAULT'}</H1>

      <Card className="mb-4">
        <Label className="mb-2">ENCRYPTED CONTENTS</Label>
        <Body className="text-zinc-500">Decrypted items live strictly in ephemeral memory.</Body>
      </Card>
    </ScrollView>
  );
}
