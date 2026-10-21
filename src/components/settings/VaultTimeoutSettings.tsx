import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, H2, Label, Body, Mono, Input, Button } from '../ui';
import { useVaultTimeoutStore } from '../../stores/useVaultTimeoutStore';
import { useTheme } from '../../theme';

const TIMEOUT_PRESETS = [
  { label: '1m', minutes: 1 },
  { label: '5m', minutes: 5 },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '60m', minutes: 60 },
];

export const VaultTimeoutSettings: React.FC = () => {
  const { theme } = useTheme();
  const { timeoutMinutes, setTimeoutMinutes } = useVaultTimeoutStore();
  const [customInput, setCustomInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCustomInput(timeoutMinutes.toString());
  }, [timeoutMinutes]);

  const handleSelectPreset = async (mins: number) => {
    Haptics.selectionAsync().catch(() => {});
    try {
      await setTimeoutMinutes(mins);
      setCustomInput(mins.toString());
    } catch (err) {
      console.error('Failed to set timeout preset:', err);
    }
  };

  const handleSaveCustom = async () => {
    const parsed = parseInt(customInput.trim(), 10);
    if (isNaN(parsed) || parsed < 0) {
      Alert.alert('Invalid Timeout', 'Please enter a valid non-negative integer for minutes.');
      return;
    }

    setIsSaving(true);
    try {
      await setTimeoutMinutes(parsed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Saved', `Vault auto-lock timeout set to ${parsed} minute(s).`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save timeout');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-5 mb-6">
      <H2 className="mb-1">VAULT AUTO-LOCK TIMEOUT</H2>
      <Body className="text-xs mb-4">
        Configure how many minutes a vault stays unlocked after entering your passphrase before
        encryption keys are automatically zeroized.
      </Body>

      <Label className="mb-2">QUICK PRESETS</Label>
      <View className="flex-row gap-2 mb-4">
        {TIMEOUT_PRESETS.map((preset) => {
          const isSelected = timeoutMinutes === preset.minutes;

          return (
            <Pressable
              key={preset.minutes}
              onPress={() => handleSelectPreset(preset.minutes)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={{
                borderRadius: theme.borderRadius ? 10 : 0,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.card,
                paddingVertical: 10,
              }}
              className="flex-1 items-center active:opacity-85"
            >
              <Text
                style={{
                  color: isSelected ? theme.colors.accent : theme.colors.textPrimary,
                  fontWeight: isSelected ? '700' : '600',
                  fontSize: 13,
                  fontFamily: theme.isMono ? 'Courier' : undefined,
                  letterSpacing: theme.isUppercase ? 1 : 0.2,
                }}
              >
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          backgroundColor: theme.isDark ? '#000000' : theme.colors.background,
          borderColor: theme.colors.cardBorder,
          borderWidth: 1,
          borderRadius: theme.borderRadius ? 8 : 0,
          padding: 12,
        }}
        className="mb-4 flex-row justify-between items-center"
      >
        <Label className="text-[11px]">ACTIVE TIMEOUT</Label>
        <Mono className="text-xs font-bold">
          {timeoutMinutes === 0
            ? 'IMMEDIATE ON BACKGROUND'
            : `${timeoutMinutes} MINUTE${timeoutMinutes === 1 ? '' : 'S'}`}
        </Mono>
      </View>

      <Label className="mb-2">CUSTOM DURATION (MINUTES)</Label>
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <Input
            value={customInput}
            onChangeText={setCustomInput}
            placeholder="e.g. 10"
            keyboardType="number-pad"
            returnKeyType="done"
          />
        </View>
        <Button
          variant="secondary"
          className="h-12 px-4"
          loading={isSaving}
          onPress={handleSaveCustom}
        >
          SET
        </Button>
      </View>
    </Card>
  );
};
