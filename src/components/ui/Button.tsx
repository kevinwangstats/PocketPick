import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  PressableProps,
  GestureResponderEvent,
} from 'react-native';
import { useTheme } from '../../theme';

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
  const { theme } = useTheme();
  const isInteractive = !disabled && !loading;

  const getContainerStyle = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: theme.colors.secondaryButtonBg,
          borderColor: theme.colors.secondaryButtonBorder,
          borderWidth: 1,
        };
      case 'destructive':
        return {
          backgroundColor: theme.colors.destructiveButtonBg,
          borderColor: theme.colors.destructiveButtonBorder,
          borderWidth: 1,
        };
      case 'primary':
      default:
        return {
          backgroundColor: theme.colors.accent,
          borderColor: theme.colors.accentBorder,
          borderWidth: 1,
        };
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'secondary':
        return theme.colors.secondaryButtonText;
      case 'destructive':
        return theme.colors.destructiveButtonText;
      case 'primary':
      default:
        return theme.colors.accentText;
    }
  };

  const containerStyle = getContainerStyle();
  const textColor = getTextColor();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive }}
      disabled={!isInteractive}
      onPress={isInteractive ? onPress : undefined}
      style={[
        {
          height: 48,
          paddingHorizontal: 20,
          borderRadius: theme.borderRadius,
          opacity: disabled ? 0.4 : 1,
        },
        containerStyle,
      ]}
      className={`flex-row items-center justify-center active:opacity-80 ${className}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} testID="button-loading-indicator" />
      ) : typeof children === 'string' ? (
        <Text
          style={{
            color: textColor,
            fontFamily: theme.isMono ? 'Courier' : undefined,
            textTransform: theme.isUppercase ? 'uppercase' : 'none',
            letterSpacing: theme.isUppercase ? 1.5 : 0.5,
            fontWeight: '600',
            fontSize: 14,
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
};
