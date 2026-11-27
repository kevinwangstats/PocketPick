import React from 'react';
import { View } from 'react-native';
import { H1, Body, Label } from '@/components/ui';
import { useTheme } from '@/theme';

export default function ChatsScreen() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 20 }}>
      <Label className="mb-1">AI STYLISTS</Label>
      <H1 className="mb-2">{theme.isUppercase ? 'CHATS' : 'Chats'}</H1>
      <Body>Stylist conversations will appear here.</Body>
    </View>
  );
}
