import * as SecureStore from 'expo-secure-store';
import QuickCrypto from 'react-native-quick-crypto';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../../db/client';
import { apiQuotas } from '../../db/schema';
import { QuotaStatus, QuotaExceededError } from './types';

export const DEFAULT_MONTHLY_QUOTA = 500;
export const MAX_MONTHLY_QUOTA = DEFAULT_MONTHLY_QUOTA;
export const MONTHLY_QUOTA_STORAGE_KEY = 'POCKETPICK_MONTHLY_QUOTA_LIMIT';

/**
 * Retrieves the configured monthly LLM quota limit from SecureStore.
 * Defaults to 500 requests/month to support conversational styling chats.
 */
export async function getMonthlyQuotaLimit(): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(MONTHLY_QUOTA_STORAGE_KEY);
    if (raw !== null) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch {
    // Fallback to default limit
  }
  return DEFAULT_MONTHLY_QUOTA;
}

/**
 * Persists a positive integer monthly LLM quota limit in SecureStore.
 */
export async function setMonthlyQuotaLimit(limit: number): Promise<void> {
  const intLimit = Math.floor(limit);
  if (isNaN(intLimit) || intLimit <= 0) {
    throw new Error('Monthly quota limit must be a positive integer');
  }
  await SecureStore.setItemAsync(MONTHLY_QUOTA_STORAGE_KEY, intLimit.toString());
}

/**
 * Returns month string formatted as 'YYYY-MM'.
 */
export function getPeriodMonthString(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Retrieves the current quota usage and remaining allowance for the month.
 */
export async function getQuotaStatus(targetDate: Date = new Date()): Promise<QuotaStatus> {
  const db = await getDatabase();
  const periodMonth = getPeriodMonthString(targetDate);
  const configuredLimit = await getMonthlyQuotaLimit();

  const rows = await db.select().from(apiQuotas).where(eq(apiQuotas.periodMonth, periodMonth));

  if (rows.length === 0) {
    return {
      currentCount: 0,
      maxLimit: configuredLimit,
      remaining: configuredLimit,
      isBlocked: false,
      periodMonth,
    };
  }

  const row = rows[0];
  const currentCount = row.requestCount;
  const maxLimit = configuredLimit;
  const remaining = Math.max(0, maxLimit - currentCount);

  return {
    currentCount,
    maxLimit,
    remaining,
    isBlocked: remaining <= 0,
    periodMonth,
  };
}

/**
 * Atomically checks and increments the monthly API quota.
 * Throws QuotaExceededError if the configured monthly limit has already been reached.
 */
export async function incrementAndEnforceQuota(targetDate: Date = new Date()): Promise<number> {
  const db = await getDatabase();
  const periodMonth = getPeriodMonthString(targetDate);
  const configuredLimit = await getMonthlyQuotaLimit();
  const now = new Date();

  let newCount = 0;

  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(apiQuotas)
      .where(eq(apiQuotas.periodMonth, periodMonth));

    if (existing.length === 0) {
      const id = QuickCrypto.randomBytes(16).toString('hex');
      await tx.insert(apiQuotas).values({
        id,
        periodMonth,
        requestCount: 1,
        maxMonthlyLimit: configuredLimit,
        lastRequestAt: now,
      });
      newCount = 1;
    } else {
      const record = existing[0];
      if (record.requestCount >= configuredLimit) {
        throw new QuotaExceededError(configuredLimit);
      }

      newCount = record.requestCount + 1;
      await tx
        .update(apiQuotas)
        .set({
          requestCount: newCount,
          maxMonthlyLimit: configuredLimit,
          lastRequestAt: now,
        })
        .where(eq(apiQuotas.id, record.id));
    }
  });

  return newCount;
}

/**
 * Resets quota for testing or admin purposes.
 */
export async function resetQuotaForMonth(periodMonth: string): Promise<void> {
  const db = await getDatabase();
  await db.delete(apiQuotas).where(eq(apiQuotas.periodMonth, periodMonth));
}
