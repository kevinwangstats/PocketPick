import React, { useEffect, useState } from 'react';
import { View, Image, Pressable, ActivityIndicator, Text } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from '@craftzdog/react-native-buffer';
import { Resource } from '../../db/schema';
import { decryptBuffer } from '../../crypto/cipher';
import { getCachedThumbnail, setCachedThumbnail } from '../../services/media/thumbnailCache';

export interface ThumbnailTileProps {
  resource: Resource;
  vaultKey: Buffer | null;
  size: number;
  onPress?: () => void;
  onLongPress?: () => void;
}

export const ThumbnailTile: React.FC<ThumbnailTileProps> = ({
  resource,
  vaultKey,
  size,
  onPress,
  onLongPress,
}) => {
  const [dataUri, setDataUri] = useState<string | null>(
    () => getCachedThumbnail(resource.id) ?? null,
  );
  const [isLoading, setIsLoading] = useState(!dataUri);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadThumbnail() {
      if (
        dataUri ||
        !vaultKey ||
        !resource.encryptedThumbnailPath ||
        !resource.thumbnailIv ||
        !resource.thumbnailTag
      ) {
        setIsLoading(false);
        return;
      }

      const cached = getCachedThumbnail(resource.id);
      if (cached) {
        setDataUri(cached);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      try {
        const ciphertextBase64 = await FileSystem.readAsStringAsync(
          resource.encryptedThumbnailPath,
          { encoding: FileSystem.EncodingType.Base64 },
        );

        const decryptedBytes = decryptBuffer(
          {
            ciphertext: ciphertextBase64,
            iv: resource.thumbnailIv,
            tag: resource.thumbnailTag,
          },
          vaultKey,
          resource.vaultId,
        );

        const base64Image = `data:image/jpeg;base64,${decryptedBytes.toString('base64')}`;

        if (!isCancelled) {
          setCachedThumbnail(resource.id, base64Image);
          setDataUri(base64Image);
        }
      } catch (err) {
        if (!isCancelled) {
          setHasError(true);
          console.error(`Failed to decrypt thumbnail for ${resource.id}:`, err);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadThumbnail();

    return () => {
      isCancelled = true;
    };
  }, [resource, vaultKey, dataUri]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width: size, height: size }}
      className="bg-zinc-950 border border-zinc-800 items-center justify-center m-0.5 active:opacity-75"
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : hasError ? (
        <View className="items-center px-1">
          <Text className="text-[10px] font-mono text-red-400 text-center">[ERR]</Text>
        </View>
      ) : dataUri ? (
        <Image source={{ uri: dataUri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <View className="items-center">
          <Text className="text-[10px] font-mono text-zinc-600">[LOCKED]</Text>
        </View>
      )}
    </Pressable>
  );
};
