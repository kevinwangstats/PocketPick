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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (!name.trim()) {
      setError('Vault name is required');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    if (passphrase.length < 6) {
      setError('Passphrase must be at least 6 characters');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(name.trim(), description.trim(), passphrase);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setName('');
      setDescription('');
      setPassphrase('');
      setConfirmPassphrase('');
      onClose();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError((err as Error).message || 'Failed to create vault');
    } finally {
      setIsSubmitting(false);
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
              <H2>NEW VAULT</H2>
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

            <Label className="mb-4">
              DERIVES A 256-BIT AES-GCM KEY WITH 100,000 PBKDF2 ROUNDS.
            </Label>

            <Input
              label="Vault Name"
              placeholder="e.g. photos, secrets..."
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (error) setError(null);
              }}
            />

            <Input
              label="Description (Optional)"
              placeholder="Optional context..."
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                if (error) setError(null);
              }}
            />

            <Input
              label="Master Passphrase"
              placeholder="Min 6 characters..."
              secureTextEntry
              isMono
              value={passphrase}
              onChangeText={(text) => {
                setPassphrase(text);
                if (error) setError(null);
              }}
            />

            <Input
              label="Confirm Passphrase"
              placeholder="Re-enter passphrase..."
              secureTextEntry
              isMono
              value={confirmPassphrase}
              onChangeText={(text) => {
                setConfirmPassphrase(text);
                if (error) setError(null);
              }}
            />

            {error && <ErrorText className="mb-3">{error}</ErrorText>}

            <Button
              variant="primary"
              loading={isSubmitting}
              onPress={handleSubmit}
              className="mt-2"
            >
              CREATE & INITIALIZE
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};
