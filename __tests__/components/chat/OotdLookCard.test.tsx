import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import QuickCrypto from 'react-native-quick-crypto';
import { ThemeProvider } from '@/theme';
import { OotdLookCard } from '@/components/chat/OotdLookCard';
import { DecryptedOotdLook } from '@/engine/types';

describe('OotdLookCard Interactive Unveil & Keep-Swap (TDD)', () => {
  const sessionKey = QuickCrypto.randomBytes(32);

  const sampleLook: DecryptedOotdLook = {
    id: 'look-1',
    personId: 'p-1',
    triggerType: 'ootd',
    isFavorite: false,
    wornAt: null,
    fitcheckPhotoId: null,
    createdAt: new Date(),
    slots: [
      {
        slot: 'bra',
        category: 'underwear',
        photoId: 'p-bra',
        itemLabel: 'lace bra',
        description: 'Black scalloped lace',
        thumbnailPath: null,
        thumbnailIv: null,
        thumbnailTag: null,
      },
      {
        slot: 'panties',
        category: 'underwear',
        photoId: 'p-pan',
        itemLabel: 'silk panties',
        description: 'Champagne silk',
        thumbnailPath: null,
        thumbnailIv: null,
        thumbnailTag: null,
      },
    ],
  };

  it('starts veiled in Unveil Mode, reveals on tap or Reveal All, and supports Lock + Swap', async () => {
    const onSwap = jest.fn().mockResolvedValue(undefined);
    const onReroll = jest.fn().mockResolvedValue(undefined);
    const onFav = jest.fn().mockResolvedValue(undefined);
    const onWorn = jest.fn().mockResolvedValue(undefined);
    const onFit = jest.fn().mockResolvedValue(undefined);

    const { getByText, queryByText, getAllByText } = await render(
      <ThemeProvider>
        <OotdLookCard
          look={sampleLook}
          sessionKey={sessionKey}
          unveilModeDefault={true}
          onSwapSlot={onSwap}
          onRerollUnlocked={onReroll}
          onToggleFavorite={onFav}
          onMarkWorn={onWorn}
          onSendFitCheck={onFit}
        />
      </ThemeProvider>,
    );

    expect(queryByText('lace bra')).toBeNull();
    expect(getByText('Reveal All')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Reveal All'));
    });

    await waitFor(() => expect(getByText('lace bra')).toBeTruthy());
    expect(getByText('silk panties')).toBeTruthy();

    // Lock the first slot (bra) -> only 1 Swap button remains (panties)
    const lockButtons = getAllByText('Lock');
    expect(lockButtons).toHaveLength(2);

    await act(async () => {
      fireEvent.press(lockButtons[0]);
    });

    expect(getAllByText('Swap')).toHaveLength(1);
    await act(async () => {
      fireEvent.press(getAllByText('Swap')[0]);
    });
    expect(onSwap).toHaveBeenCalledWith(sampleLook, 'panties');
  });
});
