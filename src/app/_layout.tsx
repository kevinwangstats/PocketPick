import '../polyfills';
import React, { useEffect, useState } from 'react';
import '../../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, LogBox } from 'react-native';

LogBox.ignoreAllLogs(true);
import { getDatabase } from '../db/client';
import { useAutoLock } from '../hooks/useAutoLock';
import { PrivacyShield } from '../components/security/PrivacyShield';
import { ThemeProvider, useTheme } from '../theme';

function RootContent() {
  const { theme } = useTheme();
  const { isShieldActive } = useAutoLock();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <PrivacyShield visible={isShieldActive} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.headerBg },
          headerTintColor: theme.colors.headerText,
          headerTitleStyle: {
            fontFamily: theme.isMono ? 'Courier' : undefined,
            fontWeight: 'bold',
          },
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="vault/[id]"
          options={{
            title: theme.isUppercase ? 'VAULT CONTENTS' : 'Vault Contents',
            headerBackTitle: theme.isUppercase ? 'BACK' : 'Back',
          }}
        />
        <Stack.Screen
          name="vault/unlock"
          options={{
            presentation: 'modal',
            title: theme.isUppercase ? 'UNLOCK VAULT' : 'Unlock Vault',
          }}
        />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        await getDatabase();
      } catch (err) {
        console.error('Database initialization note:', err);
      } finally {
        setIsDbReady(true);
      }
    }
    init();
  }, []);

  if (!isDbReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#000000',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="small" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <RootContent />
    </ThemeProvider>
  );
}
