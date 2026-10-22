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

  it('renders empty state with both camera and import buttons', async () => {
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
    expect(getByText('📷 TAKE SECURE PHOTO')).toBeTruthy();
    expect(getByText('+ IMPORT FROM DEVICE')).toBeTruthy();
  });

  it('renders header with camera and import buttons when photos exist', async () => {
    const mockPhotos = [
      {
        id: 'photo-1',
        vaultId: 'test-vault',
        type: 'photo' as const,
        weight: 1,
        encryptedFilePath: '/mock/1.enc',
        fileIv: 'iv1',
        fileTag: 'tag1',
        fileHash: 'hash1',
        encryptedThumbnailPath: '/mock/1_thumb.enc',
        thumbnailIv: 'tiv1',
        thumbnailTag: 'ttag1',
        createdAt: new Date(),
        updatedAt: new Date(),
        encryptedPayload: null,
        payloadIv: null,
        payloadTag: null,
      },
    ];

    const { getByText } = await render(
      <EncryptedGallery
        vaultId="test-vault"
        vaultKey={mockVaultKey}
        photos={mockPhotos}
        onRefresh={onRefreshMock}
        onDeletePhoto={onDeletePhotoMock}
      />,
    );

    expect(getByText('1 ENCRYPTED PHOTOS')).toBeTruthy();
    expect(getByText('📷 CAMERA')).toBeTruthy();
    expect(getByText('+ IMPORT')).toBeTruthy();
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

    const importButton = getByText('+ IMPORT FROM DEVICE');
    fireEvent.press(importButton);

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          allowsMultipleSelection: true,
          mediaTypes: ['images'],
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

  it('requests camera permissions, captures photo, and ingests directly into vault', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: true,
    });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///captured_secure_photo.jpg' }],
    });

    const { getByText } = await render(
      <EncryptedGallery
        vaultId="vault-secure"
        vaultKey={mockVaultKey}
        photos={[]}
        onRefresh={onRefreshMock}
        onDeletePhoto={onDeletePhotoMock}
      />,
    );

    const takePhotoButton = getByText('📷 TAKE SECURE PHOTO');
    fireEvent.press(takePhotoButton);

    await waitFor(() => {
      expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaTypes: ['images'],
          quality: 1,
          allowsEditing: false,
        }),
      );
      expect(imagePipeline.ingestImage).toHaveBeenCalledWith(
        'file:///captured_secure_photo.jpg',
        'vault-secure',
        mockVaultKey,
      );
      expect(onRefreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it('does not launch camera if permission is denied', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
    });

    const { getByText } = await render(
      <EncryptedGallery
        vaultId="vault-secure"
        vaultKey={mockVaultKey}
        photos={[]}
        onRefresh={onRefreshMock}
        onDeletePhoto={onDeletePhotoMock}
      />,
    );

    const takePhotoButton = getByText('📷 TAKE SECURE PHOTO');
    fireEvent.press(takePhotoButton);

    await waitFor(() => {
      expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
      expect(imagePipeline.ingestImage).not.toHaveBeenCalled();
    });
  });

  it('handles camera cancellation gracefully', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: true,
    });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
      canceled: true,
      assets: [],
    });

    const { getByText } = await render(
      <EncryptedGallery
        vaultId="vault-secure"
        vaultKey={mockVaultKey}
        photos={[]}
        onRefresh={onRefreshMock}
        onDeletePhoto={onDeletePhotoMock}
      />,
    );

    const takePhotoButton = getByText('📷 TAKE SECURE PHOTO');
    fireEvent.press(takePhotoButton);

    await waitFor(() => {
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalledTimes(1);
      expect(imagePipeline.ingestImage).not.toHaveBeenCalled();
      expect(onRefreshMock).not.toHaveBeenCalled();
    });
  });
});
