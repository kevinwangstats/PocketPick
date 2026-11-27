import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import QuickCrypto from 'react-native-quick-crypto';
import { ThemeProvider } from '@/theme';
import { useSessionStore } from '@/stores/useSessionStore';
import ChatDetailScreen from '@/app/chat/[id]';
import * as personService from '@/services/persons/personService';
import * as chatService from '@/services/chat/chatService';
import * as ootdPreferences from '@/services/settings/ootdPreferences';
import { Person } from '@/db/schema';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'p-celeste' }),
  useRouter: () => ({ push: jest.fn() }),
  Stack: { Screen: () => null },
}));

describe('Messenger ChatScreen & OOTD Quick-Builder (TDD)', () => {
  const sessionKey = QuickCrypto.randomBytes(32);
  const celeste: Person = {
    id: 'p-celeste',
    name: 'Celeste',
    bio: 'Parisian Atelier',
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

  beforeEach(() => {
    jest.restoreAllMocks();
    useSessionStore.getState().setAppSessionKey(sessionKey);
    jest.spyOn(personService, 'getPersonById').mockResolvedValue(celeste);
    jest.spyOn(chatService, 'getChatMessages').mockResolvedValue([]);
    jest.spyOn(ootdPreferences, 'getOotdPreferences').mockResolvedValue({
      unveilModeDefault: true,
      cooldownDays: 3,
      autoLearnMemory: true,
      autoClassifyPhotos: true,
    });
  });

  it('sends chat text and supports launching OOTD Quick Builder sheet', async () => {
    const sendSpy = jest.spyOn(chatService, 'sendChatMessage').mockResolvedValue({
      userMessage: {
        id: 'u1',
        personId: celeste.id,
        role: 'user',
        text: 'Hello Celeste',
        photo: null,
        ootdLook: null,
        createdAt: new Date(),
      },
      assistantMessage: {
        id: 'a1',
        personId: celeste.id,
        role: 'assistant',
        text: 'Bonsoir!',
        photo: null,
        ootdLook: null,
        createdAt: new Date(),
      },
      autoMovedToPastOotdPhotoId: null,
    });

    const { getByPlaceholderText, getByLabelText, getByText } = await render(
      <ThemeProvider>
        <ChatDetailScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByPlaceholderText('Message or type /ootd...')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Message or type /ootd...'), 'Hello Celeste');
    });
    await act(async () => {
      fireEvent.press(getByLabelText('Send message'));
    });

    await waitFor(() =>
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({ personId: 'p-celeste', text: 'Hello Celeste' }),
      ),
    );

    // Open Quick-Builder Sheet and pick Bra & Panties Only
    await act(async () => {
      fireEvent.press(getByText('✨ OOTD'));
    });

    await waitFor(() => expect(getByText('Bra & Panties Only')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Bra & Panties Only'));
    });
    await act(async () => {
      fireEvent.press(getByText('Generate Outfit'));
    });

    await waitFor(() =>
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          overrideSlots: ['bra', 'panties'],
        }),
      ),
    );
  });
});
