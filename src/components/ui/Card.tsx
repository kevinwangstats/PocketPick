import React from 'react';
import { View, ViewProps, Pressable } from 'react-native';
import { useTheme } from '../../theme';

export interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'subtle';
  className?: string;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  style,
  onPress,
  ...props
}) => {
  const { theme } = useTheme();

  const cardBg = variant === 'default' ? theme.colors.card : theme.isDark ? '#18181B' : '#F9F9F9';
  const cardBorder = theme.colors.cardBorder;

  const cardStyle = {
    backgroundColor: cardBg,
    borderColor: cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius,
    padding: 16,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={[cardStyle, style]}
        className={`active:opacity-90 ${className}`}
        accessibilityRole="button"
        {...props}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[cardStyle, style]} className={className} {...props}>
      {children}
    </View>
  );
};
