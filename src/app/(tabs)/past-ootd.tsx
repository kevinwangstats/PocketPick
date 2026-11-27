import React from 'react';
import { View } from 'react-native';
import { H1, Body, Label } from '@/components/ui';
import { useTheme } from '@/theme';

export default function PastOotdScreen() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 20 }}>
      <Label className="mb-1">WORN LOOKS</Label>
      <H1 className="mb-2">{theme.isUppercase ? 'PAST OOTD' : 'Past OOTD'}</H1>
      <Body>Your full-body OOTD photos and saved looks will appear here.</Body>
    </View>
  );
}
