import React, { useState } from 'react';
import { View, Modal, Pressable, Text } from 'react-native';
import { Button, Input, H2, Label, ErrorText } from '../ui';

export interface CreateVaultModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string, passphrase: string) => Promise<void>;
}

export const CreateVaultModal: React.FC<CreateVaultModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Vault name is required');
      return;
    }
    if (passphrase.length < 6) {
      setError('Passphrase must be at least 6 characters');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(name.trim(), description.trim(), passphrase);
      setName('');
      setDescription('');
      setPassphrase('');
      setConfirmPassphrase('');
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to create vault');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/90 justify-center px-5">
        <View className="bg-black border border-zinc-700 p-6">
          <View className="flex-row justify-between items-center mb-4">
            <H2>NEW VAULT</H2>
            <Pressable onPress={onClose}>
              <Text className="text-zinc-500 font-mono text-base">[CLOSE]</Text>
            </Pressable>
          </View>

          <Label className="mb-4">Derives a 256-bit AES-GCM key with 100,000 PBKDF2 rounds.</Label>

          <Input
            label="Vault Name"
            placeholder="e.g. Passwords, Confidential Photos..."
            value={name}
            onChangeText={setName}
          />

          <Input
            label="Description (Optional)"
            placeholder="Optional context..."
            value={description}
            onChangeText={setDescription}
          />

          <Input
            label="Master Passphrase"
            placeholder="Min 6 characters..."
            secureTextEntry
            isMono
            value={passphrase}
            onChangeText={setPassphrase}
          />

          <Input
            label="Confirm Passphrase"
            placeholder="Re-enter passphrase..."
            secureTextEntry
            isMono
            value={confirmPassphrase}
            onChangeText={setConfirmPassphrase}
          />

          {error && <ErrorText className="mb-3">{error}</ErrorText>}

          <Button variant="primary" loading={isSubmitting} onPress={handleSubmit} className="mt-2">
            CREATE & INITIALIZE
          </Button>
        </View>
      </View>
    </Modal>
  );
};
