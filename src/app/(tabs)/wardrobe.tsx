import React from 'react';
import { View } from 'react-native';
import { H1, Body, Label } from '@/components/ui';
import { useTheme } from '@/theme';

export default function WardrobeScreen() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 20 }}>
      <Label className="mb-1">PRIVATE SANDBOX</Label>
      <H1 className="mb-2">{theme.isUppercase ? 'WARDROBE' : 'Wardrobe'}</H1>
      <Body>Your isolated garment items will appear here.</Body>
    </View>
  );
}
