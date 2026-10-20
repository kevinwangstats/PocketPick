import React, { useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button, Input, H2, Label, ErrorText } from '../ui';

export interface UnlockVaultModalProps {
  visible: boolean;
  vaultName: string;
  onClose: () => void;
  onUnlock: (passphrase: string) => Promise<boolean>;
}

export const UnlockVaultModal: React.FC<UnlockVaultModalProps> = ({
  visible,
  vaultName,
  onClose,
  onUnlock,
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleUnlock = async () => {
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (!passphrase) {
      setError('Enter your passphrase');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }

    setIsUnlocking(true);
    try {
      const success = await onUnlock(passphrase);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setPassphrase('');
        onClose();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setError('Authentication failed. Check your passphrase.');
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError((err as Error).message || 'Unlock error');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-black/95 justify-center px-5"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="bg-black border border-zinc-700 p-6 my-auto">
            <View className="flex-row justify-between items-center mb-4">
              <H2>AUTHENTICATE</H2>
              <Pressable
                onPress={() => {
                  setError(null);
                  onClose();
                }}
                hitSlop={12}
              >
                <Text className="text-zinc-500 font-mono text-base">[CLOSE]</Text>
              </Pressable>
            </View>

            <Label className="mb-4">TARGET: {vaultName}</Label>

            <Input
              label="Vault Passphrase"
              placeholder="Enter passphrase..."
              secureTextEntry
              isMono
              value={passphrase}
              onChangeText={(text) => {
                setPassphrase(text);
                if (error) setError(null);
              }}
            />

            {error && <ErrorText className="mb-3">{error}</ErrorText>}

            <Button variant="primary" loading={isUnlocking} onPress={handleUnlock} className="mt-2">
              VERIFY & UNLOCK
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};
