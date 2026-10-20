import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, Label, Body } from '../ui';
import { useTheme, THEMES, ThemeId } from '../../theme';

const THEME_OPTIONS: Array<{
  id: ThemeId;
  previewColors: string[];
}> = [
  {
    id: 'classic-ios',
    previewColors: ['#007AFF', '#F2F2F7', '#FFFFFF'],
  },
  {
    id: 'sakura-pink',
    previewColors: ['#EC4899', '#FFF5F7', '#FCE7F3'],
  },
  {
    id: 'cyber',
    previewColors: ['#FFFFFF', '#000000', '#27272A'],
  },
];

export const ThemeSwitcher: React.FC = () => {
  const { theme, themeId, setTheme } = useTheme();

  const handleSelectTheme = (id: ThemeId) => {
    if (id !== themeId) {
      Haptics.selectionAsync().catch(() => {});
      setTheme(id);
    }
  };

  return (
    <Card className="p-5 mb-6">
      <Label className="mb-1">APPEARANCE & THEME</Label>
      <Body className="text-xs mb-4">
        Switch themes to customize color accents, corners, and typography.
      </Body>

      <View className="gap-3">
        {THEME_OPTIONS.map((option) => {
          const themeDef = THEMES[option.id];
          const isSelected = themeId === option.id;

          return (
            <Pressable
              key={option.id}
              onPress={() => handleSelectTheme(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={{
                borderRadius: themeDef.borderRadius || theme.borderRadius,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.card,
                padding: 14,
              }}
              className="flex-row items-center justify-between active:opacity-85"
            >
              <View className="flex-1 pr-3">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text
                    style={{
                      color: isSelected ? theme.colors.accent : theme.colors.textPrimary,
                      fontWeight: isSelected ? '700' : '600',
                      fontSize: 15,
                      fontFamily: themeDef.isMono ? 'Courier' : undefined,
                    }}
                  >
                    {themeDef.name}
                  </Text>
                  {isSelected && (
                    <View
                      style={{
                        backgroundColor: theme.colors.accent,
                        borderRadius: 10,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}
                    >
                      <Text
                        style={{
                          color: theme.colors.accentText,
                          fontSize: 10,
                          fontWeight: '700',
                        }}
                      >
                        ACTIVE
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: 12,
                    fontFamily: themeDef.isMono ? 'Courier' : undefined,
                  }}
                >
                  {themeDef.subtitle}
                </Text>
              </View>

              {/* Color Preview Swatches */}
              <View className="flex-row items-center gap-1.5">
                {option.previewColors.map((c, i) => (
                  <View
                    key={i}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: themeDef.borderRadius ? 9 : 0,
                      backgroundColor: c,
                      borderWidth: 1,
                      borderColor: 'rgba(0,0,0,0.15)',
                    }}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
};
