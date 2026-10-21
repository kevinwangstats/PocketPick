import React, { useState } from 'react';
import { View, FlatList, RefreshControl, Pressable, Text } from 'react-native';
import { HistoryLogWithResource } from '../../services/history/historyService';
import { HistoryItemRow } from './HistoryItemRow';
import { Card, H2, Label, Body, Button } from '../ui';
import { useTheme } from '../../theme';

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
  const { theme } = useTheme();
  const [filter, setFilter] = useState<'all' | 'ticket' | 'photo'>('all');

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.resource?.type === filter;
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header and Filter Row */}
      <View className="flex-row items-center justify-between mb-4">
        <H2 className="text-lg">{theme.isUppercase ? 'AUDIT LOG' : 'Audit Log'}</H2>
        {onClearHistory && logs.length > 0 && (
          <Button variant="secondary" className="h-8 px-3" onPress={onClearHistory}>
            {theme.isUppercase ? 'CLEAR LOG' : 'Clear Log'}
          </Button>
        )}
      </View>

      <View className="flex-row space-x-2 gap-2 mb-4">
        {(['all', 'ticket', 'photo'] as const).map((t) => {
          const isSelected = filter === t;
          return (
            <Pressable
              key={t}
              onPress={() => setFilter(t)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: theme.borderRadius ? 6 : 0,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? theme.colors.accent : theme.colors.cardBorder,
                backgroundColor: isSelected ? theme.colors.badgeBg : theme.colors.card,
              }}
            >
              <Text
                style={{
                  color: isSelected ? theme.colors.accent : theme.colors.textMuted,
                  fontFamily: theme.isMono ? 'Courier' : undefined,
                  fontWeight: isSelected ? '700' : '500',
                  fontSize: 11,
                  letterSpacing: theme.isUppercase ? 0.8 : 0,
                }}
              >
                {t.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filteredLogs.length === 0 ? (
        <Card className="items-center justify-center p-8 mt-6">
          <Label className="mb-2">NO AUDIT RECORDS</Label>
          <Body style={{ color: theme.colors.textMuted }} className="text-xs text-center font-mono">
            SELECTION HISTORY WILL APPEAR HERE AFTER ROLLING THE RANDOMIZER
          </Body>
        </Card>
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HistoryItemRow item={item} vaultKey={vaultKey} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}
