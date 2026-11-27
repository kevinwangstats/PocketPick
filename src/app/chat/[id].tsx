import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { H1, Body } from '@/components/ui';
import { useTheme } from '@/theme';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 20 }}>
      <H1 className="mb-2">Chat</H1>
      <Body>Person ID: {id}</Body>
    </View>
  );
}
