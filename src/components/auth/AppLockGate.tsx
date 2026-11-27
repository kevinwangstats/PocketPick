import React, { useState, useEffect, useRef } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button, Input, H1, Body, Label, ErrorText, Card } from '../ui';
import { useAppAuth } from '../../hooks/useAppAuth';
import { useTheme } from '../../theme';

export interface AppLockGateProps {
  children: React.ReactNode;
}

/**
 * Non-destructive Unified Master Lock Overlay.
 * Mounted above the navigation tree so locking/unlocking never destroys active chat scroll
 * position or unsent message drafts.
 */
export const AppLockGate: React.FC<AppLockGateProps> = ({ children }) => {
  const { theme } = useTheme();
  const {
    isInitialized,
    isUnlocked,
    biometricAvailable,
    biometricEnabled,
    isLoading,
    error,
    setupPassphrase,
    unlock,
    unlockBiometric,
    clearError,
  } = useAppAuth();

  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const promptedBioRef = useRef(false);

  // Auto-prompt Face ID once when locked and biometric quick unlock is enabled
  useEffect(() => {
    if (
      isInitialized === true &&
      !isUnlocked &&
      biometricAvailable &&
      biometricEnabled &&
      !promptedBioRef.current
    ) {
      promptedBioRef.current = true;
      unlockBiometric().catch(() => {});
    }
    if (isUnlocked) {
      promptedBioRef.current = false;
    }
  }, [isInitialized, isUnlocked, biometricAvailable, biometricEnabled, unlockBiometric]);

  const handleSetup = async () => {
    setLocalError(null);
    clearError();
    if (passphrase.length < 6) {
      setLocalError('Passphrase must be at least 6 characters');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setLocalError('Passphrases do not match');
      return;
    }

    try {
      await setupPassphrase(passphrase);
      setPassphrase('');
      setConfirmPassphrase('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to initialize passphrase');
    }
  };

  const handleUnlock = async () => {
    setLocalError(null);
    clearError();
    if (!passphrase) {
      setLocalError('Enter your master passphrase');
      return;
    }

    const ok = await unlock(passphrase);
    if (ok) {
      setPassphrase('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const handleBiometricPress = async () => {
    setLocalError(null);
    clearError();
    const ok = await unlockBiometric();
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const displayError = localError || error;
  const shouldRenderGate = isInitialized === false || !isUnlocked;

  return (
    <View style={{ flex: 1 }}>
      {isInitialized !== null ? children : null}

      {shouldRenderGate && isInitialized !== null && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.colors.background,
              zIndex: 900,
            },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                paddingHorizontal: 24,
                paddingVertical: 40,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <Label className="mb-2">
                {isInitialized
                  ? theme.isUppercase
                    ? 'PRIVATE WARDROBE LOCKED'
                    : 'Private Wardrobe Locked'
                  : theme.isUppercase
                    ? 'FIRST-TIME SECURITY SETUP'
                    : 'First-Time Security Setup'}
              </Label>

              <H1 className="mb-2">
                {isInitialized
                  ? theme.isUppercase
                    ? 'UNLOCK OOTD'
                    : 'Unlock PocketPick OOTD'
                  : theme.isUppercase
                    ? 'CREATE MASTER PASSPHRASE'
                    : 'Create Master Passphrase'}
              </H1>

              <Body className="mb-6">
                {isInitialized
                  ? 'Enter your passphrase to decrypt your Personas, Chats, and Private Wardrobe in memory.'
                  : 'One master passphrase secures all your AI stylists, private chats, and app-only wardrobe photos with AES-256-GCM.'}
              </Body>

              <Card className="p-5">
                <Input
                  label="Master Passphrase"
                  placeholder="Min 6 characters..."
                  secureTextEntry
                  isMono
                  value={passphrase}
                  onChangeText={(val) => {
                    setPassphrase(val);
                    if (displayError) {
                      setLocalError(null);
                      clearError();
                    }
                  }}
                  onSubmitEditing={isInitialized ? handleUnlock : undefined}
                />

                {!isInitialized && (
                  <Input
                    label="Confirm Master Passphrase"
                    placeholder="Re-enter passphrase..."
                    secureTextEntry
                    isMono
                    value={confirmPassphrase}
                    onChangeText={(val) => {
                      setConfirmPassphrase(val);
                      if (displayError) {
                        setLocalError(null);
                        clearError();
                      }
                    }}
                    onSubmitEditing={handleSetup}
                  />
                )}

                {displayError && <ErrorText className="mb-3">{displayError}</ErrorText>}

                <Button
                  variant="primary"
                  loading={isLoading}
                  onPress={isInitialized ? handleUnlock : handleSetup}
                >
                  {isInitialized
                    ? theme.isUppercase
                      ? 'UNLOCK SESSION'
                      : 'Unlock'
                    : theme.isUppercase
                      ? 'INITIALIZE & ENTER'
                      : 'Initialize & Enter'}
                </Button>

                {isInitialized && biometricAvailable && biometricEnabled && (
                  <View className="mt-3">
                    <Button variant="secondary" onPress={handleBiometricPress} disabled={isLoading}>
                      <Text
                        style={{
                          color: theme.colors.secondaryButtonText,
                          fontFamily: theme.isMono ? 'Courier' : undefined,
                          fontWeight: '600',
                        }}
                      >
                        {theme.isUppercase ? 'UNLOCK WITH FACE ID' : 'Unlock with Face ID'}
                      </Text>
                    </Button>
                  </View>
                )}
              </Card>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      )}
    </View>
  );
};
