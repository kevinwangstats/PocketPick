import React, { useState } from 'react';
import { View, Dimensions, Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
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
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(
    null,
  );

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

    let importedCount = 0;
    let duplicateCount = 0;
    const batchSeenKeys = new Set<string>();

    try {
      const totalAssets = result.assets.length;
      for (let i = 0; i < totalAssets; i++) {
        const asset = result.assets[i];
        setImportProgress({ current: i + 1, total: totalAssets });
        if (!asset.uri) continue;

        // In-batch deduplication: avoid processing the exact same picker item twice
        const assetKey = asset.assetId || asset.uri;
        if (batchSeenKeys.has(assetKey)) {
          duplicateCount++;
          continue;
        }
        batchSeenKeys.add(assetKey);

        const res = await ingestImage(asset.uri, vaultId, vaultKey);
        if (res.isDuplicate) {
          duplicateCount++;
        } else {
          importedCount++;
        }
      }

      await onRefresh();

      if (duplicateCount > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        if (importedCount === 0) {
          Alert.alert(
            'Photo Already Exists',
            duplicateCount === 1
              ? 'This photo is already stored in your vault.'
              : 'All selected photos are already stored in your vault.',
          );
        } else {
          Alert.alert(
            'Import Completed',
            `Imported ${importedCount} photo${importedCount > 1 ? 's' : ''}.\n${duplicateCount} duplicate photo${duplicateCount > 1 ? 's were' : ' was'} skipped.`,
          );
        }
      } else if (importedCount > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (err) {
      console.error('Image import failed:', err);
      Alert.alert('Import Failed', 'An error occurred while importing photos.');
    } finally {
      setIsImporting(false);
      setImportProgress(null);
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
          {importProgress
            ? `IMPORTING (${importProgress.current}/${importProgress.total})...`
            : isImporting
              ? 'IMPORTING...'
              : '+ IMPORT PHOTOS'}
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
        onPhotoUpdated={onRefresh}
        onDelete={async (id) => {
          await onDeletePhoto(id);
          setSelectedPhoto(null);
          await onRefresh();
        }}
      />
    </View>
  );
};
