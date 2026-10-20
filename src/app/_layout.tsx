import '../polyfills';
import React, { useEffect, useState } from 'react';
import '../../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, LogBox } from 'react-native';

LogBox.ignoreLogs(['ImageBackground is deprecated']);
import { getDatabase } from '../db/client';
import { useAutoLock } from '../hooks/useAutoLock';
import { PrivacyShield } from '../components/security/PrivacyShield';

export default function RootLayout() {
  const [isDbReady, setIsDbReady] = useState(false);
  const { isShieldActive } = useAutoLock();

  useEffect(() => {
    async function init() {
      try {
        await getDatabase();
      } catch (err) {
        // Fallback for non-native / test environments
        console.error('Database initialization note:', err);
      } finally {
        setIsDbReady(true);
      }
    }
    init();
  }, []);

  if (!isDbReady) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="small" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <PrivacyShield visible={isShieldActive} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#000000' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontFamily: 'Courier',
            fontWeight: 'bold',
          },
          contentStyle: { backgroundColor: '#000000' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="vault/[id]"
          options={{
            title: 'VAULT CONTENTS',
            headerBackTitle: 'BACK',
          }}
        />
        <Stack.Screen
          name="vault/unlock"
          options={{
            presentation: 'modal',
            title: 'UNLOCK VAULT',
          }}
        />
      </Stack>
    </View>
  );
}
