import React, { useState } from 'react';
import { View, TextInput, TextInputProps, Text } from 'react-native';
import { useTheme } from '../../theme';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  isMono?: boolean;
  className?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  isMono = false,
  className = '',
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? theme.colors.destructiveButtonBg
    : isFocused
      ? theme.colors.inputBorderFocus
      : theme.colors.inputBorder;

  return (
    <View className={`w-full mb-4 ${className}`}>
      {label && (
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontFamily: theme.isMono ? 'Courier' : undefined,
            textTransform: theme.isUppercase ? 'uppercase' : 'none',
            letterSpacing: theme.isUppercase ? 1.5 : 0.5,
            fontSize: 12,
            marginBottom: 6,
            fontWeight: '500',
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        style={[
          {
            height: 48,
            paddingHorizontal: 16,
            backgroundColor: theme.colors.inputBg,
            color: theme.colors.inputText,
            borderColor: borderColor,
            borderWidth: 1,
            borderRadius: theme.borderRadius,
            fontSize: 15,
            fontFamily: isMono || theme.isMono ? 'Courier' : undefined,
          },
          style,
        ]}
        placeholderTextColor={theme.colors.inputPlaceholder}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {error && (
        <Text
          testID="input-error-text"
          style={{
            color: theme.colors.destructiveButtonBg,
            fontFamily: theme.isMono ? 'Courier' : undefined,
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
};
