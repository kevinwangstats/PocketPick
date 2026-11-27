import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import QuickCrypto from 'react-native-quick-crypto';
import { ThemeProvider } from '@/theme';
import { useSessionStore } from '@/stores/useSessionStore';
import ChatsScreen from '@/app/(tabs)/index';
import * as personService from '@/services/persons/personService';
import * as llmKeyStore from '@/services/llm/llmKeyStore';
import { getDatabase } from '@/db/client';
import { Person } from '@/db/schema';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => void) => {
    const reactModule = jest.requireActual<typeof import('react')>('react');
    reactModule.useEffect(() => {
      cb();
    }, [cb]);
  },
}));

describe('ChatsDirectory & PersonFormModal (TDD)', () => {
  const sessionKey = QuickCrypto.randomBytes(32);
  const celeste: Person = {
    id: 'p-celeste',
    name: 'Celeste',
    bio: 'Parisian Atelier & Silk Muse',
    tonePreset: 'soft-romantic',
    personalityPrompt: 'You are Celeste.',
    memoryText: '',
    memoryUpdatedAt: null,
    avatarEncryptedPath: null,
    avatarIv: null,
    avatarTag: null,
    avatarThumbPath: null,
    avatarThumbIv: null,
    avatarThumbTag: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.restoreAllMocks();
    mockPush.mockClear();
    useSessionStore.getState().setAppSessionKey(sessionKey);

    const db = await getDatabase();
    jest.spyOn(db, 'select').mockImplementation(() => {
      return {
        from: () => ({
          where: () => {
            const emptyRes = Promise.resolve([]) as unknown as Promise<unknown[]> & {
              limit: () => Promise<unknown[]>;
              orderBy: () => { limit: () => Promise<unknown[]> };
            };
            emptyRes.limit = () => Promise.resolve([]);
            emptyRes.orderBy = () => ({ limit: () => Promise.resolve([]) });
            return emptyRes;
          },
        }),
      } as unknown as ReturnType<typeof db.select>;
    });
  });

  it('shows Day-1 Quick Start checklist when empty and creates a starter Person in 1 tap', async () => {
    jest.spyOn(personService, 'listPersons').mockResolvedValue([]);
    jest.spyOn(llmKeyStore, 'isOpenRouterKeyConfigured').mockResolvedValue(false);
    const createSpy = jest.spyOn(personService, 'createPerson').mockResolvedValue(celeste);

    const { getByText } = await render(
      <ThemeProvider>
        <ChatsScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText('DAY-1 QUICK START')).toBeTruthy());
    expect(getByText('Start with Celeste (Parisian Atelier)')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Start with Celeste (Parisian Atelier)'));
    });

    await waitFor(() => expect(createSpy).toHaveBeenCalled());
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/chat/[id]',
      params: { id: 'p-celeste' },
    });
  });

  it('renders PersonCard list and navigates to chat on press', async () => {
    jest.spyOn(personService, 'listPersons').mockResolvedValue([celeste]);
    jest.spyOn(llmKeyStore, 'isOpenRouterKeyConfigured').mockResolvedValue(true);

    const { getByText } = await render(
      <ThemeProvider>
        <ChatsScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText('Celeste')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Celeste'));
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/chat/[id]',
      params: { id: 'p-celeste' },
    });
  });
});
