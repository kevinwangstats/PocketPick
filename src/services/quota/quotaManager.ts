import QuickCrypto from 'react-native-quick-crypto';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../../db/client';
import { apiQuotas } from '../../db/schema';
import { QuotaStatus, QuotaExceededError } from './types';

export const MAX_MONTHLY_QUOTA = 100;

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

  const rows = await db.select().from(apiQuotas).where(eq(apiQuotas.periodMonth, periodMonth));

  if (rows.length === 0) {
    return {
      currentCount: 0,
      maxLimit: MAX_MONTHLY_QUOTA,
      remaining: MAX_MONTHLY_QUOTA,
      isBlocked: false,
      periodMonth,
    };
  }

  const row = rows[0];
  const currentCount = row.requestCount;
  const maxLimit = row.maxMonthlyLimit;
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
 * Throws QuotaExceededError if the request limit (100) has already been reached.
 */
export async function incrementAndEnforceQuota(targetDate: Date = new Date()): Promise<number> {
  const db = await getDatabase();
  const periodMonth = getPeriodMonthString(targetDate);
  const now = new Date();

  let newCount = 0;

  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(apiQuotas)
      .where(eq(apiQuotas.periodMonth, periodMonth));

    if (existing.length === 0) {
      // First request of the month
      const id = QuickCrypto.randomBytes(16).toString('hex');
      await tx.insert(apiQuotas).values({
        id,
        periodMonth,
        requestCount: 1,
        maxMonthlyLimit: MAX_MONTHLY_QUOTA,
        lastRequestAt: now,
      });
      newCount = 1;
    } else {
      const record = existing[0];
      if (record.requestCount >= record.maxMonthlyLimit) {
        throw new QuotaExceededError();
      }

      newCount = record.requestCount + 1;
      await tx
        .update(apiQuotas)
        .set({
          requestCount: newCount,
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
