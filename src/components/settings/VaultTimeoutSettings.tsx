import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, Alert, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, H2, Label, Body, Mono, Button } from '../ui';
import { useVaultTimeoutStore } from '../../stores/useVaultTimeoutStore';
import { useAppAuth } from '../../hooks/useAppAuth';
import { useTheme } from '../../theme';

const PRESET_BUTTONS = [
  { label: '0m', minutes: 0 },
  { label: '5m', minutes: 5 },
  { label: '15m', minutes: 15 },
];

export const VaultTimeoutSettings: React.FC = () => {
  const { theme } = useTheme();
  const { timeoutMinutes, setTimeoutMinutes } = useVaultTimeoutStore();
  const { biometricAvailable, biometricEnabled, toggleBiometric, lock } = useAppAuth();
  const [customInput, setCustomInput] = useState('');

  const isCustomSelected = timeoutMinutes !== 0 && timeoutMinutes !== 5 && timeoutMinutes !== 15;

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
        'Please enter a positive integer for minutes (e.g. 30). Tap 0m to always require unlock on background.',
      );
      return;
    }

    try {
      await setTimeoutMinutes(parsed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        theme.isUppercase ? 'SAVED' : 'Saved',
        `Inactivity auto-lock set to ${parsed} minute(s).`,
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save timeout');
    }
  };

  const handleToggleBiometric = async (nextVal: boolean) => {
    try {
      const ok = await toggleBiometric(nextVal);
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (err) {
      Alert.alert(
        'Biometric Error',
        err instanceof Error ? err.message : 'Unable to update Face ID',
      );
    }
  };

  return (
    <Card className="p-5 mb-6">
      <H2 className="mb-1">
        {theme.isUppercase ? 'SECURITY & AUTO-LOCK' : 'Security & Auto-Lock'}
      </H2>
      <Body className="text-xs mb-4">
        Locks the app after inactivity (never mid-chat). 0m immediately locks when backgrounded.
      </Body>

      {/* Face ID / Touch ID Toggle */}
      <View
        style={{
          backgroundColor: theme.isDark ? '#000000' : theme.colors.background,
          borderColor: theme.colors.cardBorder,
          borderWidth: 1,
          borderRadius: theme.borderRadius ? 10 : 0,
          padding: 12,
        }}
        className="mb-4 flex-row justify-between items-center"
      >
        <View className="flex-1 pr-3">
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontFamily: theme.isMono ? 'Courier' : undefined,
              fontWeight: '600',
              fontSize: 13,
            }}
          >
            {theme.isUppercase ? 'FACE ID QUICK UNLOCK' : 'Face ID Quick Unlock'}
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 11,
              marginTop: 2,
              fontFamily: theme.isMono ? 'Courier' : undefined,
            }}
          >
            {biometricAvailable
              ? 'Unlock effortlessly with Face ID / Touch ID'
              : 'Biometrics not enrolled on this device'}
          </Text>
        </View>
        <Switch
          value={biometricEnabled}
          onValueChange={handleToggleBiometric}
          disabled={!biometricAvailable}
          trackColor={{ false: theme.colors.cardBorder, true: theme.colors.accent }}
        />
      </View>

      <Label className="mb-2">
        {theme.isUppercase ? 'INACTIVITY TIMEOUT' : 'Inactivity Timeout'}
      </Label>

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
                }}
              >
                {preset.label}
              </Text>
            </Pressable>
          );
        })}

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
            onChangeText={(val) => setCustomInput(val.replace(/[^0-9]/g, ''))}
            onSubmitEditing={handleSaveCustom}
            placeholder={isCustomSelected ? `${timeoutMinutes}m` : 'Custom (min)'}
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

      <View
        style={{
          backgroundColor: theme.isDark ? '#000000' : theme.colors.background,
          borderColor: theme.colors.cardBorder,
          borderWidth: 1,
          borderRadius: theme.borderRadius ? 8 : 0,
          padding: 12,
        }}
        className="mt-4 mb-4 flex-row justify-between items-center"
      >
        <Label className="text-[11px]">
          {theme.isUppercase ? 'ACTIVE STATUS' : 'Active Status'}
        </Label>
        <Mono className="text-xs font-bold">
          {timeoutMinutes === 0
            ? '0m (Immediate on background)'
            : `${timeoutMinutes} ${timeoutMinutes === 1 ? 'minute' : 'minutes'} idle`}
        </Mono>
      </View>

      <Button
        variant="secondary"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          lock();
        }}
      >
        {theme.isUppercase ? 'LOCK APP NOW' : 'Lock App Now'}
      </Button>
    </Card>
  );
};
