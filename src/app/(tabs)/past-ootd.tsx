import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSessionStore } from '@/stores/useSessionStore';
import { listPhotosWithMetadata } from '@/services/photos/photoService';
import { DecryptedPhotoRecord } from '@/services/photos/types';
import { listPersons } from '@/services/persons/personService';
import { listOotdLooks, toggleLookFavorite } from '@/engine/lookbookStore';
import { DecryptedOotdLook } from '@/engine/types';
import { Person } from '@/db/schema';
import { PhotoGrid } from '@/components/photos';
import { LookbookCard } from '@/components/past-ootd';
import { Card, Label, Body } from '@/components/ui';
import { useTheme } from '@/theme';

type PastOotdSubTab = 'photos' | 'looks';

export default function PastOotdScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const appSessionKey = useSessionStore((state) => state.appSessionKey);

  const [subTab, setSubTab] = useState<PastOotdSubTab>('photos');
  const [bodyPhotos, setBodyPhotos] = useState<DecryptedPhotoRecord[]>([]);
  const [looks, setLooks] = useState<DecryptedOotdLook[]>([]);
  const [personMap, setPersonMap] = useState<Record<string, Person>>({});
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const loadData = useCallback(async () => {
    if (!appSessionKey) return;
    try {
      const [photoRows, lookRows, personRows] = await Promise.all([
        listPhotosWithMetadata(appSessionKey, 'past_ootd'),
        listOotdLooks(appSessionKey),
        listPersons(),
      ]);

      setBodyPhotos(photoRows);
      setLooks(lookRows);

      const map: Record<string, Person> = {};
      for (const p of personRows) {
        map[p.id] = p;
      }
      setPersonMap(map);
    } catch (err) {
      console.error('Failed to load Past OOTD:', err);
    }
  }, [appSessionKey]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const visibleLooks = useMemo(
    () => (favoritesOnly ? looks.filter((l) => l.isFavorite) : looks),
    [looks, favoritesOnly],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 16 }}>
      {/* Segmented Toggle: My OOTD Photos vs Saved Looks */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: theme.colors.badgeBg,
          borderRadius: theme.borderRadius ? 10 : 0,
          padding: 3,
          marginBottom: 14,
          borderWidth: theme.isDark ? 1 : 0,
          borderColor: theme.colors.cardBorder,
        }}
      >
        {(
          [
            { id: 'photos', label: `My OOTD Photos (${bodyPhotos.length})` },
            { id: 'looks', label: `Saved Looks (${looks.length})` },
          ] as const
        ).map((tab) => {
          const isSelected = subTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setSubTab(tab.id)}
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: 'center',
                borderRadius: theme.borderRadius ? 8 : 0,
                backgroundColor: isSelected ? theme.colors.card : 'transparent',
              }}
            >
              <Text
                style={{
                  color: isSelected ? theme.colors.accent : theme.colors.textMuted,
                  fontWeight: isSelected ? '700' : '500',
                  fontSize: 12,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {subTab === 'photos' ? (
        <PhotoGrid
          photoKind="past_ootd"
          records={bodyPhotos}
          sessionKey={appSessionKey}
          onRefresh={loadData}
          emptyTitle="NO PAST OOTD PHOTOS"
          emptyBody="Mirror try-ons, Fit Checks, and any photos where AI detects a human body as the main subject are organized here."
        />
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 30 }}>
          <View className="flex-row gap-2 mb-3">
            {[
              { id: false, label: 'All Looks' },
              { id: true, label: 'Favorites ♡' },
            ].map((pill) => {
              const isSelected = favoritesOnly === pill.id;
              return (
                <Pressable
                  key={pill.label}
                  onPress={() => setFavoritesOnly(pill.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: theme.borderRadius ? 14 : 0,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                    backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.card,
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? theme.colors.accent : theme.colors.textPrimary,
                      fontSize: 12,
                      fontWeight: isSelected ? '700' : '500',
                    }}
                  >
                    {pill.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {visibleLooks.length === 0 ? (
            <Card className="p-6 items-center">
              <Label className="mb-2">NO SAVED LOOKS YET</Label>
              <Body className="text-center text-xs">
                Ask any AI stylist for /ootd and tap &quot;Save Look&quot; or &quot;Worn Today&quot;
                to build your encrypted Lookbook.
              </Body>
            </Card>
          ) : (
            visibleLooks.map((look) => (
              <LookbookCard
                key={look.id}
                look={look}
                personName={personMap[look.personId]?.name ?? 'Stylist'}
                sessionKey={appSessionKey}
                onToggleFavorite={async (l) => {
                  await toggleLookFavorite(l.id, !l.isFavorite);
                  await loadData();
                }}
                onJumpToChat={(personId) =>
                  router.push({ pathname: '/chat/[id]', params: { id: personId } })
                }
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
