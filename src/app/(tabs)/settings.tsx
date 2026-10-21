import React from 'react';
import { ScrollView, View } from 'react-native';
import { H1, Label, Card, Body, Mono } from '../../components/ui';
import {
  ApiKeySettings,
  QuotaProgressCard,
  ThemeSwitcher,
  VaultTimeoutSettings,
} from '../../components/settings';
import { useTheme } from '../../theme';

export default function SettingsScreen() {
  const { theme } = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      className="flex-1 px-5 py-6"
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      <Label className="mb-1">SYSTEM & PREFERENCES</Label>
      <H1 className="mb-6">SETTINGS</H1>

      {/* Theme Switcher */}
      <ThemeSwitcher />

      {/* Vault Auto-Lock Timeout */}
      <VaultTimeoutSettings />

      {/* Quota Progress Card */}
      <QuotaProgressCard />

      {/* API Key Settings */}
      <ApiKeySettings />

      {/* Security Invariants & Cryptographic Stack */}
      <Card className="p-5 mb-6">
        <Label className="mb-2">CRYPTOGRAPHIC ARCHITECTURE</Label>
        <Body className="text-xs mb-3">
          PocketPick operates on zero-knowledge envelope encryption. Derived vault keys are
          ephemeral and zeroized upon app lock or backgrounding.
        </Body>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.colors.divider,
            paddingTop: 12,
          }}
        >
          <Mono className="text-[11px]">• CIPHER: AES-256-GCM (12-byte IV, 16-byte Tag)</Mono>
          <Mono className="text-[11px] mt-1">• KDF: PBKDF2-HMAC-SHA512 (100,000 iterations)</Mono>
          <Mono className="text-[11px] mt-1">• STORAGE: SQLCipher 256-bit AES + OP-SQLite</Mono>
          <Mono className="text-[11px] mt-1">
            • HARDWARE: Apple Keychain Secure Enclave / SecureStore
          </Mono>
        </View>
      </Card>
    </ScrollView>
  );
}
