import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../theme';

export default function TabsLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.headerBg,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.headerBorder,
        },
        headerTitleStyle: {
          color: theme.colors.headerText,
          fontFamily: theme.isMono ? 'Courier' : undefined,
          fontSize: 16,
          fontWeight: 'bold',
          letterSpacing: theme.isUppercase ? 2 : 0,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.tabBarBg,
          borderTopColor: theme.colors.tabBarBorder,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.tabBarActive,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
        tabBarLabelStyle: {
          fontFamily: theme.isMono ? 'Courier' : undefined,
          fontSize: 11,
          letterSpacing: theme.isUppercase ? 1.5 : 0.2,
          fontWeight: '600',
          textTransform: theme.isUppercase ? 'uppercase' : 'none',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: theme.isUppercase ? 'VAULTS' : 'Vaults',
          tabBarLabel: theme.isUppercase ? 'VAULTS' : 'Vaults',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontFamily: theme.isMono ? 'Courier' : undefined, fontSize: 16 }}>
              {theme.isMono ? '[V]' : '🔐'}
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="randomizer"
        options={{
          title: theme.isUppercase ? 'RANDOMIZER' : 'Picker',
          tabBarLabel: theme.isUppercase ? 'PICK' : 'Pick',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontFamily: theme.isMono ? 'Courier' : undefined, fontSize: 16 }}>
              {theme.isMono ? '[?]' : '🎲'}
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: theme.isUppercase ? 'SELECTION AUDIT' : 'Timeline',
          tabBarLabel: theme.isUppercase ? 'TIMELINE' : 'Timeline',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontFamily: theme.isMono ? 'Courier' : undefined, fontSize: 16 }}>
              {theme.isMono ? '[#]' : '📜'}
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: theme.isUppercase ? 'SYSTEM & SECURITY' : 'Settings',
          tabBarLabel: theme.isUppercase ? 'SYSTEM' : 'System',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontFamily: theme.isMono ? 'Courier' : undefined, fontSize: 16 }}>
              {theme.isMono ? '[*]' : '⚙️'}
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}
