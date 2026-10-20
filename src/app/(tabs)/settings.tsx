import React from 'react';
import { View, ScrollView } from 'react-native';
import { Card, H1, Body, Label } from '@/components/ui';

export default function SettingsScreen() {
  return (
    <ScrollView className="flex-1 bg-black px-5 py-6">
      <Label className="mb-2">SYSTEM PARAMETERS</Label>
      <H1 className="mb-6">SETTINGS & SECURITY</H1>

      <Card className="mb-4">
        <Label className="mb-2">DATABASE STATUS</Label>
        <Body className="text-zinc-300 mb-1">SQLCipher: 256-bit AES</Body>
        <Body className="text-zinc-500 font-mono text-xs">
          Hardware Key: iOS Keychain (kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly)
        </Body>
      </Card>

      <Card className="mb-4">
        <View className="flex-row justify-between items-center mb-2">
          <Label>MONTHLY CLOUD QUOTA</Label>
          <Label className="text-zinc-400">0 / 100 REQ</Label>
        </View>
        <View className="w-full h-1 bg-zinc-800 mb-2">
          <View className="h-full bg-white w-0" />
        </View>
        <Body className="text-zinc-500 text-xs">
          Strict transactional ceiling prevents unintended cloud charges.
        </Body>
      </Card>
    </ScrollView>
  );
}
