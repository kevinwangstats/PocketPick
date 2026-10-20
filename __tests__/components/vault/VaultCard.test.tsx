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
    expect(getByText(/locked/i)).toBeTruthy();
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

    expect(getByText(/unlocked/i)).toBeTruthy();
    const lockButton = getByText(/lock (vault|now)/i);
    fireEvent.press(lockButton);
    expect(onLockPressMock).toHaveBeenCalledTimes(1);
  });

  it('renders DELETE swipe action button and triggers onDeletePress when tapped', async () => {
    const onPressMock = jest.fn();
    const onDeletePressMock = jest.fn();
    const { getByText } = await render(
      <VaultCard
        id="vault-1"
        name="Archive"
        isUnlocked={false}
        onPress={onPressMock}
        onDeletePress={onDeletePressMock}
      />,
    );

    const deleteButton = getByText('DELETE');
    expect(deleteButton).toBeTruthy();
    fireEvent.press(deleteButton);
    expect(onDeletePressMock).toHaveBeenCalledTimes(1);
  });

  it('does not render DELETE button when onDeletePress is omitted', async () => {
    const onPressMock = jest.fn();
    const { queryByText } = await render(
      <VaultCard id="vault-1" name="Archive" isUnlocked={false} onPress={onPressMock} />,
    );

    expect(queryByText('DELETE')).toBeNull();
  });

  it('triggers onPress when card surface is pressed', async () => {
    const onPressMock = jest.fn();
    const { getByText } = await render(
      <VaultCard id="vault-1" name="Archive" isUnlocked={false} onPress={onPressMock} />,
    );

    fireEvent.press(getByText('Archive'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });
});
