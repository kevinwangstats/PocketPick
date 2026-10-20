import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#000000',
          borderBottomWidth: 1,
          borderBottomColor: '#27272A',
        },
        headerTitleStyle: {
          color: '#FFFFFF',
          fontFamily: 'Courier',
          fontSize: 15,
          fontWeight: 'bold',
          letterSpacing: 2,
        },
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: '#27272A',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#52525B',
        tabBarLabelStyle: {
          fontFamily: 'Courier',
          fontSize: 10,
          letterSpacing: 1.5,
          fontWeight: '600',
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'VAULTS',
          tabBarLabel: 'VAULTS',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontFamily: 'Courier', fontSize: 16 }}>[V]</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="randomizer"
        options={{
          title: 'RANDOMIZER',
          tabBarLabel: 'PICK',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontFamily: 'Courier', fontSize: 16 }}>[?]</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'SELECTION AUDIT',
          tabBarLabel: 'TIMELINE',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontFamily: 'Courier', fontSize: 16 }}>[#]</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'SYSTEM & SECURITY',
          tabBarLabel: 'SYSTEM',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontFamily: 'Courier', fontSize: 16 }}>[*]</Text>
          ),
        }}
      />
    </Tabs>
  );
}
