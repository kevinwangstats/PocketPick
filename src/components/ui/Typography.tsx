import React from 'react';
import { Text, TextProps } from 'react-native';

export interface TypographyProps extends TextProps {
  children: React.ReactNode;
  className?: string;
}

export const H1: React.FC<TypographyProps> = ({ children, className = '', ...props }) => (
  <Text
    accessibilityRole="header"
    className={`text-2xl font-bold tracking-tight text-white ${className}`}
    {...props}
  >
    {children}
  </Text>
);

export const H2: React.FC<TypographyProps> = ({ children, className = '', ...props }) => (
  <Text
    accessibilityRole="header"
    className={`text-lg font-semibold tracking-tight text-white ${className}`}
    {...props}
  >
    {children}
  </Text>
);

export const Body: React.FC<TypographyProps> = ({ children, className = '', ...props }) => (
  <Text className={`text-base text-zinc-300 leading-relaxed ${className}`} {...props}>
    {children}
  </Text>
);

export const Label: React.FC<TypographyProps> = ({ children, className = '', ...props }) => (
  <Text
    className={`text-xs font-mono uppercase tracking-widest text-zinc-400 ${className}`}
    {...props}
  >
    {children}
  </Text>
);

export const Mono: React.FC<TypographyProps> = ({ children, className = '', ...props }) => (
  <Text className={`font-mono text-sm text-zinc-200 ${className}`} {...props}>
    {children}
  </Text>
);

export const ErrorText: React.FC<TypographyProps> = ({ children, className = '', ...props }) => (
  <Text className={`text-xs font-mono text-red-400 mt-1 ${className}`} {...props}>
    {children}
  </Text>
);
