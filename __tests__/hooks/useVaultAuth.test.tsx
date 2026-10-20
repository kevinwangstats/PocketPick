import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { View, Button, Text } from 'react-native';
import { useVaultAuth } from '@/hooks/useVaultAuth';
import { useSessionStore } from '@/stores/useSessionStore';
import { closeDatabase } from '@/db/client';

function TestComponent() {
  const { activeVaultId, isUnlocked, error, createVault, lockVault } = useVaultAuth();
  return (
    <View>
      <Text testID="unlocked">{isUnlocked ? 'true' : 'false'}</Text>
      <Text testID="vaultId">{activeVaultId || 'none'}</Text>
      <Text testID="error">{error || 'none'}</Text>
      <Button
        testID="create-btn"
        title="Create"
        onPress={() => {
          createVault('Confidential Vault', 'Medical', 'MasterPassphrase123!').catch(() => {});
        }}
      />
      <Button
        testID="create-empty-btn"
        title="Create Empty"
        onPress={() => {
          createVault('   ', '', 'MasterPassphrase123!').catch(() => {});
        }}
      />
      <Button
        testID="create-short-btn"
        title="Create Short"
        onPress={() => {
          createVault('Valid Name', '', '123').catch(() => {});
        }}
      />
      <Button
        testID="create-dup-btn"
        title="Create Duplicate"
        onPress={() => {
          createVault('confidential vault', 'Different', 'AnotherPass123!').catch(() => {});
        }}
      />
      <Button testID="lock-btn" title="Lock" onPress={() => lockVault()} />
    </View>
  );
}

describe('useVaultAuth Hook & Vault Lifecycle', () => {
  beforeEach(() => {
    closeDatabase();
    useSessionStore.setState({
      activeVaultId: null,
      activeVaultKey: null,
      lastActiveTimestamp: null,
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    closeDatabase();
  });

  it('creates a new vault, derives key, and sets active session', async () => {
    const { getByTestId } = await render(<TestComponent />);

    expect(getByTestId('unlocked').props.children).toBe('false');
    expect(getByTestId('vaultId').props.children).toBe('none');

    fireEvent.press(getByTestId('create-btn'));

    await waitFor(() => {
      expect(getByTestId('unlocked').props.children).toBe('true');
    });

    const activeId = getByTestId('vaultId').props.children;
    expect(activeId).not.toBe('none');
    expect(useSessionStore.getState().activeVaultId).toBe(activeId);
    expect(useSessionStore.getState().activeVaultKey).not.toBeNull();
  });

  it('locks vault and zeroizes active key in session store', async () => {
    const { getByTestId } = await render(<TestComponent />);

    fireEvent.press(getByTestId('create-btn'));

    await waitFor(() => {
      expect(getByTestId('unlocked').props.children).toBe('true');
    });

    fireEvent.press(getByTestId('lock-btn'));

    await waitFor(() => {
      expect(getByTestId('unlocked').props.children).toBe('false');
      expect(getByTestId('vaultId').props.children).toBe('none');
    });

    expect(useSessionStore.getState().activeVaultId).toBeNull();
    expect(useSessionStore.getState().activeVaultKey).toBeNull();
  });

  it('rejects vault creation when name is empty', async () => {
    const { getByTestId } = await render(<TestComponent />);

    fireEvent.press(getByTestId('create-empty-btn'));

    await waitFor(() => {
      expect(getByTestId('error').props.children).toBe('Vault name is required');
    });

    expect(getByTestId('unlocked').props.children).toBe('false');
  });

  it('rejects vault creation when passphrase is too short', async () => {
    const { getByTestId } = await render(<TestComponent />);

    fireEvent.press(getByTestId('create-short-btn'));

    await waitFor(() => {
      expect(getByTestId('error').props.children).toBe('Passphrase must be at least 6 characters');
    });

    expect(getByTestId('unlocked').props.children).toBe('false');
  });
});
