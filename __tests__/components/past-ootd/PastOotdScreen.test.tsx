import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import QuickCrypto from 'react-native-quick-crypto';
import { ThemeProvider } from '@/theme';
import { useSessionStore } from '@/stores/useSessionStore';
import PastOotdScreen from '@/app/(tabs)/past-ootd';
import * as photoService from '@/services/photos/photoService';
import * as personService from '@/services/persons/personService';
import * as lookbookStore from '@/engine/lookbookStore';
import { DecryptedOotdLook } from '@/engine/types';

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

describe('PastOotdScreen & Lookbook (TDD)', () => {
  const sessionKey = QuickCrypto.randomBytes(32);

  const favLook: DecryptedOotdLook = {
    id: 'look-fav',
    personId: 'p-1',
    triggerType: 'style',
    isFavorite: true,
    wornAt: new Date(),
    fitcheckPhotoId: null,
    createdAt: new Date(),
    slots: [
      {
        slot: 'top',
        category: 'top',
        photoId: null,
        itemLabel: 'silk camisole',
        description: 'Ivory silk',
        thumbnailPath: null,
        thumbnailIv: null,
        thumbnailTag: null,
        isMissing: true,
      },
    ],
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    mockPush.mockClear();
    useSessionStore.getState().setAppSessionKey(sessionKey);
  });

  it('switches to Saved Looks, filters Favorites, and jumps to stylist chat', async () => {
    jest.spyOn(photoService, 'listPhotosWithMetadata').mockResolvedValue([]);
    jest.spyOn(lookbookStore, 'listOotdLooks').mockResolvedValue([favLook]);
    jest.spyOn(personService, 'listPersons').mockResolvedValue([
      {
        id: 'p-1',
        name: 'Celeste',
        bio: null,
        tonePreset: null,
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
      },
    ]);

    const { getByText } = await render(
      <ThemeProvider>
        <PastOotdScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText('Saved Looks (1)')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Saved Looks (1)'));
    });

    await waitFor(() => expect(getByText('Styled by Celeste')).toBeTruthy());
    expect(getByText('silk camisole')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Favorites ♡'));
    });
    expect(getByText('Styled by Celeste')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Open Chat →'));
    });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/chat/[id]',
      params: { id: 'p-1' },
    });
  });
});
