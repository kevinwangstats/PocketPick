import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { getQuotaStatus, MAX_MONTHLY_QUOTA } from '../../services/quota/quotaManager';
import { QuotaStatus } from '../../services/quota/types';
import { Card, H2, Label, Body, Mono } from '../ui';
import { useTheme } from '../../theme';

export function QuotaProgressCard() {
  const { theme } = useTheme();
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
    <Card className="p-5 mb-6">
      <View className="flex-row justify-between items-center mb-1">
        <H2 className="text-lg">
          {theme.isUppercase ? 'MONTHLY QUOTA GUARD' : 'Monthly Quota Guard'}
        </H2>
        <Label>{quota?.periodMonth ?? (theme.isUppercase ? 'CURRENT' : 'Current')}</Label>
      </View>
      <Body style={{ color: theme.colors.textMuted }} className="text-xs mb-4">
        Hard limit enforced by on-device SQLite barrier to eliminate accidental charges.
      </Body>

      {/* Progress Bar Container */}
      <View
        style={{
          height: 16,
          backgroundColor: theme.colors.badgeBg,
          borderColor: theme.colors.cardBorder,
          borderWidth: 1,
          borderRadius: theme.borderRadius ? 6 : 0,
          marginBottom: 12,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            backgroundColor: theme.colors.accent,
            width: `${percentage}%`,
          }}
        />
      </View>

      <View className="flex-row justify-between items-center">
        <Mono style={{ color: theme.colors.textPrimary }} className="text-xs">
          {currentCount} / {maxLimit} REQUESTS
        </Mono>
        <Mono style={{ color: theme.colors.textMuted }} className="text-xs">
          {quota?.remaining ?? MAX_MONTHLY_QUOTA} REMAINING
        </Mono>
      </View>
    </Card>
  );
}
