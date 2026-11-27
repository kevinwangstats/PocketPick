import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import * as SecureStore from 'expo-secure-store';

describe('Theme System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provides classic-ios as default initial theme', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = await renderHook(() => useTheme(), { wrapper });

    expect(result.current.themeId).toBe('classic-ios');
    expect(result.current.theme.name).toBe('Classic iOS');
    expect(result.current.theme.isDark).toBe(false);
    expect(result.current.theme.colors.accent).toBe('#007AFF');
  });

  it('switches to sakura-pink, velvet-noir, and champagne-silk luxury themes', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = await renderHook(() => useTheme(), { wrapper });

    await act(async () => {
      result.current.setTheme('velvet-noir');
    });
    expect(result.current.themeId).toBe('velvet-noir');
    expect(result.current.theme.name).toBe('Velvet Noir');
    expect(result.current.theme.isDark).toBe(true);
    expect(result.current.theme.colors.accent).toBe('#E2B778');

    await act(async () => {
      result.current.setTheme('champagne-silk');
    });
    expect(result.current.themeId).toBe('champagne-silk');
    expect(result.current.theme.name).toBe('Champagne Silk');
    expect(result.current.theme.isDark).toBe(false);
    expect(result.current.theme.colors.accent).toBe('#9A5B62');

    await act(async () => {
      result.current.setTheme('sakura-pink');
    });
    expect(result.current.themeId).toBe('sakura-pink');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'pocketpick_theme_preference',
      'sakura-pink',
      expect.anything(),
    );
  });

  it('switches to cyber terminal theme', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = await renderHook(() => useTheme(), { wrapper });

    await act(async () => {
      result.current.setTheme('cyber');
    });

    expect(result.current.themeId).toBe('cyber');
    expect(result.current.theme.isDark).toBe(true);
    expect(result.current.theme.isMono).toBe(true);
    expect(result.current.theme.isUppercase).toBe(true);
  });

  it('loads persisted luxury theme from storage on mount', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('velvet-noir');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = await renderHook(() => useTheme(), { wrapper });

    expect(result.current.themeId).toBe('velvet-noir');
  });
});
