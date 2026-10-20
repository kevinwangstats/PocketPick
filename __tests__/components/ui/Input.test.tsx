import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Input } from '@/components/ui/Input';

describe('Input Component', () => {
  it('renders label and placeholder correctly', async () => {
    const { getByText, getByPlaceholderText } = await render(
      <Input label="Vault Name" placeholder="Enter vault name..." />,
    );
    expect(getByText('Vault Name')).toBeTruthy();
    expect(getByPlaceholderText('Enter vault name...')).toBeTruthy();
  });

  it('handles text input changes', async () => {
    const onChangeTextMock = jest.fn();
    const { getByPlaceholderText } = await render(
      <Input placeholder="Type here..." onChangeText={onChangeTextMock} />,
    );
    const input = getByPlaceholderText('Type here...');
    await act(async () => {
      fireEvent.changeText(input, 'New Secret Value');
    });
    expect(onChangeTextMock).toHaveBeenCalledWith('New Secret Value');
  });

  it('renders error message when error prop is provided', async () => {
    const { getByTestId, getByText } = await render(
      <Input placeholder="Field" error="Invalid passphrase length" />,
    );
    expect(getByTestId('input-error-text')).toBeTruthy();
    expect(getByText('Invalid passphrase length')).toBeTruthy();
  });

  it('handles focus and blur events', async () => {
    const onFocusMock = jest.fn();
    const onBlurMock = jest.fn();
    const { getByPlaceholderText } = await render(
      <Input placeholder="Focus test" onFocus={onFocusMock} onBlur={onBlurMock} />,
    );
    const input = getByPlaceholderText('Focus test');
    await act(async () => {
      fireEvent(input, 'focus');
    });
    expect(onFocusMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent(input, 'blur');
    });
    expect(onBlurMock).toHaveBeenCalledTimes(1);
  });
});
