import React, { useState, useEffect, useCallback } from 'react';
import { View, Alert } from 'react-native';
import { useSessionStore } from '../../stores/useSessionStore';
import {
  getHistoryLogs,
  clearVaultHistory,
  HistoryLogWithResource,
} from '../../services/history/historyService';
import { HistoryTimeline } from '../../components/history';
import { H1, Label, Card, Body } from '../../components/ui';

export default function HistoryScreen() {
  const { activeVaultId, activeVaultKey } = useSessionStore();
  const [logs, setLogs] = useState<HistoryLogWithResource[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await getHistoryLogs(activeVaultId ?? undefined, 50, 0);
      setLogs(rows);
    } catch {
      setLogs([]);
    } finally {
      setRefreshing(false);
    }
  }, [activeVaultId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleClearHistory = () => {
    if (!activeVaultId) return;

    Alert.alert(
      'Clear Selection History',
      'Are you sure you want to permanently delete all selection logs for this vault?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearVaultHistory(activeVaultId);
              await loadLogs();
            } catch {
              // Ignore or handle
            }
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-black px-5 py-6">
      <Label className="mb-1 text-zinc-500">IMMUTABLE LOCAL AUDIT</Label>
      <H1 className="mb-4">SELECTION LOG</H1>

      {!activeVaultId ? (
        <Card className="items-center justify-center p-8 border border-zinc-800 bg-zinc-950 mt-4">
          <Label className="text-zinc-400 mb-2">VAULT LOCKED</Label>
          <Body className="text-zinc-500 text-center mb-6">
            Unlock a vault to decrypt and view item details in your audit history.
          </Body>
          <View className="h-14 w-full border border-dashed border-zinc-800 items-center justify-center">
            <Label className="text-zinc-600">[ ENCRYPTED AUDIT TRAIL ]</Label>
          </View>
        </Card>
      ) : (
        <HistoryTimeline
          logs={logs}
          vaultKey={activeVaultKey}
          refreshing={refreshing}
          onRefresh={loadLogs}
          onClearHistory={handleClearHistory}
        />
      )}
    </View>
  );
}
