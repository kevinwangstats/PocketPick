import React from 'react';
import { render } from '@testing-library/react-native';
import { H1, H2, Body, Label, Mono, ErrorText } from '@/components/ui/Typography';

describe('Typography Components', () => {
  it('renders H1 header text with header accessibility role', async () => {
    const { getByText, getByRole } = await render(<H1>Main Title</H1>);
    expect(getByText('Main Title')).toBeTruthy();
    expect(getByRole('header')).toBeTruthy();
  });

  it('renders H2 header text', async () => {
    const { getByText } = await render(<H2>Sub Title</H2>);
    expect(getByText('Sub Title')).toBeTruthy();
  });

  it('renders Body text', async () => {
    const { getByText } = await render(<Body>Standard body paragraph text.</Body>);
    expect(getByText('Standard body paragraph text.')).toBeTruthy();
  });

  it('renders Label text', async () => {
    const { getByText } = await render(<Label>Status Badge</Label>);
    expect(getByText('Status Badge')).toBeTruthy();
  });

  it('renders Mono code text', async () => {
    const { getByText } = await render(<Mono>0xDEADBEEF</Mono>);
    expect(getByText('0xDEADBEEF')).toBeTruthy();
  });

  it('renders ErrorText alert', async () => {
    const { getByText } = await render(<ErrorText>Failed to decrypt</ErrorText>);
    expect(getByText('Failed to decrypt')).toBeTruthy();
  });
});
