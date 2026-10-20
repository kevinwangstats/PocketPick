import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { EncryptedGallery } from '@/components/media/EncryptedGallery';
import * as imagePipeline from '@/services/media/imagePipeline';

jest.mock('@/services/media/imagePipeline', () => ({
  ingestImage: jest.fn(async () => ({
    resourceId: 'mock-res-id',
    encryptedFilePath: '/mock/file.enc',
    encryptedThumbnailPath: '/mock/thumb.enc',
  })),
}));

describe('EncryptedGallery Component', () => {
  const mockVaultKey = Buffer.alloc(32, 0xaa);
  const onRefreshMock = jest.fn(async () => {});
  const onDeletePhotoMock = jest.fn(async () => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state when there are no photos', async () => {
    const { getByText } = await render(
      <EncryptedGallery
        vaultId="test-vault"
        vaultKey={mockVaultKey}
        photos={[]}
        onRefresh={onRefreshMock}
        onDeletePhoto={onDeletePhotoMock}
      />,
    );

    expect(getByText('GALLERY EMPTY')).toBeTruthy();
    expect(getByText('SELECT PHOTOS')).toBeTruthy();
  });

  it('launches picker with allowsMultipleSelection: true and ingests all selected photos', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        { uri: 'file:///photo1.jpg' },
        { uri: 'file:///photo2.jpg' },
        { uri: 'file:///photo3.jpg' },
      ],
    });

    const { getByText } = await render(
      <EncryptedGallery
        vaultId="vault-abc"
        vaultKey={mockVaultKey}
        photos={[]}
        onRefresh={onRefreshMock}
        onDeletePhoto={onDeletePhotoMock}
      />,
    );

    const importButton = getByText('SELECT PHOTOS');
    fireEvent.press(importButton);

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          allowsMultipleSelection: true,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        }),
      );
      expect(imagePipeline.ingestImage).toHaveBeenCalledTimes(3);
      expect(imagePipeline.ingestImage).toHaveBeenCalledWith(
        'file:///photo1.jpg',
        'vault-abc',
        mockVaultKey,
      );
      expect(imagePipeline.ingestImage).toHaveBeenCalledWith(
        'file:///photo2.jpg',
        'vault-abc',
        mockVaultKey,
      );
      expect(imagePipeline.ingestImage).toHaveBeenCalledWith(
        'file:///photo3.jpg',
        'vault-abc',
        mockVaultKey,
      );
      expect(onRefreshMock).toHaveBeenCalledTimes(1);
    });
  });
});
