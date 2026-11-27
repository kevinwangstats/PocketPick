import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Switch, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, H2, Label, Body } from '../ui';
import { useTheme } from '../../theme';
import {
  getOotdPreferences,
  updateOotdPreferences,
  DEFAULT_OOTD_PREFERENCES,
  CooldownDaysOption,
  OotdPreferences,
} from '../../services/settings/ootdPreferences';
import {
  getMonthlyQuotaLimit,
  setMonthlyQuotaLimit,
  DEFAULT_MONTHLY_QUOTA,
} from '../../services/quota/quotaManager';

const COOLDOWN_OPTIONS: Array<{ label: string; value: CooldownDaysOption }> = [
  { label: 'Off', value: 0 },
  { label: '3 days', value: 3 },
  { label: '7 days', value: 7 },
];

const QUOTA_OPTIONS = [100, 500, 1000, 2000];

export const OotdPreferencesCard: React.FC = () => {
  const { theme } = useTheme();
  const [prefs, setPrefs] = useState<OotdPreferences>(DEFAULT_OOTD_PREFERENCES);
  const [quotaLimit, setQuotaLimit] = useState<number>(DEFAULT_MONTHLY_QUOTA);

  useEffect(() => {
    Promise.all([getOotdPreferences(), getMonthlyQuotaLimit()])
      .then(([p, q]) => {
        setPrefs(p);
        setQuotaLimit(q);
      })
      .catch(() => {});
  }, []);

  const handleUpdatePref = async (patch: Partial<OotdPreferences>) => {
    Haptics.selectionAsync().catch(() => {});
    const updated = await updateOotdPreferences(patch);
    setPrefs(updated);
  };

  const handleSelectQuota = async (limit: number) => {
    Haptics.selectionAsync().catch(() => {});
    try {
      await setMonthlyQuotaLimit(limit);
      setQuotaLimit(limit);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unable to update quota limit');
    }
  };

  return (
    <Card className="p-5 mb-6">
      <H2 className="mb-1">
        {theme.isUppercase ? 'OOTD RITUAL & PREFERENCES' : 'OOTD Ritual & Preferences'}
      </H2>
      <Body className="text-xs mb-4">
        Customize unveiling, AI auto-sorting, living persona memory, and repeat cooldown.
      </Body>

      {/* Toggles */}
      {[
        {
          key: 'unveilModeDefault' as const,
          title: 'Unveil Mode by Default',
          subtitle: 'Reveal skin-outward veiled cards one tap at a time',
          value: prefs.unveilModeDefault,
        },
        {
          key: 'autoLearnMemory' as const,
          title: 'Auto-Expand Persona Memories',
          subtitle: 'Record style, color & fabric preferences after chats',
          value: prefs.autoLearnMemory,
        },
        {
          key: 'autoClassifyPhotos' as const,
          title: 'AI Human-Body Auto-Sort',
          subtitle: 'Route body selfies to Past OOTD & items to Wardrobe',
          value: prefs.autoClassifyPhotos,
        },
      ].map((item) => (
        <View
          key={item.key}
          style={{
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.divider,
            paddingVertical: 10,
          }}
          className="flex-row justify-between items-center"
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
              {item.title}
            </Text>
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: 11,
                marginTop: 2,
                fontFamily: theme.isMono ? 'Courier' : undefined,
              }}
            >
              {item.subtitle}
            </Text>
          </View>
          <Switch
            value={item.value}
            onValueChange={(val) => handleUpdatePref({ [item.key]: val })}
            trackColor={{ false: theme.colors.cardBorder, true: theme.colors.accent }}
          />
        </View>
      ))}

      {/* Anti-Repeat Cooldown */}
      <Label className="mt-4 mb-2">ANTI-REPEAT COOLDOWN</Label>
      <View className="flex-row gap-2 mb-4">
        {COOLDOWN_OPTIONS.map((opt) => {
          const isSelected = prefs.cooldownDays === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => handleUpdatePref({ cooldownDays: opt.value })}
              style={{
                flex: 1,
                borderRadius: theme.borderRadius ? 8 : 0,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.card,
                paddingVertical: 8,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: isSelected ? theme.colors.accent : theme.colors.textPrimary,
                  fontWeight: isSelected ? '700' : '500',
                  fontSize: 12,
                  fontFamily: theme.isMono ? 'Courier' : undefined,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Monthly Quota Guard Limit */}
      <Label className="mb-2">MONTHLY AI QUOTA CAP</Label>
      <View className="flex-row gap-2">
        {QUOTA_OPTIONS.map((limit) => {
          const isSelected = quotaLimit === limit;
          return (
            <Pressable
              key={limit}
              onPress={() => handleSelectQuota(limit)}
              style={{
                flex: 1,
                borderRadius: theme.borderRadius ? 8 : 0,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.card,
                paddingVertical: 8,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: isSelected ? theme.colors.accent : theme.colors.textPrimary,
                  fontWeight: isSelected ? '700' : '500',
                  fontSize: 12,
                  fontFamily: theme.isMono ? 'Courier' : undefined,
                }}
              >
                {limit}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
};
