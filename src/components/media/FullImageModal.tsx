import React, { useState, useEffect } from 'react';
import { View, Modal, Image, ActivityIndicator, Pressable, Text, Dimensions } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Resource } from '../../db/schema';
import { decryptBuffer } from '../../crypto/cipher';
import { Label, ErrorText } from '../ui';

export interface FullImageModalProps {
  visible: boolean;
  resource: Resource | null;
  vaultKey: Buffer | null;
  onClose: () => void;
  onDelete?: (resourceId: string) => Promise<void>;
}

export const FullImageModal: React.FC<FullImageModalProps> = ({
  visible,
  resource,
  vaultKey,
  onClose,
  onDelete,
}) => {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadFullImage() {
      if (
        !visible ||
        !resource ||
        !vaultKey ||
        !resource.encryptedFilePath ||
        !resource.fileIv ||
        !resource.fileTag
      ) {
        setDataUri(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const ciphertextBase64 = await FileSystem.readAsStringAsync(resource.encryptedFilePath, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const decryptedBytes = decryptBuffer(
          {
            ciphertext: ciphertextBase64,
            iv: resource.fileIv,
            tag: resource.fileTag,
          },
          vaultKey,
          resource.vaultId,
        );

        const base64Image = `data:image/jpeg;base64,${decryptedBytes.toString('base64')}`;

        if (!isCancelled) {
          setDataUri(base64Image);
        }
      } catch (err) {
        if (!isCancelled) {
          setError((err as Error).message || 'Decryption failed');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadFullImage();

    return () => {
      isCancelled = true;
      setDataUri(null); // Invariant: Immediately discard decrypted full buffer on exit
    };
  }, [visible, resource, vaultKey]);

  const handleDelete = async () => {
    if (!resource || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(resource.id);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Delete error');
    } finally {
      setIsDeleting(false);
    }
  };

  const screenWidth = Dimensions.get('window').width;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black justify-between py-12 px-4">
        <View className="flex-row justify-between items-center mb-4">
          <Label className="text-zinc-400">ENCRYPTED MEDIA VIEWER</Label>
          <Pressable onPress={onClose} className="px-3 py-1 bg-zinc-900 border border-zinc-700">
            <Text className="text-white font-mono text-xs uppercase">[CLOSE]</Text>
          </Pressable>
        </View>

        <View className="flex-1 items-center justify-center">
          {isLoading ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : error ? (
            <View className="p-4 border border-red-900 bg-red-950/20">
              <ErrorText>{error}</ErrorText>
            </View>
          ) : dataUri ? (
            <Image
              source={{ uri: dataUri }}
              style={{ width: screenWidth - 32, height: '80%' }}
              resizeMode="contain"
            />
          ) : null}
        </View>

        <View className="flex-row justify-between items-center border-t border-zinc-900 pt-4">
          <Label className="text-zinc-600 font-mono text-xs">
            {resource?.id ? `ID: ${resource.id.substring(0, 8)}...` : ''}
          </Label>

          {onDelete && resource && (
            <Pressable
              onPress={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-zinc-950 border border-red-800 active:bg-red-900"
            >
              <Text className="text-xs font-mono text-red-400 uppercase tracking-wider">
                {isDeleting ? 'SHREDDING...' : 'SHRED PHOTO'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
};
