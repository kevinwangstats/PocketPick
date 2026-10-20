import React from 'react';
import { View, ViewProps, Pressable } from 'react-native';

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
  onPress,
  ...props
}) => {
  const bgStyle = variant === 'default' ? 'bg-black' : 'bg-zinc-900';
  const borderStyle = 'border border-zinc-800 rounded-none p-4';

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`${bgStyle} ${borderStyle} active:border-zinc-500 active:opacity-90 ${className}`}
        accessibilityRole="button"
        {...props}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={`${bgStyle} ${borderStyle} ${className}`} {...props}>
      {children}
    </View>
  );
};
