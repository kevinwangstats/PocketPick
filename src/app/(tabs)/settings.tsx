import React from 'react';
import { ScrollView, View } from 'react-native';
import { H1, Label, Card, Body, Mono } from '../../components/ui';
import { ApiKeySettings, QuotaProgressCard } from '../../components/settings';

export default function SettingsScreen() {
  return (
    <ScrollView className="flex-1 bg-black px-5 py-6" contentContainerStyle={{ paddingBottom: 60 }}>
      <Label className="mb-1 text-zinc-500">SYSTEM PARAMETERS & API</Label>
      <H1 className="mb-6">SETTINGS</H1>

      {/* Quota Progress Card */}
      <QuotaProgressCard />

      {/* API Key Settings */}
      <ApiKeySettings />

      {/* Security Invariants & Cryptographic Stack */}
      <Card className="p-5 border border-zinc-800 bg-zinc-950 mb-6">
        <Label className="text-white mb-2">CRYPTOGRAPHIC ARCHITECTURE</Label>
        <Body className="text-zinc-400 text-xs mb-3">
          PocketPick operates on zero-knowledge envelope encryption. Derived vault keys are
          ephemeral and zeroized upon app lock or backgrounding.
        </Body>

        <View className="border-t border-zinc-900 pt-3">
          <Mono className="text-[11px] text-zinc-500">
            • CIPHER: AES-256-GCM (12-byte IV, 16-byte Tag)
          </Mono>
          <Mono className="text-[11px] text-zinc-500 mt-1">
            • KDF: PBKDF2-HMAC-SHA512 (100,000 iterations)
          </Mono>
          <Mono className="text-[11px] text-zinc-500 mt-1">
            • STORAGE: SQLCipher 256-bit AES + OP-SQLite
          </Mono>
          <Mono className="text-[11px] text-zinc-500 mt-1">
            • HARDWARE: Apple Keychain Secure Enclave / SecureStore
          </Mono>
        </View>
      </Card>
    </ScrollView>
  );
}
