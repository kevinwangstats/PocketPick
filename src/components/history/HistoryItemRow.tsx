import { resolveResourcePath } from '../../services/media/pathResolver';
import React, { useState, useEffect } from 'react';
import { View, Image, Text } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from '@craftzdog/react-native-buffer';
import { HistoryLogWithResource } from '../../services/history/historyService';
import { decryptString, decryptBuffer } from '../../crypto/cipher';
import { getCachedThumbnail, setCachedThumbnail } from '../../services/media/thumbnailCache';
import { Card, Mono } from '../ui';
import { useTheme } from '../../theme';

export interface HistoryItemRowProps {
  item: HistoryLogWithResource;
  vaultKey: Buffer | null;
}

export function HistoryItemRow({ item, vaultKey }: HistoryItemRowProps) {
  const { theme } = useTheme();
  const [decryptedTitle, setDecryptedTitle] = useState<string>('...');
  const [photoThumbUri, setPhotoThumbUri] = useState<string | null>(null);
  const [isDecrypted, setIsDecrypted] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    if (!vaultKey || !item.resource) {
      setDecryptedTitle('[LOCKED - VAULT ENCRYPTED]');
      setPhotoThumbUri(null);
      setIsDecrypted(false);
      return;
    }

    const decryptItem = async () => {
      try {
        if (item.resource?.type === 'ticket') {
          if (
            item.resource.encryptedPayload &&
            item.resource.payloadIv &&
            item.resource.payloadTag
          ) {
            const jsonStr = decryptString(
              {
                ciphertext: item.resource.encryptedPayload,
                iv: item.resource.payloadIv,
                tag: item.resource.payloadTag,
              },
              vaultKey,
              item.vaultId,
            );
            const parsed = JSON.parse(jsonStr) as { title: string };
            if (!isCancelled) {
              setDecryptedTitle(parsed.title);
              setIsDecrypted(true);
            }
          }
        } else if (item.resource?.type === 'photo') {
          if (!isCancelled) {
            setDecryptedTitle(`Photo ${item.resource.id.slice(0, 8)}`);
            setIsDecrypted(true);
          }

          // Check or load thumbnail
          const cached = getCachedThumbnail(item.resource.id);
          if (cached) {
            if (!isCancelled) setPhotoThumbUri(cached);
          } else if (item.resource.thumbnailIv && item.resource.thumbnailTag) {
            const resolvedThumb = resolveResourcePath(item.resource.encryptedThumbnailPath);
            if (resolvedThumb) {
              const b64 = await FileSystem.readAsStringAsync(resolvedThumb, {
                encoding: FileSystem.EncodingType.Base64,
              });
              const decrypted = decryptBuffer(
                {
                  ciphertext: b64,
                  iv: item.resource.thumbnailIv,
                  tag: item.resource.thumbnailTag,
                },
                vaultKey,
                item.vaultId,
              );
              const dataUri = `data:image/jpeg;base64,${decrypted.toString('base64')}`;
              setCachedThumbnail(item.resource.id, dataUri);
              if (!isCancelled) setPhotoThumbUri(dataUri);
            }
          }
        }
      } catch {
        if (!isCancelled) {
          setDecryptedTitle('[DECRYPTION ERROR]');
        }
      }
    };

    decryptItem();

    return () => {
      isCancelled = true;
    };
  }, [item, vaultKey]);

  const formattedDate = new Date(item.selectedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card className="mb-2 p-3 flex-row items-center justify-between">
      <View className="flex-row items-center flex-1 mr-3">
        {photoThumbUri ? (
          <Image
            source={{ uri: photoThumbUri }}
            style={{
              width: 40,
              height: 40,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              borderRadius: theme.borderRadius ? 6 : 0,
              marginRight: 12,
            }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: 40,
              height: 40,
              borderColor: theme.colors.cardBorder,
              borderWidth: 1,
              backgroundColor: theme.colors.badgeBg,
              borderRadius: theme.borderRadius ? 6 : 0,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Mono style={{ color: theme.colors.badgeText }} className="text-[10px] font-bold">
              {item.resource?.type === 'photo' ? 'IMG' : 'TXT'}
            </Mono>
          </View>
        )}

        <View className="flex-1">
          <Text
            style={{
              color: isDecrypted ? theme.colors.textPrimary : theme.colors.textMuted,
              fontWeight: '600',
              fontSize: 14,
              fontFamily: theme.isMono ? 'Courier' : undefined,
            }}
            numberOfLines={1}
          >
            {decryptedTitle}
          </Text>
          <Mono style={{ color: theme.colors.textMuted }} className="text-[10px] mt-0.5">
            {item.actionType.toUpperCase()} • {formattedDate}
          </Mono>
        </View>
      </View>

      <View className="items-end">
        <View
          style={{
            backgroundColor: theme.colors.badgeBg,
            borderColor: theme.colors.cardBorder,
            borderWidth: 1,
            borderRadius: theme.borderRadius ? 4 : 0,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              color: theme.colors.badgeText,
              fontFamily: theme.isMono ? 'Courier' : undefined,
              fontSize: 10,
              fontWeight: '600',
            }}
          >
            W:{item.resource?.weight ?? 1}
          </Text>
        </View>
      </View>
    </Card>
  );
}
