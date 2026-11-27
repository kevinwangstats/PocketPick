import React, { useEffect, useState } from 'react';
import { View, Image, Pressable, ActivityIndicator, Text } from 'react-native';
import { Buffer } from '@craftzdog/react-native-buffer';
import { Photo } from '../../db/schema';
import { decryptImageBuffer } from '../../services/media/imagePipeline';
import { getCachedThumbnail, setCachedThumbnail } from '../../services/media/thumbnailCache';
import { useTheme } from '../../theme';

export interface PhotoTileProps {
  photo: Photo;
  itemLabel?: string;
  hasDescription?: boolean;
  sessionKey: Buffer | null;
  size: number;
  selected?: boolean;
  selectionMode?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export const PhotoTile: React.FC<PhotoTileProps> = ({
  photo,
  itemLabel,
  hasDescription,
  sessionKey,
  size,
  selected = false,
  selectionMode = false,
  onPress,
  onLongPress,
}) => {
  const { theme } = useTheme();
  const [dataUri, setDataUri] = useState<string | null>(() => getCachedThumbnail(photo.id) ?? null);
  const [isLoading, setIsLoading] = useState(!dataUri);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadThumbnail() {
      if (dataUri || !sessionKey || !photo.encryptedThumbnailPath) {
        setIsLoading(false);
        return;
      }

      const cached = getCachedThumbnail(photo.id);
      if (cached) {
        setDataUri(cached);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      try {
        const decryptedBytes = await decryptImageBuffer({
          encryptedPath: photo.encryptedThumbnailPath,
          iv: photo.thumbnailIv,
          tag: photo.thumbnailTag,
          sessionKey,
          aad: photo.id,
        });
        const base64Image = `data:image/jpeg;base64,${decryptedBytes.toString('base64')}`;

        if (!isCancelled) {
          setCachedThumbnail(photo.id, base64Image);
          setDataUri(base64Image);
        }
      } catch {
        if (!isCancelled) {
          setHasError(true);
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
  }, [photo, sessionKey, dataUri]);

  const badgeText =
    photo.photoKind === 'past_ootd' ? 'OOTD' : photo.category.toUpperCase().slice(0, 5);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        width: size,
        height: size,
        backgroundColor: theme.colors.card,
        borderColor: selected ? theme.colors.accent : theme.colors.cardBorder,
        borderWidth: selected ? 2 : 1,
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
        <Text
          style={{
            color: theme.colors.destructiveButtonText,
            fontFamily: theme.isMono ? 'Courier' : undefined,
            fontSize: 10,
          }}
        >
          [ERR]
        </Text>
      ) : dataUri ? (
        <Image source={{ uri: dataUri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontFamily: theme.isMono ? 'Courier' : undefined,
            fontSize: 10,
          }}
        >
          [LOCKED]
        </Text>
      )}

      {/* Category / Kind Pill */}
      <View
        style={{
          position: 'absolute',
          top: 4,
          left: 4,
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
          {badgeText}
        </Text>
      </View>

      {/* Selection Indicator */}
      {selectionMode && (
        <View
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: selected ? theme.colors.accent : 'rgba(0,0,0,0.45)',
            borderColor: '#FFFFFF',
            borderWidth: 1.5,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && (
            <Text style={{ color: theme.colors.accentText, fontSize: 10, fontWeight: '700' }}>
              ✓
            </Text>
          )}
        </View>
      )}

      {/* Item Label & Description Badge */}
      {(Boolean(itemLabel) || hasDescription) && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.62)',
            paddingHorizontal: 5,
            paddingVertical: 2,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: '#FFFFFF',
              fontSize: 9,
              fontWeight: '600',
              flex: 1,
              fontFamily: theme.isMono ? 'Courier' : undefined,
            }}
          >
            {itemLabel || ''}
          </Text>
          {hasDescription && (
            <Text
              style={{
                color: '#E2B778',
                fontSize: 8,
                fontWeight: '700',
                marginLeft: 4,
              }}
            >
              DESC
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
};
