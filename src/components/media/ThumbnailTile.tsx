import React, { useEffect, useState } from 'react';
import { View, Image, Pressable, ActivityIndicator, Text } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from '@craftzdog/react-native-buffer';
import { Resource } from '../../db/schema';
import { decryptBuffer } from '../../crypto/cipher';
import { getCachedThumbnail, setCachedThumbnail } from '../../services/media/thumbnailCache';
import { useTheme } from '../../theme';

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
  const { theme } = useTheme();
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
      style={{
        width: size,
        height: size,
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.cardBorder,
        borderWidth: 1,
        borderRadius: theme.borderRadius ? 8 : 0,
        alignItems: 'center',
        justifyContent: 'center',
        margin: 2,
        overflow: 'hidden',
      }}
      className="active:opacity-75"
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={theme.colors.accent} />
      ) : hasError ? (
        <View className="items-center px-1">
          <Text
            style={{
              color: theme.colors.destructiveButtonText,
              fontFamily: theme.isMono ? 'Courier' : undefined,
            }}
            className="text-[10px] text-center"
          >
            [ERR]
          </Text>
        </View>
      ) : dataUri ? (
        <Image source={{ uri: dataUri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <View className="items-center">
          <Text
            style={{
              color: theme.colors.textMuted,
              fontFamily: theme.isMono ? 'Courier' : undefined,
            }}
            className="text-[10px]"
          >
            [LOCKED]
          </Text>
        </View>
      )}
      {Boolean(resource.encryptedPayload) && (
        <View
          style={{
            position: 'absolute',
            bottom: 3,
            right: 3,
            backgroundColor: theme.colors.badgeBg,
            borderColor: theme.colors.cardBorder,
            borderWidth: 1,
            borderRadius: theme.borderRadius ? 4 : 0,
            paddingHorizontal: 4,
            paddingVertical: 1,
          }}
        >
          <Text
            style={{
              color: theme.colors.badgeText,
              fontFamily: theme.isMono ? 'Courier' : undefined,
              fontSize: 8,
              fontWeight: '700',
            }}
          >
            NOTE
          </Text>
        </View>
      )}
    </Pressable>
  );
};
