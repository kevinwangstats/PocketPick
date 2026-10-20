import { Buffer } from '@craftzdog/react-native-buffer';
import { useState, useRef, useCallback, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { Resource } from '../db/schema';
import { decryptString, decryptBuffer } from '../crypto/cipher';
import { pickUniform, pickWeighted } from '../services/randomizer/pickerEngine';
import { DecryptedWinner, PickerState } from '../services/randomizer/types';
import { logPickTransaction } from '../services/history/historyService';
import { getCachedThumbnail, setCachedThumbnail } from '../services/media/thumbnailCache';

export interface UsePickerOptions {
  vaultId: string;
  vaultKey: Buffer | null;
  items: Resource[];
  isWeighted?: boolean;
  onPickLogged?: () => void;
}

export function usePicker({
  vaultId,
  vaultKey,
  items,
  isWeighted = false,
  onPickLogged,
}: UsePickerOptions) {
  const [state, setState] = useState<PickerState>('idle');
  const [currentDisplayItem, setCurrentDisplayItem] = useState<Resource | null>(null);
  const [winner, setWinner] = useState<DecryptedWinner | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const decryptResource = useCallback(
    async (item: Resource): Promise<DecryptedWinner> => {
      if (!vaultKey) {
        throw new Error('Vault is locked');
      }

      if (item.type === 'ticket') {
        if (!item.encryptedPayload || !item.payloadIv || !item.payloadTag) {
          throw new Error('Invalid ticket data');
        }
        const decryptedJson = decryptString(
          {
            ciphertext: item.encryptedPayload,
            iv: item.payloadIv,
            tag: item.payloadTag,
          },
          vaultKey,
          vaultId,
        );
        const parsed = JSON.parse(decryptedJson) as { title: string; content?: string };
        return {
          resource: item,
          title: parsed.title,
          content: parsed.content,
          isPhoto: false,
        };
      } else {
        // Photo resource: fetch or decrypt thumbnail
        let thumbnailBase64 = getCachedThumbnail(item.id);
        if (
          !thumbnailBase64 &&
          item.encryptedThumbnailPath &&
          item.thumbnailIv &&
          item.thumbnailTag
        ) {
          const cipherB64 = await FileSystem.readAsStringAsync(item.encryptedThumbnailPath, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const decryptedBuf = decryptBuffer(
            {
              ciphertext: cipherB64,
              iv: item.thumbnailIv,
              tag: item.thumbnailTag,
            },
            vaultKey,
            vaultId,
          );
          thumbnailBase64 = `data:image/jpeg;base64,${decryptedBuf.toString('base64')}`;
          setCachedThumbnail(item.id, thumbnailBase64);
        }

        return {
          resource: item,
          title: `Photo ${item.id.slice(0, 8)}`,
          isPhoto: true,
          thumbnailBase64,
        };
      }
    },
    [vaultKey, vaultId],
  );

  const startShuffle = useCallback(
    async (actionType: 'pick' | 're_pick' = 'pick') => {
      if (!vaultKey) {
        setError('Vault must be unlocked to pick');
        return;
      }
      if (items.length === 0) {
        setError('No items available in the pool');
        return;
      }

      setError(null);
      setWinner(null);
      setState('shuffling');

      // Select target winner upfront via CSPRNG
      const chosenTarget = isWeighted ? pickWeighted(items) : pickUniform(items);

      // Deceleration animation parameters
      let delay = 40; // initial tick delay in ms
      const maxTicks = 18;
      let tickCount = 0;

      const runTick = () => {
        if (!isMountedRef.current) return;

        tickCount++;
        // Display a random candidate during shuffle
        const randomCandidate = items[Math.floor(Math.random() * items.length)];
        setCurrentDisplayItem(randomCandidate);

        // Tactile haptic feedback on each tick
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

        if (tickCount >= maxTicks) {
          // Reached end of shuffle, reveal winner
          setState('revealed');
          setCurrentDisplayItem(chosenTarget);

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

          decryptResource(chosenTarget)
            .then((decrypted) => {
              if (isMountedRef.current) {
                setWinner(decrypted);
              }
              // Atomically log pick in database
              return logPickTransaction(vaultId, chosenTarget.id, actionType);
            })
            .then(() => {
              if (onPickLogged) {
                onPickLogged();
              }
            })
            .catch((err: unknown) => {
              if (isMountedRef.current) {
                setError(err instanceof Error ? err.message : 'Decryption error');
              }
            });
        } else {
          // Accelerate decay
          if (tickCount > 10) {
            setState('decelerating');
            delay += 35;
          } else {
            delay += 10;
          }
          timerRef.current = setTimeout(runTick, delay);
        }
      };

      runTick();
    },
    [vaultKey, items, isWeighted, decryptResource, vaultId, onPickLogged],
  );

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setState('idle');
    setWinner(null);
    setCurrentDisplayItem(null);
    setError(null);
  }, []);

  return {
    state,
    winner,
    currentDisplayItem,
    error,
    startShuffle,
    reset,
  };
}
