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
  const { theme } = useTheme();
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
              <H2>{theme.isUppercase ? 'AUTHENTICATE' : 'Authenticate'}</H2>
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
              {theme.isUppercase ? `TARGET: ${vaultName.toUpperCase()}` : `Target: ${vaultName}`}
            </Label>

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
              {theme.isUppercase ? 'VERIFY & UNLOCK' : 'Verify & Unlock'}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};
