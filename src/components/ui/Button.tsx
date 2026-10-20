import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  PressableProps,
  GestureResponderEvent,
} from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  onPress?: (event: GestureResponderEvent) => void;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  onPress,
  ...props
}) => {
  const isInteractive = !disabled && !loading;

  const baseContainerStyle =
    'h-12 px-5 flex-row items-center justify-center rounded-none active:opacity-80';

  const variantContainerStyles: Record<ButtonVariant, string> = {
    primary: 'bg-white border border-white',
    secondary: 'bg-black border border-zinc-700',
    destructive: 'bg-black border border-red-500',
  };

  const variantTextStyles: Record<ButtonVariant, string> = {
    primary: 'text-black font-semibold',
    secondary: 'text-white font-medium',
    destructive: 'text-red-400 font-medium',
  };

  const disabledStyle = disabled ? 'opacity-40' : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive }}
      disabled={!isInteractive}
      onPress={isInteractive ? onPress : undefined}
      className={`${baseContainerStyle} ${variantContainerStyles[variant]} ${disabledStyle} ${className}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#000000' : '#FFFFFF'}
          testID="button-loading-indicator"
        />
      ) : typeof children === 'string' ? (
        <Text
          className={`text-sm tracking-wider uppercase font-mono ${variantTextStyles[variant]}`}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
};
