import React, { useState } from 'react';
import { View, FlatList, RefreshControl, Pressable } from 'react-native';
import { HistoryLogWithResource } from '../../services/history/historyService';
import { HistoryItemRow } from './HistoryItemRow';
import { Card, H2, Label, Body, Button } from '../ui';

export interface HistoryTimelineProps {
  logs: HistoryLogWithResource[];
  vaultKey: Buffer | null;
  refreshing: boolean;
  onRefresh: () => void;
  onClearHistory?: () => void;
}

export function HistoryTimeline({
  logs,
  vaultKey,
  refreshing,
  onRefresh,
  onClearHistory,
}: HistoryTimelineProps) {
  const [filter, setFilter] = useState<'all' | 'ticket' | 'photo'>('all');

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.resource?.type === filter;
  });

  return (
    <View className="flex-1 bg-black">
      {/* Header and Filter Row */}
      <View className="flex-row items-center justify-between mb-4">
        <H2 className="text-white text-lg">AUDIT LOG</H2>
        {onClearHistory && logs.length > 0 && (
          <Button variant="secondary" className="h-8 px-3" onPress={onClearHistory}>
            CLEAR LOG
          </Button>
        )}
      </View>

      <View className="flex-row space-x-2 gap-2 mb-4">
        {(['all', 'ticket', 'photo'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setFilter(t)}
            className={`px-3 py-1.5 border ${
              filter === t ? 'border-white bg-white' : 'border-zinc-800 bg-zinc-950'
            }`}
          >
            <Label className={filter === t ? 'text-black' : 'text-zinc-400'}>
              {t.toUpperCase()}
            </Label>
          </Pressable>
        ))}
      </View>

      {filteredLogs.length === 0 ? (
        <Card className="items-center justify-center p-8 border border-zinc-800 bg-zinc-950 mt-6">
          <Label className="text-zinc-500 mb-2">NO AUDIT RECORDS</Label>
          <Body className="text-xs text-zinc-600 text-center font-mono">
            SELECTION HISTORY WILL APPEAR HERE AFTER ROLLING THE RANDOMIZER
          </Body>
        </Card>
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HistoryItemRow item={item} vaultKey={vaultKey} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}
