import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, Card, H1, Label } from '@/components/ui';
import { useTheme } from '@/theme';

export default function UnlockModal() {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState('');
  const { theme } = useTheme();

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} className="flex-1 px-5 py-6">
      <Label className="mb-2">AUTHORIZATION REQUIRED</Label>
      <H1 className="mb-6">ENTER PASSPHRASE</H1>

      <Card className="mb-6">
        <Input
          label="Passphrase"
          placeholder="Enter secret passphrase..."
          secureTextEntry
          isMono
          value={passphrase}
          onChangeText={setPassphrase}
        />
        <Button
          variant="primary"
          onPress={() => {
            router.back();
          }}
          className="mt-2"
        >
          AUTHENTICATE
        </Button>
      </Card>
    </ScrollView>
  );
}
