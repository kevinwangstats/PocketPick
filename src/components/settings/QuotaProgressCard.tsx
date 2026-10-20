import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { getQuotaStatus, MAX_MONTHLY_QUOTA } from '../../services/quota/quotaManager';
import { QuotaStatus } from '../../services/quota/types';
import { Card, H2, Label, Body, Mono } from '../ui';

export function QuotaProgressCard() {
  const [quota, setQuota] = useState<QuotaStatus | null>(null);

  useEffect(() => {
    loadQuota();
  }, []);

  const loadQuota = async () => {
    try {
      const status = await getQuotaStatus();
      setQuota(status);
    } catch {
      // Ignore
    }
  };

  const currentCount = quota?.currentCount ?? 0;
  const maxLimit = quota?.maxLimit ?? MAX_MONTHLY_QUOTA;
  const percentage = Math.min(100, Math.round((currentCount / maxLimit) * 100));

  return (
    <Card className="p-5 border border-zinc-800 bg-zinc-950 mb-6">
      <View className="flex-row justify-between items-center mb-1">
        <H2 className="text-white text-lg">MONTHLY QUOTA GUARD</H2>
        <Label className="text-zinc-400">{quota?.periodMonth ?? 'CURRENT'}</Label>
      </View>
      <Body className="text-zinc-500 text-xs mb-4">
        Hard limit enforced by on-device SQLite barrier to eliminate accidental charges.
      </Body>

      {/* Progress Bar Container */}
      <View className="h-4 w-full bg-zinc-900 border border-zinc-700 mb-3 overflow-hidden">
        <View className="h-full bg-white" style={{ width: `${percentage}%` }} />
      </View>

      <View className="flex-row justify-between items-center">
        <Mono className="text-xs text-white">
          {currentCount} / {maxLimit} REQUESTS
        </Mono>
        <Mono className="text-xs text-zinc-400">
          {quota?.remaining ?? MAX_MONTHLY_QUOTA} REMAINING
        </Mono>
      </View>
    </Card>
  );
}
