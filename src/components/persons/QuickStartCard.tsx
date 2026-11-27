import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, Label, Button } from '../ui';
import { useTheme } from '../../theme';

export interface QuickStartCardProps {
  hasApiKey: boolean;
  hasPersons: boolean;
  hasWardrobePhotos: boolean;
  onGoToSettings: () => void;
  onQuickAddStarter: () => void;
  onGoToWardrobe: () => void;
  onDismiss: () => void;
}

export const QuickStartCard: React.FC<QuickStartCardProps> = ({
  hasApiKey,
  hasPersons,
  hasWardrobePhotos,
  onGoToSettings,
  onQuickAddStarter,
  onGoToWardrobe,
  onDismiss,
}) => {
  const { theme } = useTheme();

  if (hasApiKey && hasPersons && hasWardrobePhotos) {
    return null;
  }

  const steps = [
    {
      done: hasApiKey,
      label: '1. Connect OpenRouter Key (Grok 4.7 ready)',
      actionLabel: 'Settings',
      onPress: onGoToSettings,
    },
    {
      done: hasPersons,
      label: '2. Meet Your First AI Stylist',
      actionLabel: 'Add Celeste',
      onPress: onQuickAddStarter,
    },
    {
      done: hasWardrobePhotos,
      label: '3. Add Wardrobe Pieces',
      actionLabel: 'Wardrobe',
      onPress: onGoToWardrobe,
    },
  ];

  return (
    <Card className="p-4 mb-5">
      <View className="flex-row justify-between items-center mb-2">
        <Label>DAY-1 QUICK START</Label>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>Dismiss</Text>
        </Pressable>
      </View>

      <View className="gap-2.5">
        {steps.map((step) => (
          <View key={step.label} className="flex-row items-center justify-between gap-2">
            <Text
              style={{
                flex: 1,
                color: step.done ? theme.colors.textMuted : theme.colors.textPrimary,
                textDecorationLine: step.done ? 'line-through' : 'none',
                fontSize: 12,
                fontWeight: step.done ? '400' : '600',
              }}
            >
              {step.done ? '✓ ' : '○ '}
              {step.label}
            </Text>
            {!step.done && (
              <Button variant="secondary" className="h-7 px-3" onPress={step.onPress}>
                {step.actionLabel}
              </Button>
            )}
          </View>
        ))}
      </View>
    </Card>
  );
};
