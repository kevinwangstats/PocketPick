import React, { useState, useEffect } from 'react';
import { View, Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from '@craftzdog/react-native-buffer';
import { HistoryLogWithResource } from '../../services/history/historyService';
import { decryptString, decryptBuffer } from '../../crypto/cipher';
import { getCachedThumbnail, setCachedThumbnail } from '../../services/media/thumbnailCache';
import { Card, Body, Label, Mono } from '../ui';

export interface HistoryItemRowProps {
  item: HistoryLogWithResource;
  vaultKey: Buffer | null;
}

export function HistoryItemRow({ item, vaultKey }: HistoryItemRowProps) {
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
          } else if (
            item.resource.encryptedThumbnailPath &&
            item.resource.thumbnailIv &&
            item.resource.thumbnailTag
          ) {
            const b64 = await FileSystem.readAsStringAsync(item.resource.encryptedThumbnailPath, {
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
    <Card className="mb-2 p-3 border border-zinc-800 bg-zinc-950 flex-row items-center justify-between">
      <View className="flex-row items-center flex-1 mr-3">
        {photoThumbUri ? (
          <Image
            source={{ uri: photoThumbUri }}
            className="w-10 h-10 border border-zinc-700 bg-zinc-900 mr-3"
            resizeMode="cover"
          />
        ) : (
          <View className="w-10 h-10 border border-zinc-800 bg-black items-center justify-center mr-3">
            <Mono className="text-[10px] text-zinc-500 font-bold">
              {item.resource?.type === 'photo' ? 'IMG' : 'TXT'}
            </Mono>
          </View>
        )}

        <View className="flex-1">
          <Body
            className={`font-medium ${
              isDecrypted ? 'text-white' : 'text-zinc-600 font-mono text-xs'
            }`}
            numberOfLines={1}
          >
            {decryptedTitle}
          </Body>
          <Mono className="text-[10px] text-zinc-500 font-mono mt-0.5">
            {item.actionType.toUpperCase()} • {formattedDate}
          </Mono>
        </View>
      </View>

      <View className="items-end">
        <View className="bg-zinc-900 border border-zinc-700 px-1.5 py-0.5">
          <Label className="text-[10px] text-zinc-300">W:{item.resource?.weight ?? 1}</Label>
        </View>
      </View>
    </Card>
  );
}
