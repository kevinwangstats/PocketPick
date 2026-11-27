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
          letterSpacing: theme.isUppercase ? 1.2 : 0.2,
          fontWeight: '600',
          textTransform: theme.isUppercase ? 'uppercase' : 'none',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: theme.isUppercase ? 'CHATS' : 'Chats',
          tabBarLabel: theme.isUppercase ? 'CHATS' : 'Chats',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontFamily: theme.isMono ? 'Courier' : undefined, fontSize: 16 }}>
              {theme.isMono ? '[C]' : '💬'}
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: theme.isUppercase ? 'WARDROBE' : 'Wardrobe',
          tabBarLabel: theme.isUppercase ? 'WARDROBE' : 'Wardrobe',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontFamily: theme.isMono ? 'Courier' : undefined, fontSize: 16 }}>
              {theme.isMono ? '[W]' : '👗'}
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="past-ootd"
        options={{
          title: theme.isUppercase ? 'PAST OOTD' : 'Past OOTD',
          tabBarLabel: theme.isUppercase ? 'PAST OOTD' : 'Past OOTD',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontFamily: theme.isMono ? 'Courier' : undefined, fontSize: 16 }}>
              {theme.isMono ? '[O]' : '✨'}
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: theme.isUppercase ? 'SETTINGS' : 'Settings',
          tabBarLabel: theme.isUppercase ? 'SETTINGS' : 'Settings',
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
