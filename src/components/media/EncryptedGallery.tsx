import React, { useState } from 'react';
import { View, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as ImagePicker from 'expo-image-picker';
import { Resource } from '../../db/schema';
import { Button, Card, Label, Body } from '../ui';
import { ThumbnailTile } from './ThumbnailTile';
import { FullImageModal } from './FullImageModal';
import { ingestImage } from '../../services/media/imagePipeline';

export interface EncryptedGalleryProps {
  vaultId: string;
  vaultKey: Buffer | null;
  photos: Resource[];
  onRefresh: () => Promise<void>;
  onDeletePhoto: (resourceId: string) => Promise<void>;
}

export const EncryptedGallery: React.FC<EncryptedGalleryProps> = ({
  vaultId,
  vaultKey,
  photos,
  onRefresh,
  onDeletePhoto,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<Resource | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const numColumns = 3;
  const tileSize = Math.floor((screenWidth - 44) / numColumns);

  const handlePickAndImport = async () => {
    if (!vaultKey) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    setIsImporting(true);

    try {
      for (const asset of result.assets) {
        if (asset.uri) {
          await ingestImage(asset.uri, vaultId, vaultKey);
        }
      }
      await onRefresh();
    } catch (err) {
      console.error('Image import failed:', err);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <View className="flex-1">
      <View className="flex-row justify-between items-center mb-4">
        <Label>{photos.length} ENCRYPTED PHOTOS</Label>
        <Button
          variant="secondary"
          loading={isImporting}
          onPress={handlePickAndImport}
          className="h-9 px-3"
        >
          {isImporting ? 'IMPORTING...' : '+ IMPORT PHOTOS'}
        </Button>
      </View>

      {photos.length === 0 ? (
        <Card className="py-8 items-center justify-center">
          <Label className="mb-2">GALLERY EMPTY</Label>
          <Body className="text-zinc-500 text-center mb-4">
            Import images from your device. Select one or multiple photos to encrypt and store
            safely.
          </Body>
          <Button variant="primary" loading={isImporting} onPress={handlePickAndImport}>
            {isImporting ? 'IMPORTING...' : 'SELECT PHOTOS'}
          </Button>
        </Card>
      ) : (
        <FlashList
          data={photos}
          numColumns={numColumns}
          renderItem={({ item }) => (
            <ThumbnailTile
              resource={item}
              vaultKey={vaultKey}
              size={tileSize}
              onPress={() => setSelectedPhoto(item)}
            />
          )}
          keyExtractor={(item) => item.id}
        />
      )}

      <FullImageModal
        visible={Boolean(selectedPhoto)}
        resource={selectedPhoto}
        vaultKey={vaultKey}
        onClose={() => setSelectedPhoto(null)}
        onDelete={async (id) => {
          await onDeletePhoto(id);
          setSelectedPhoto(null);
          await onRefresh();
        }}
      />
    </View>
  );
};
