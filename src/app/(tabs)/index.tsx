import React from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, H1, Body, Label } from '@/components/ui';

export default function VaultsScreen() {
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-black px-5 py-6">
      <Label className="mb-2">ENVELOPE ENCRYPTION ACTIVE</Label>
      <H1 className="mb-6">SECURE VAULTS</H1>

      <Card className="mb-4">
        <View className="flex-row justify-between items-center mb-2">
          <Label>ISOLATED STORAGE</Label>
          <View className="px-2 py-0.5 bg-zinc-900 border border-zinc-700">
            <Label className="text-zinc-300">0 VAULTS</Label>
          </View>
        </View>
        <Body className="text-zinc-400 mb-4">
          Each vault is independently encrypted with a unique salt and PBKDF2-derived AES-256-GCM
          key.
        </Body>
        <Button variant="primary" onPress={() => router.push('/vault/unlock')}>
          CREATE NEW VAULT
        </Button>
      </Card>
    </ScrollView>
  );
}
