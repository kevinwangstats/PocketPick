import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { useSessionStore } from '../../stores/useSessionStore';
import { getDatabase } from '../../db/client';
import { resources, Resource } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { usePicker } from '../../hooks/usePicker';
import {
  ShuffleDisplay,
  WinnerCard,
  WeightFilterModal,
  ResourceTypeFilter,
} from '../../components/picker';
import { H1, Label, Body, Button, Card } from '../../components/ui';

export default function RandomizerScreen() {
  const { activeVaultId, activeVaultKey } = useSessionStore();
  const [items, setItems] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ResourceTypeFilter>('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const loadPool = useCallback(async () => {
    if (!activeVaultId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const db = await getDatabase();
      const rows = await db.select().from(resources).where(eq(resources.vaultId, activeVaultId));
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeVaultId]);

  useEffect(() => {
    loadPool();
  }, [loadPool]);

  // Filter pool items by selected resource type
  const activePool = items.filter((item) => {
    if (typeFilter === 'all') return true;
    return item.type === typeFilter;
  });

  const { state, winner, currentDisplayItem, error, startShuffle, reset } = usePicker({
    vaultId: activeVaultId ?? '',
    vaultKey: activeVaultKey,
    items: activePool,
    onPickLogged: () => {
      // Pick logged successfully in SQLite
    },
  });

  const isLocked = !activeVaultId || !activeVaultKey;

  return (
    <ScrollView
      className="flex-1 bg-black px-5 py-6"
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={loadPool} tintColor="#FFFFFF" />
      }
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      <Label className="mb-1 text-zinc-500">CSPRNG RANDOM SELECTION</Label>
      <H1 className="mb-4">RANDOM PICKER</H1>

      {isLocked ? (
        <Card className="items-center justify-center p-8 border border-zinc-800 bg-zinc-950 mt-4">
          <Label className="text-zinc-400 mb-2">VAULT LOCKED</Label>
          <Body className="text-zinc-500 text-center mb-6">
            Unlock a vault from the Vaults tab to enable secure, cryptographically fair selection.
          </Body>
          <View className="h-14 w-full border border-dashed border-zinc-800 items-center justify-center">
            <Label className="text-zinc-600">[ ENCRYPTED STATE ACTIVE ]</Label>
          </View>
        </Card>
      ) : (
        <View>
          {/* Controls bar */}
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Label className="text-zinc-400">
                SELECTION: UNIFORM • POOL: {typeFilter.toUpperCase()} ({activePool.length})
              </Label>
            </View>
            <Button
              variant="secondary"
              className="h-8 px-3"
              onPress={() => setFilterModalVisible(true)}
              disabled={state === 'shuffling' || state === 'decelerating'}
            >
              FILTER POOL
            </Button>
          </View>

          {/* Shuffle animation & monospace display */}
          <ShuffleDisplay
            state={state}
            displayItem={currentDisplayItem}
            totalPoolSize={activePool.length}
          />

          {error && (
            <Card className="border border-zinc-700 bg-zinc-900 p-3 mt-4">
              <Body className="text-xs text-white font-mono">{error}</Body>
            </Card>
          )}

          {/* Decrypted Winner Card */}
          {winner && (
            <WinnerCard
              winner={winner}
              onRePick={() => startShuffle('re_pick')}
              onConfirm={reset}
            />
          )}

          {/* Pick Trigger Button */}
          {state !== 'revealed' && (
            <View className="mt-6">
              <Button
                variant="primary"
                loading={state === 'shuffling' || state === 'decelerating'}
                disabled={activePool.length === 0}
                onPress={() => startShuffle('pick')}
              >
                {state === 'idle' ? 'EXECUTE CSPRNG PICK' : 'SAMPLING POOL...'}
              </Button>
            </View>
          )}
        </View>
      )}

      {/* Filter Modal */}
      <WeightFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        typeFilter={typeFilter}
        onSelectTypeFilter={setTypeFilter}
      />
    </ScrollView>
  );
}
