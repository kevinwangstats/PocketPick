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
import { useTheme } from '../../theme';

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
  const { theme } = useTheme();
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
        style={{
          flex: 1,
          backgroundColor: theme.isDark ? 'rgba(0,0,0,0.88)' : 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          paddingHorizontal: 20,
        }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 14 : 0,
              padding: 24,
              marginVertical: 'auto',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 10,
              elevation: 5,
            }}
          >
            <View className="flex-row justify-between items-center mb-4">
              <H2>{theme.isUppercase ? 'NEW VAULT' : 'New Vault'}</H2>
              <Pressable
                onPress={() => {
                  setError(null);
                  onClose();
                }}
                hitSlop={12}
              >
                <Text
                  style={{
                    color: theme.colors.accent,
                    fontFamily: theme.isMono ? 'Courier' : undefined,
                    fontWeight: '600',
                    fontSize: 14,
                  }}
                >
                  {theme.isUppercase ? '[CLOSE]' : 'Close'}
                </Text>
              </Pressable>
            </View>

            <Label className="mb-4">
              {theme.isUppercase
                ? 'DERIVES A 256-BIT AES-GCM KEY WITH 100,000 PBKDF2 ROUNDS.'
                : 'Derives a 256-bit AES-GCM key with 100,000 PBKDF2 rounds.'}
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
              {theme.isUppercase ? 'CREATE & INITIALIZE' : 'Create & Initialize'}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};
