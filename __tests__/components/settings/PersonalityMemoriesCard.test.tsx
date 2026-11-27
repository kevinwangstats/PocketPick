import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme';
import { PersonalityMemoriesCard } from '@/components/settings/PersonalityMemoriesCard';
import * as personService from '@/services/persons/personService';
import * as personMemoryService from '@/services/persons/personMemoryService';
import { Person } from '@/db/schema';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

describe('PersonalityMemoriesCard & Modal in Settings (TDD)', () => {
  const celeste: Person = {
    id: 'p-celeste',
    name: 'Celeste',
    bio: 'Parisian Atelier',
    tonePreset: 'soft-romantic',
    personalityPrompt: 'You are Celeste.',
    memoryText: '## Fabrics & Textures That Make Me Tingle\n- Liquid silk\n',
    memoryUpdatedAt: new Date(),
    avatarEncryptedPath: null,
    avatarIv: null,
    avatarTag: null,
    avatarThumbPath: null,
    avatarThumbIv: null,
    avatarThumbTag: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('lists each Person and lets the user view and add traits to her plain-text memory', async () => {
    jest.spyOn(personService, 'listPersons').mockResolvedValue([celeste]);
    jest.spyOn(personMemoryService, 'getPersonMemory').mockResolvedValue(celeste.memoryText);
    const saveSpy = jest.spyOn(personMemoryService, 'savePersonMemory').mockResolvedValue();

    const { getByText, getByPlaceholderText } = await render(
      <ThemeProvider>
        <PersonalityMemoriesCard />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText('Celeste')).toBeTruthy());
    expect(getByText(/1 recorded preference/)).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Celeste'));
    });

    await waitFor(() => expect(getByText(/PLAIN-TEXT MEMORY LOG/i)).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText('e.g. Sheer black Chantilly lace...'),
        'French Chantilly lace',
      );
    });
    await act(async () => {
      fireEvent.press(getByText('+ Add'));
    });
    await act(async () => {
      fireEvent.press(getByText('Save Memory'));
    });

    await waitFor(() =>
      expect(saveSpy).toHaveBeenCalledWith(
        'p-celeste',
        expect.stringContaining('- French Chantilly lace'),
      ),
    );
  });
});
