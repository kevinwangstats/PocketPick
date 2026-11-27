import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import QuickCrypto from 'react-native-quick-crypto';
import { ThemeProvider } from '@/theme';
import { useSessionStore } from '@/stores/useSessionStore';
import WardrobeScreen from '@/app/(tabs)/wardrobe';
import * as photoService from '@/services/photos/photoService';
import * as llmKeyStore from '@/services/llm/llmKeyStore';
import * as photoBatchAnalyzer from '@/services/photos/photoBatchAnalyzer';
import { Photo } from '@/db/schema';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    const reactModule = jest.requireActual<typeof import('react')>('react');
    reactModule.useEffect(() => {
      cb();
    }, [cb]);
  },
}));

describe('WardrobeScreen & PhotoDetailModal (TDD)', () => {
  const sessionKey = QuickCrypto.randomBytes(32);

  function makePhoto(
    id: string,
    category: Photo['category'],
    item: string,
  ): {
    photo: Photo;
    item: string;
    description: string;
  } {
    return {
      photo: {
        id,
        photoKind: 'wardrobe',
        aiHasHumanBody: null,
        category,
        encryptedItem: 'enc',
        itemIv: 'iv',
        itemTag: 'tag',
        encryptedDescription: null,
        descriptionIv: null,
        descriptionTag: null,
        encryptedFilePath: `photos/${id}.enc`,
        fileIv: 'fiv',
        fileTag: 'ftag',
        fileHash: `hash-${id}`,
        encryptedThumbnailPath: `photos/${id}_thumb.enc`,
        thumbnailIv: 'tiv',
        thumbnailTag: 'ttag',
        lastWornAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      item,
      description: 'Soft fabric',
    };
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    useSessionStore.getState().setAppSessionKey(sessionKey);
  });

  it('displays category counts, filters items, and supports Undo toast after AI auto-sort', async () => {
    const listSpy = jest
      .spyOn(photoService, 'listPhotosWithMetadata')
      .mockResolvedValue([
        makePhoto('p1', 'top', 'white tshirt'),
        makePhoto('p2', 'underwear', 'lace bra'),
      ]);
    jest.spyOn(llmKeyStore, 'isOpenRouterKeyConfigured').mockResolvedValue(true);
    jest.spyOn(photoBatchAnalyzer, 'runBatchPhotoAnalysis').mockResolvedValue({
      completed: 2,
      total: 2,
      movedToPastOotdIds: ['p1'],
      failedCount: 0,
    });
    const undoSpy = jest.spyOn(photoService, 'bulkMovePhotoKind').mockResolvedValue();

    const { getByText } = await render(
      <ThemeProvider>
        <WardrobeScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(listSpy).toHaveBeenCalled());
    await waitFor(() => expect(getByText('all (2)')).toBeTruthy());
    expect(getByText('top (1)')).toBeTruthy();
    expect(getByText('underwear (1)')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Auto-Sort'));
    });

    await waitFor(() => expect(getByText(/Moved 1 photo\(s\) to Past OOTD/i)).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Undo'));
    });
    expect(undoSpy).toHaveBeenCalledWith(['p1'], 'wardrobe');
  });
});
