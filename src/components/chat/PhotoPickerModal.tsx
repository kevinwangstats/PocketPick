import React, { useState, useEffect } from 'react';
import { View, Modal, Pressable, Text, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Buffer } from '@craftzdog/react-native-buffer';
import { Photo } from '../../db/schema';
import { DecryptedPhotoRecord } from '../../services/photos/types';
import { listPhotosWithMetadata } from '../../services/photos/photoService';
import { PhotoTile } from '../photos/PhotoTile';
import { H2, Label } from '../ui';
import { useTheme } from '../../theme';

export interface PhotoPickerModalProps {
  visible: boolean;
  sessionKey: Buffer | null;
  onClose: () => void;
  onSelectPhoto: (photo: Photo) => void;
}

export const PhotoPickerModal: React.FC<PhotoPickerModalProps> = ({
  visible,
  sessionKey,
  onClose,
  onSelectPhoto,
}) => {
  const { theme } = useTheme();
  const [records, setRecords] = useState<DecryptedPhotoRecord[]>([]);

  useEffect(() => {
    if (!visible || !sessionKey) return;
    listPhotosWithMetadata(sessionKey)
      .then((items) => setRecords(items))
      .catch(() => setRecords([]));
  }, [visible, sessionKey]);

  const tileSize = Math.floor((Dimensions.get('window').width - 48) / 3);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          paddingTop: 52,
          paddingHorizontal: 16,
        }}
      >
        <View className="flex-row justify-between items-center mb-3">
          <View>
            <Label>APP-ONLY LIBRARY</Label>
            <H2>Pick Photo to Send</H2>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ color: theme.colors.accent, fontWeight: '600' }}>Close</Text>
          </Pressable>
        </View>

        <FlashList
          data={records}
          numColumns={3}
          keyExtractor={(r) => r.photo.id}
          renderItem={({ item: record }) => (
            <PhotoTile
              photo={record.photo}
              itemLabel={record.item}
              hasDescription={Boolean(record.description)}
              sessionKey={sessionKey}
              size={tileSize}
              onPress={() => {
                onSelectPhoto(record.photo);
                onClose();
              }}
            />
          )}
        />
      </View>
    </Modal>
  );
};
