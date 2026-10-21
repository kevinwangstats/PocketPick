import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, H2, Label, Body, Mono } from '../ui';
import { useVaultTimeoutStore } from '../../stores/useVaultTimeoutStore';
import { useTheme } from '../../theme';

const PRESET_BUTTONS = [
  { label: '0m', minutes: 0 },
  { label: '1m', minutes: 1 },
  { label: '5m', minutes: 5 },
];

export const VaultTimeoutSettings: React.FC = () => {
  const { theme } = useTheme();
  const { timeoutMinutes, setTimeoutMinutes } = useVaultTimeoutStore();
  const [customInput, setCustomInput] = useState('');

  const isCustomSelected = timeoutMinutes > 0 && timeoutMinutes !== 1 && timeoutMinutes !== 5;

  useEffect(() => {
    if (isCustomSelected) {
      setCustomInput(timeoutMinutes.toString());
    } else {
      setCustomInput('');
    }
  }, [timeoutMinutes, isCustomSelected]);

  const handleSelectPreset = async (mins: number) => {
    Haptics.selectionAsync().catch(() => {});
    try {
      await setTimeoutMinutes(mins);
      setCustomInput('');
    } catch (err) {
      console.error('Failed to set timeout preset:', err);
    }
  };

  const handleSaveCustom = async () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    const parsed = parseInt(trimmed, 10);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert(
        theme.isUppercase ? 'INVALID TIMEOUT' : 'Invalid Timeout',
        'Please enter a positive integer for minutes (e.g. 10). To always require password, tap 0m.',
      );
      return;
    }

    try {
      await setTimeoutMinutes(parsed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        theme.isUppercase ? 'SAVED' : 'Saved',
        `Vault auto-lock timeout set to ${parsed} minute(s).`,
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save timeout');
    }
  };

  return (
    <Card className="p-5 mb-6">
      <H2 className="mb-1">
        {theme.isUppercase ? 'VAULT AUTO-LOCK TIMEOUT' : 'Vault Auto-Lock Timeout'}
      </H2>
      <Body className="text-xs mb-4">
        Configure how long a vault stays open before requiring your password again. 0m always
        requires the password on access.
      </Body>

      <Label className="mb-2">{theme.isUppercase ? 'TIMEOUT OPTIONS' : 'Timeout Options'}</Label>

      {/* Single-line Row containing 0m, 1m, 5m, and customized positive integer input */}
      <View className="flex-row items-center gap-1.5">
        {PRESET_BUTTONS.map((preset) => {
          const isSelected = timeoutMinutes === preset.minutes;

          return (
            <Pressable
              key={preset.minutes}
              onPress={() => handleSelectPreset(preset.minutes)}
              accessibilityRole="button"
              accessibilityLabel={`${preset.label} timeout`}
              accessibilityState={{ selected: isSelected }}
              style={{
                borderRadius: theme.borderRadius ? 8 : 0,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.card,
                paddingVertical: 9,
                paddingHorizontal: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="active:opacity-85"
            >
              <Text
                style={{
                  color: isSelected ? theme.colors.accent : theme.colors.textPrimary,
                  fontWeight: isSelected ? '700' : '600',
                  fontSize: 13,
                  fontFamily: theme.isMono ? 'Courier' : undefined,
                  letterSpacing: theme.isUppercase ? 0.8 : 0.2,
                }}
              >
                {preset.label}
              </Text>
            </Pressable>
          );
        })}

        {/* Customized Positive Integer Input Container in the same line */}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: theme.borderRadius ? 8 : 0,
            borderWidth: isCustomSelected ? 2 : 1,
            borderColor: isCustomSelected ? theme.colors.accent : theme.colors.cardBorder,
            backgroundColor: isCustomSelected ? theme.colors.badgeBg : theme.colors.inputBg,
            paddingHorizontal: 10,
            height: 38,
          }}
        >
          <TextInput
            value={customInput}
            onChangeText={(val) => {
              const sanitized = val.replace(/[^0-9]/g, '');
              setCustomInput(sanitized);
            }}
            onSubmitEditing={handleSaveCustom}
            placeholder={
              isCustomSelected
                ? `${timeoutMinutes}m`
                : theme.isUppercase
                  ? 'CUSTOM (MIN)'
                  : 'Custom (min)'
            }
            placeholderTextColor={isCustomSelected ? theme.colors.accent : theme.colors.textMuted}
            keyboardType="number-pad"
            returnKeyType="done"
            style={{
              flex: 1,
              color: isCustomSelected ? theme.colors.accent : theme.colors.textPrimary,
              fontSize: 13,
              fontFamily: theme.isMono ? 'Courier' : undefined,
              fontWeight: isCustomSelected ? '700' : '500',
              paddingVertical: 0,
            }}
          />
          {customInput.length > 0 && (
            <Pressable
              onPress={handleSaveCustom}
              hitSlop={6}
              style={{
                backgroundColor: theme.colors.accent,
                paddingHorizontal: 7,
                paddingVertical: 3,
                borderRadius: theme.borderRadius ? 4 : 0,
                marginLeft: 4,
              }}
            >
              <Text
                style={{
                  color: theme.colors.accentText,
                  fontSize: 10,
                  fontWeight: '700',
                  fontFamily: theme.isMono ? 'Courier' : undefined,
                }}
              >
                {theme.isUppercase ? 'SET' : 'Set'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Active Timeout Status Indicator */}
      <View
        style={{
          backgroundColor: theme.isDark ? '#000000' : theme.colors.background,
          borderColor: theme.colors.cardBorder,
          borderWidth: 1,
          borderRadius: theme.borderRadius ? 8 : 0,
          padding: 12,
        }}
        className="mt-4 flex-row justify-between items-center"
      >
        <Label className="text-[11px]">
          {theme.isUppercase ? 'ACTIVE STATUS' : 'Active Status'}
        </Label>
        <Mono className="text-xs font-bold">
          {timeoutMinutes === 0
            ? theme.isUppercase
              ? '0M (ALWAYS REQUIRES PASSWORD)'
              : '0m (Always requires password)'
            : `${timeoutMinutes} ${timeoutMinutes === 1 ? 'MINUTE' : 'MINUTES'}`}
        </Mono>
      </View>
    </Card>
  );
};
