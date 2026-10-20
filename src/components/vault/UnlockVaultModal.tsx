import React, { useState } from 'react';
import { View, Modal, Pressable, Text } from 'react-native';
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
    if (!passphrase) {
      setError('Enter your passphrase');
      return;
    }

    setIsUnlocking(true);
    try {
      const success = await onUnlock(passphrase);
      if (success) {
        setPassphrase('');
        onClose();
      } else {
        setError('Authentication failed. Check your passphrase.');
      }
    } catch (err) {
      setError((err as Error).message || 'Unlock error');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/90 justify-center px-5">
        <View className="bg-black border border-zinc-700 p-6">
          <View className="flex-row justify-between items-center mb-4">
            <H2>AUTHENTICATE</H2>
            <Pressable onPress={onClose}>
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
            onChangeText={setPassphrase}
          />

          {error && <ErrorText className="mb-3">{error}</ErrorText>}

          <Button variant="primary" loading={isUnlocking} onPress={handleUnlock} className="mt-2">
            VERIFY & UNLOCK
          </Button>
        </View>
      </View>
    </Modal>
  );
};
