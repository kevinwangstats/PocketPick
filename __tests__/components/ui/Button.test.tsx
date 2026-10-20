import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/Button';

describe('Button Component', () => {
  it('renders children text correctly', async () => {
    const { getByText } = await render(<Button>TEST BUTTON</Button>);
    expect(getByText('TEST BUTTON')).toBeTruthy();
  });

  it('triggers onPress when clicked', async () => {
    const onPressMock = jest.fn();
    const { getByText } = await render(<Button onPress={onPressMock}>CLICK ME</Button>);
    fireEvent.press(getByText('CLICK ME'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onPress when disabled', async () => {
    const onPressMock = jest.fn();
    const { getByText } = await render(
      <Button disabled onPress={onPressMock}>
        DISABLED BUTTON
      </Button>,
    );
    fireEvent.press(getByText('DISABLED BUTTON'));
    expect(onPressMock).not.toHaveBeenCalled();
  });

  it('displays loading indicator when loading is true', async () => {
    const { getByTestId, queryByText } = await render(<Button loading>SHOULD NOT DISPLAY</Button>);
    expect(getByTestId('button-loading-indicator')).toBeTruthy();
    expect(queryByText('SHOULD NOT DISPLAY')).toBeNull();
  });

  it('renders destructive variant without crashing', async () => {
    const { getByText } = await render(<Button variant="destructive">DELETE ITEM</Button>);
    expect(getByText('DELETE ITEM')).toBeTruthy();
  });
});
