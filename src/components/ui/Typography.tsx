import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTheme } from '../../theme';

export interface TypographyProps extends TextProps {
  children: React.ReactNode;
  className?: string;
}

export const H1: React.FC<TypographyProps> = ({ children, className = '', style, ...props }) => {
  const { theme } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[
        {
          color: theme.colors.textPrimary,
          fontSize: 24,
          fontWeight: '700',
          fontFamily: theme.isMono ? 'Courier' : undefined,
          letterSpacing: theme.isUppercase ? 1 : -0.5,
        },
        style,
      ]}
      className={className}
      {...props}
    >
      {children}
    </Text>
  );
};

export const H2: React.FC<TypographyProps> = ({ children, className = '', style, ...props }) => {
  const { theme } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[
        {
          color: theme.colors.textPrimary,
          fontSize: 18,
          fontWeight: '600',
          fontFamily: theme.isMono ? 'Courier' : undefined,
          letterSpacing: theme.isUppercase ? 0.5 : -0.2,
        },
        style,
      ]}
      className={className}
      {...props}
    >
      {children}
    </Text>
  );
};

export const Body: React.FC<TypographyProps> = ({ children, className = '', style, ...props }) => {
  const { theme } = useTheme();
  return (
    <Text
      style={[
        {
          color: theme.colors.textSecondary,
          fontSize: 15,
          lineHeight: 22,
          fontFamily: theme.isMono ? 'Courier' : undefined,
        },
        style,
      ]}
      className={className}
      {...props}
    >
      {children}
    </Text>
  );
};

export const Label: React.FC<TypographyProps> = ({ children, className = '', style, ...props }) => {
  const { theme } = useTheme();
  return (
    <Text
      style={[
        {
          color: theme.colors.textMuted,
          fontSize: 12,
          fontWeight: '600',
          fontFamily: theme.isMono ? 'Courier' : undefined,
          textTransform: theme.isUppercase ? 'uppercase' : 'none',
          letterSpacing: theme.isUppercase ? 1.5 : 0.5,
        },
        style,
      ]}
      className={className}
      {...props}
    >
      {children}
    </Text>
  );
};

export const Mono: React.FC<TypographyProps> = ({ children, className = '', style, ...props }) => {
  const { theme } = useTheme();
  return (
    <Text
      style={[
        {
          color: theme.colors.textSecondary,
          fontFamily: 'Courier',
          fontSize: 13,
        },
        style,
      ]}
      className={className}
      {...props}
    >
      {children}
    </Text>
  );
};

export const ErrorText: React.FC<TypographyProps> = ({
  children,
  className = '',
  style,
  ...props
}) => {
  const { theme } = useTheme();
  return (
    <Text
      style={[
        {
          color: theme.colors.destructiveButtonBg,
          fontFamily: theme.isMono ? 'Courier' : undefined,
          fontSize: 12,
          marginTop: 4,
        },
        style,
      ]}
      className={className}
      {...props}
    >
      {children}
    </Text>
  );
};
