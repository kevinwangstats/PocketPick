import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VaultCard } from '@/components/vault/VaultCard';

describe('VaultCard Component', () => {
  it('renders vault name and locked badge correctly', async () => {
    const onPressMock = jest.fn();
    const { getByText } = await render(
      <VaultCard
        id="vault-1"
        name="Personal Secrets"
        description="Encrypted notes and keys"
        isUnlocked={false}
        onPress={onPressMock}
      />,
    );

    expect(getByText('Personal Secrets')).toBeTruthy();
    expect(getByText('Encrypted notes and keys')).toBeTruthy();
    expect(getByText('LOCKED')).toBeTruthy();
  });

  it('renders UNLOCKED badge and lock button when isUnlocked is true', async () => {
    const onPressMock = jest.fn();
    const onLockPressMock = jest.fn();
    const { getByText } = await render(
      <VaultCard
        id="vault-1"
        name="Personal Secrets"
        isUnlocked={true}
        onPress={onPressMock}
        onLockPress={onLockPressMock}
      />,
    );

    expect(getByText('UNLOCKED')).toBeTruthy();
    const lockButton = getByText('LOCK NOW');
    fireEvent.press(lockButton);
    expect(onLockPressMock).toHaveBeenCalledTimes(1);
  });
});
