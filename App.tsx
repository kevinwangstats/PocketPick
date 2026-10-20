import React, { useState } from 'react';
import './global.css';
import { StatusBar } from 'expo-status-bar';
import { View, SafeAreaView } from 'react-native';
import { Button, Input, Card, H1, Body, Label } from './src/components/ui';

export default function App() {
  const [passphrase, setPassphrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTestUnlock = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1200);
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <StatusBar style="light" />
      <View className="flex-1 px-6 justify-center">
        <Label className="mb-2">PocketPick // Security Core</Label>
        <H1 className="mb-6">SECURE VAULT</H1>

        <Card className="mb-6">
          <Label className="mb-1">Active Status</Label>
          <Body className="text-zinc-400">
            Phase 0 Environment Verified. Envelope encryption and SQLCipher ready for Phase 1.
          </Body>
        </Card>

        <Input
          label="Vault Passphrase"
          placeholder="Enter master passphrase..."
          secureTextEntry
          isMono
          value={passphrase}
          onChangeText={setPassphrase}
        />

        <Button variant="primary" loading={isLoading} onPress={handleTestUnlock} className="mt-2">
          INITIALIZE VAULT
        </Button>
      </View>
    </SafeAreaView>
  );
}
