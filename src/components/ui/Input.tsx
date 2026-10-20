import React, { useState } from 'react';
import { View, TextInput, TextInputProps, Text } from 'react-native';

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
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const borderClass = error ? 'border-red-500' : isFocused ? 'border-white' : 'border-zinc-800';

  return (
    <View className={`w-full mb-4 ${className}`}>
      {label && (
        <Text className="text-xs font-mono uppercase tracking-widest text-zinc-400 mb-2">
          {label}
        </Text>
      )}
      <TextInput
        className={`h-12 px-4 bg-zinc-950 text-white text-base border rounded-none ${borderClass} ${
          isMono ? 'font-mono' : ''
        }`}
        placeholderTextColor="#71717A"
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
        <Text testID="input-error-text" className="text-xs font-mono text-red-400 mt-1.5">
          {error}
        </Text>
      )}
    </View>
  );
};
