import React, { useState } from 'react';
import { View, Dimensions, Alert, Text, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Buffer } from '@craftzdog/react-native-buffer';
import { PhotoKind, WardrobeCategory, WARDROBE_CATEGORIES } from '../../db/schema';
import { DecryptedPhotoRecord } from '../../services/photos/types';
import {
  ingestPhoto,
  deletePhoto,
  bulkMovePhotoKind,
  bulkUpdateCategory,
  bulkDeletePhotos,
} from '../../services/photos/photoService';
import { Button, Card, Label, Body } from '../ui';
import { PhotoTile } from './PhotoTile';
import { PhotoDetailModal } from './PhotoDetailModal';
import { useTheme } from '../../theme';

export interface PhotoGridProps {
  photoKind: PhotoKind;
  defaultCategory?: WardrobeCategory;
  records: DecryptedPhotoRecord[];
  sessionKey: Buffer | null;
  onRefresh: () => Promise<void>;
  emptyTitle?: string;
  emptyBody?: string;
}

export const PhotoGrid: React.FC<PhotoGridProps> = ({
  photoKind,
  defaultCategory = 'others',
  records,
  sessionKey,
  onRefresh,
  emptyTitle = 'No Photos Yet',
  emptyBody = 'Take photos directly inside this app (never saved to iOS Photos) or import from your library.',
}) => {
  const { theme } = useTheme();
  const [selectedRecord, setSelectedRecord] = useState<DecryptedPhotoRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(
    null,
  );

  const selectionMode = selectedIds.length > 0;
  const screenWidth = Dimensions.get('window').width;
  const numColumns = 3;
  const tileSize = Math.floor((screenWidth - 44) / numColumns);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleTakePhoto = async () => {
    if (!sessionKey) return;
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Access Required',
          'Camera permission is needed to capture app-only photos safely inside your private sandbox.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const uri = result.assets[0]?.uri;
      if (!uri) return;

      setIsCapturing(true);
      const res = await ingestPhoto(uri, sessionKey, {
        photoKind,
        category: defaultCategory,
      });
      await onRefresh();

      if (res.isDuplicate) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        Alert.alert('Duplicate Photo', 'This photo is already stored privately in the app.');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch {
      Alert.alert('Capture Failed', 'Unable to save encrypted photo.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleImport = async () => {
    if (!sessionKey) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    setIsImporting(true);
    let importedCount = 0;
    let duplicateCount = 0;
    const seen = new Set<string>();

    try {
      const total = result.assets.length;
      for (let i = 0; i < total; i++) {
        setImportProgress({ current: i + 1, total });
        const asset = result.assets[i];
        if (!asset.uri) continue;

        const key = asset.assetId || asset.uri;
        if (seen.has(key)) {
          duplicateCount += 1;
          continue;
        }
        seen.add(key);

        const res = await ingestPhoto(asset.uri, sessionKey, {
          photoKind,
          category: defaultCategory,
        });
        if (res.isDuplicate) duplicateCount += 1;
        else importedCount += 1;
      }

      await onRefresh();

      if (duplicateCount > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        Alert.alert(
          importedCount > 0 ? 'Import Completed' : 'Duplicate Photo',
          importedCount > 0
            ? `Imported ${importedCount} photo(s). ${duplicateCount} duplicate(s) skipped.`
            : 'Selected photo(s) already exist in the app.',
        );
      } else if (importedCount > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch {
      Alert.alert('Import Failed', 'Unable to import selected photos.');
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const handleBulkMove = async () => {
    const targetKind: PhotoKind = photoKind === 'wardrobe' ? 'past_ootd' : 'wardrobe';
    await bulkMovePhotoKind(selectedIds, targetKind);
    setSelectedIds([]);
    await onRefresh();
  };

  const handleBulkCategory = () => {
    Alert.alert('Set Category', `Assign ${selectedIds.length} selected photo(s) to:`, [
      ...WARDROBE_CATEGORIES.map((cat) => ({
        text: cat.toUpperCase(),
        onPress: async () => {
          await bulkUpdateCategory(selectedIds, cat);
          setSelectedIds([]);
          await onRefresh();
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleBulkDelete = () => {
    Alert.alert('Shred Selected Photos', `Permanently shred ${selectedIds.length} photo(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Shred',
        style: 'destructive',
        onPress: async () => {
          await bulkDeletePhotos(selectedIds);
          setSelectedIds([]);
          await onRefresh();
        },
      },
    ]);
  };

  return (
    <View className="flex-1">
      {/* Action Header */}
      <View className="flex-row justify-between items-center mb-3">
        <Label>{records.length} ENCRYPTED PHOTOS</Label>
        <View className="flex-row gap-2">
          <Button
            variant="secondary"
            loading={isCapturing}
            disabled={isImporting || isCapturing}
            onPress={handleTakePhoto}
            className="h-9 px-3"
          >
            {isCapturing ? 'Saving...' : 'Camera'}
          </Button>
          <Button
            variant="secondary"
            loading={isImporting}
            disabled={isImporting || isCapturing}
            onPress={handleImport}
            className="h-9 px-3"
          >
            {importProgress
              ? `${importProgress.current}/${importProgress.total}`
              : isImporting
                ? 'Importing...'
                : '+ Import'}
          </Button>
        </View>
      </View>

      {/* Multi-Select Bulk Bar */}
      {selectionMode && (
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.accent,
            borderWidth: 1,
            borderRadius: theme.borderRadius ? 10 : 0,
            padding: 10,
            marginBottom: 10,
          }}
          className="flex-row items-center justify-between gap-2"
        >
          <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 12 }}>
            {selectedIds.length} selected
          </Text>
          <View className="flex-row gap-2">
            {photoKind === 'wardrobe' && (
              <Pressable onPress={handleBulkCategory}>
                <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 11 }}>
                  Category
                </Text>
              </Pressable>
            )}
            <Pressable onPress={handleBulkMove}>
              <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 11 }}>
                {photoKind === 'wardrobe' ? 'To Past OOTD' : 'To Wardrobe'}
              </Text>
            </Pressable>
            <Pressable onPress={handleBulkDelete}>
              <Text
                style={{
                  color: theme.colors.destructiveButtonText,
                  fontWeight: '700',
                  fontSize: 11,
                }}
              >
                Shred
              </Text>
            </Pressable>
            <Pressable onPress={() => setSelectedIds([])}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}

      {records.length === 0 ? (
        <Card className="py-8 items-center justify-center">
          <Label className="mb-2">{emptyTitle}</Label>
          <Body className="text-center mb-5 px-4 text-xs">{emptyBody}</Body>
          <View className="w-full gap-3 px-4">
            <Button
              variant="primary"
              loading={isCapturing}
              disabled={isImporting || isCapturing}
              onPress={handleTakePhoto}
            >
              Take App-Only Photo
            </Button>
            <Button
              variant="secondary"
              loading={isImporting}
              disabled={isImporting || isCapturing}
              onPress={handleImport}
            >
              Import from Device
            </Button>
          </View>
        </Card>
      ) : (
        <FlashList
          data={records}
          numColumns={numColumns}
          keyExtractor={(record) => record.photo.id}
          renderItem={({ item: record }) => (
            <PhotoTile
              photo={record.photo}
              itemLabel={record.item}
              hasDescription={Boolean(record.description)}
              sessionKey={sessionKey}
              size={tileSize}
              selectionMode={selectionMode}
              selected={selectedIds.includes(record.photo.id)}
              onPress={() => {
                if (selectionMode) {
                  toggleSelect(record.photo.id);
                } else {
                  setSelectedRecord(record);
                }
              }}
              onLongPress={() => toggleSelect(record.photo.id)}
            />
          )}
        />
      )}

      <PhotoDetailModal
        visible={Boolean(selectedRecord)}
        photo={selectedRecord?.photo ?? null}
        sessionKey={sessionKey}
        onClose={() => setSelectedRecord(null)}
        onUpdated={onRefresh}
        onDelete={async (id) => {
          await deletePhoto(id);
          setSelectedRecord(null);
          await onRefresh();
        }}
      />
    </View>
  );
};
