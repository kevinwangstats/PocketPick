import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Button } from '../ui';
import { useTheme } from '../../theme';

export interface BatchAnalyzeBannerProps {
  unsortedCount: number;
  isRunning: boolean;
  progress: { completed: number; total: number } | null;
  onStart: () => void;
  onCancel: () => void;
}

export const BatchAnalyzeBanner: React.FC<BatchAnalyzeBannerProps> = ({
  unsortedCount,
  isRunning,
  progress,
  onStart,
  onCancel,
}) => {
  const { theme } = useTheme();

  if (unsortedCount === 0 && !isRunning) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: theme.colors.badgeBg,
        borderColor: theme.colors.cardBorder,
        borderWidth: 1,
        borderRadius: theme.borderRadius ? 12 : 0,
        padding: 12,
        marginBottom: 12,
      }}
      className="flex-row items-center justify-between gap-3"
    >
      <View className="flex-1">
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontWeight: '700',
            fontSize: 12,
            fontFamily: theme.isMono ? 'Courier' : undefined,
          }}
        >
          {isRunning && progress
            ? `Auto-sorting ${progress.completed} / ${progress.total}...`
            : `${unsortedCount} photo${unsortedCount === 1 ? '' : 's'} ready for AI auto-tag & sort`}
        </Text>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 11,
            marginTop: 2,
          }}
        >
          {isRunning
            ? 'Detecting garments vs. human-body OOTDs'
            : `Uses ~${unsortedCount} OpenRouter request${unsortedCount === 1 ? '' : 's'}`}
        </Text>
      </View>

      {isRunning ? (
        <Pressable
          onPress={onCancel}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: theme.borderRadius ? 8 : 0,
            borderWidth: 1,
            borderColor: theme.colors.destructiveButtonBorder,
          }}
        >
          <Text
            style={{ color: theme.colors.destructiveButtonText, fontSize: 11, fontWeight: '700' }}
          >
            Cancel
          </Text>
        </Pressable>
      ) : (
        <Button variant="primary" className="h-8 px-3" onPress={onStart}>
          Auto-Sort
        </Button>
      )}
    </View>
  );
};
