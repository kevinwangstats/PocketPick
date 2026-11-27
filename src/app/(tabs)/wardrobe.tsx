import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { WARDROBE_CATEGORIES, WardrobeCategory } from '@/db/schema';
import { useSessionStore } from '@/stores/useSessionStore';
import { listPhotosWithMetadata, bulkMovePhotoKind } from '@/services/photos/photoService';
import { DecryptedPhotoRecord } from '@/services/photos/types';
import { runBatchPhotoAnalysis } from '@/services/photos/photoBatchAnalyzer';
import { isOpenRouterKeyConfigured } from '@/services/llm/llmKeyStore';
import { PhotoGrid, BatchAnalyzeBanner } from '@/components/photos';
import { useTheme } from '@/theme';

type CategoryFilter = 'all' | WardrobeCategory;

export default function WardrobeScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const appSessionKey = useSessionStore((state) => state.appSessionKey);

  const [records, setRecords] = useState<DecryptedPhotoRecord[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Batch AI auto-sort state + Undo toast
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number } | null>(
    null,
  );
  const [movedUndoIds, setMovedUndoIds] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const loadWardrobe = useCallback(async () => {
    if (!appSessionKey) return;
    try {
      const items = await listPhotosWithMetadata(appSessionKey, 'wardrobe');
      setRecords(items);
    } catch (err) {
      console.error('Failed to load wardrobe:', err);
    }
  }, [appSessionKey]);

  useFocusEffect(
    useCallback(() => {
      loadWardrobe();
    }, [loadWardrobe]),
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: records.length,
      top: 0,
      bottom: 0,
      underwear: 0,
      hosiery: 0,
      others: 0,
    };
    for (const r of records) {
      counts[r.photo.category] += 1;
    }
    return counts;
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (categoryFilter !== 'all' && r.photo.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        r.item.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.photo.category.toLowerCase().includes(q)
      );
    });
  }, [records, categoryFilter, searchQuery]);

  const unsortedPhotos = useMemo(
    () => records.filter((r) => r.photo.aiHasHumanBody === null).map((r) => r.photo),
    [records],
  );

  const handleStartBatchAnalyze = async () => {
    if (!appSessionKey || unsortedPhotos.length === 0) return;
    const hasKey = await isOpenRouterKeyConfigured();
    if (!hasKey) {
      Alert.alert(
        'OpenRouter Key Required',
        'Add your OpenRouter API key in Settings to run AI Auto-Sort.',
      );
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsAnalyzing(true);
    setBatchProgress({ completed: 0, total: unsortedPhotos.length });

    try {
      const result = await runBatchPhotoAnalysis({
        photos: unsortedPhotos,
        sessionKey: appSessionKey,
        concurrency: 2,
        signal: controller.signal,
        onProgress: (p) => setBatchProgress({ completed: p.completed, total: p.total }),
      });

      if (result.movedToPastOotdIds.length > 0) {
        setMovedUndoIds(result.movedToPastOotdIds);
      }
      await loadWardrobe();
    } finally {
      setIsAnalyzing(false);
      setBatchProgress(null);
      abortRef.current = null;
    }
  };

  const handleUndoAutoSort = async () => {
    if (movedUndoIds.length === 0) return;
    await bulkMovePhotoKind(movedUndoIds, 'wardrobe');
    setMovedUndoIds([]);
    await loadWardrobe();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 16 }}>
      {/* Category Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 40 }}
        className="mb-3"
      >
        <View className="flex-row gap-2 items-center">
          {(['all', ...WARDROBE_CATEGORIES] as const).map((cat) => {
            const isSelected = categoryFilter === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategoryFilter(cat)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: theme.borderRadius ? 16 : 0,
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
                    textTransform: 'capitalize',
                    fontFamily: theme.isMono ? 'Courier' : undefined,
                  }}
                >
                  {cat} ({categoryCounts[cat]})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Search Bar */}
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search item or description (e.g. lace, tshirt, silk)..."
        placeholderTextColor={theme.colors.inputPlaceholder}
        style={{
          backgroundColor: theme.colors.inputBg,
          borderColor: theme.colors.inputBorder,
          borderWidth: 1,
          borderRadius: theme.borderRadius ? 10 : 0,
          color: theme.colors.inputText,
          paddingHorizontal: 12,
          paddingVertical: 8,
          fontSize: 13,
          marginBottom: 12,
        }}
      />

      {/* Batch AI Auto-Sort Banner */}
      <BatchAnalyzeBanner
        unsortedCount={unsortedPhotos.length}
        isRunning={isAnalyzing}
        progress={batchProgress}
        onStart={handleStartBatchAnalyze}
        onCancel={() => abortRef.current?.abort()}
      />

      {/* Undo Toast for Human-Body Auto-Sorting */}
      {movedUndoIds.length > 0 && (
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
          <Text
            style={{ color: theme.colors.textPrimary, fontSize: 11, flex: 1 }}
            numberOfLines={2}
          >
            Moved {movedUndoIds.length} photo(s) to Past OOTD (human body detected)
          </Text>
          <View className="flex-row gap-3">
            <Pressable onPress={() => router.push('/(tabs)/past-ootd')}>
              <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 11 }}>
                View
              </Text>
            </Pressable>
            <Pressable onPress={handleUndoAutoSort}>
              <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 11 }}>
                Undo
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* High-FPS Wardrobe Grid */}
      <PhotoGrid
        photoKind="wardrobe"
        defaultCategory={categoryFilter === 'all' ? 'others' : categoryFilter}
        records={filteredRecords}
        sessionKey={appSessionKey}
        onRefresh={loadWardrobe}
        emptyTitle="WARDROBE EMPTY"
        emptyBody="Snap or import isolated pieces (top, bottom, underwear, hosiery, others). Photos stay 100% inside this app."
      />
    </View>
  );
}
