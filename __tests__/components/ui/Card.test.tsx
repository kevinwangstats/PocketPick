import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { Card } from '@/components/ui/Card';

describe('Card Component', () => {
  it('renders children content correctly in default view mode', async () => {
    const { getByText } = await render(
      <Card>
        <Text>Card Inner Content</Text>
      </Card>,
    );
    expect(getByText('Card Inner Content')).toBeTruthy();
  });

  it('triggers onPress when rendered as an interactive pressable card', async () => {
    const onPressMock = jest.fn();
    const { getByText } = await render(
      <Card onPress={onPressMock}>
        <Text>Interactive Card</Text>
      </Card>,
    );
    fireEvent.press(getByText('Interactive Card'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('renders subtle variant without errors', async () => {
    const { getByText } = await render(
      <Card variant="subtle">
        <Text>Subtle Background</Text>
      </Card>,
    );
    expect(getByText('Subtle Background')).toBeTruthy();
  });
});
