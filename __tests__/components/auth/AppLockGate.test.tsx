import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme';
import { AppLockGate } from '@/components/auth/AppLockGate';
import * as appAuthService from '@/services/auth/appAuthService';
import { useSessionStore } from '@/stores/useSessionStore';
import QuickCrypto from 'react-native-quick-crypto';

describe('AppLockGate Non-Destructive Overlay (TDD)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    useSessionStore.getState().lockApp();
  });

  it('renders first-time Master Passphrase setup when uninitialized and unlocks cleanly', async () => {
    jest.spyOn(appAuthService, 'isAppPassphraseInitialized').mockResolvedValue(false);
    jest.spyOn(appAuthService, 'isBiometricHardwareAvailable').mockResolvedValue(false);
    jest.spyOn(appAuthService, 'isBiometricUnlockEnabled').mockResolvedValue(false);
    const initSpy = jest
      .spyOn(appAuthService, 'initializeAppPassphrase')
      .mockImplementation(async () => {
        const k = QuickCrypto.randomBytes(32);
        useSessionStore.getState().setAppSessionKey(k);
        return k;
      });

    const { getByText, getByPlaceholderText, queryByText } = await render(
      <ThemeProvider>
        <AppLockGate>
          <Text>CHATS SCREEN CONTENT</Text>
        </AppLockGate>
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText(/Create Master Passphrase/i)).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Min 6 characters...'), 'velvet-123');
      fireEvent.changeText(getByPlaceholderText('Re-enter passphrase...'), 'velvet-123');
    });

    await act(async () => {
      fireEvent.press(getByText(/Initialize & Enter/i));
    });

    await waitFor(() => expect(initSpy).toHaveBeenCalledWith('velvet-123'));
    await waitFor(() => expect(queryByText(/Initialize & Enter/i)).toBeNull());
    expect(getByText('CHATS SCREEN CONTENT')).toBeTruthy();
  });

  it('preserves child subtree underneath lock overlay and offers Face ID when enabled', async () => {
    jest.spyOn(appAuthService, 'isAppPassphraseInitialized').mockResolvedValue(true);
    jest.spyOn(appAuthService, 'isBiometricHardwareAvailable').mockResolvedValue(true);
    jest.spyOn(appAuthService, 'isBiometricUnlockEnabled').mockResolvedValue(true);
    const bioSpy = jest.spyOn(appAuthService, 'unlockWithBiometrics').mockResolvedValue(false);

    const { getByText } = await render(
      <ThemeProvider>
        <AppLockGate>
          <Text>PRESERVED CHAT DRAFT</Text>
        </AppLockGate>
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText(/Unlock with Face ID/i)).toBeTruthy());
    expect(bioSpy).toHaveBeenCalledTimes(1);
    expect(getByText('PRESERVED CHAT DRAFT')).toBeTruthy();
  });
});
