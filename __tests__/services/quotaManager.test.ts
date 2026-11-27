import {
  getPeriodMonthString,
  getQuotaStatus,
  incrementAndEnforceQuota,
  getMonthlyQuotaLimit,
  setMonthlyQuotaLimit,
  DEFAULT_MONTHLY_QUOTA,
} from '../../src/services/quota/quotaManager';
import { QuotaExceededError } from '../../src/services/quota/types';
import { getDatabase, closeDatabase } from '../../src/db/client';
import { mockSecureStore } from '../mocks/secure-store.mock';

describe('Quota Guard & Configurable Monthly Limit Enforcer (TDD)', () => {
  beforeEach(() => {
    closeDatabase();
    mockSecureStore._reset();
  });

  afterEach(() => {
    closeDatabase();
  });

  it('correctly formats period month strings as YYYY-MM', () => {
    const octDate = new Date(Date.UTC(2026, 9, 20));
    expect(getPeriodMonthString(octDate)).toBe('2026-10');

    const janDate = new Date(Date.UTC(2027, 0, 1));
    expect(getPeriodMonthString(janDate)).toBe('2027-01');
  });

  it('defaults monthly quota limit to 500 and supports configuring positive limits', async () => {
    expect(await getMonthlyQuotaLimit()).toBe(DEFAULT_MONTHLY_QUOTA);
    expect(DEFAULT_MONTHLY_QUOTA).toBe(500);

    await setMonthlyQuotaLimit(1000);
    expect(await getMonthlyQuotaLimit()).toBe(1000);

    await expect(setMonthlyQuotaLimit(0)).rejects.toThrow(
      'Monthly quota limit must be a positive integer',
    );
  });

  it('returns default full allowance (500 remaining) when month has no recorded calls', async () => {
    const date = new Date(Date.UTC(2026, 9, 1));
    const status = await getQuotaStatus(date);

    expect(status.currentCount).toBe(0);
    expect(status.maxLimit).toBe(DEFAULT_MONTHLY_QUOTA);
    expect(status.remaining).toBe(DEFAULT_MONTHLY_QUOTA);
    expect(status.isBlocked).toBe(false);
    expect(status.periodMonth).toBe('2026-10');
  });

  it('atomically increments quota and enforces transaction boundary', async () => {
    const db = await getDatabase();
    const transactionSpy = jest.spyOn(db, 'transaction');

    const date = new Date(Date.UTC(2026, 9, 5));
    const count = await incrementAndEnforceQuota(date);

    expect(transactionSpy).toHaveBeenCalled();
    expect(typeof count).toBe('number');
  });

  it('throws QuotaExceededError with dynamic limit message', () => {
    const error = new QuotaExceededError(500);
    expect(error.name).toBe('QuotaExceededError');
    expect(error.message).toContain('500 requests max');
  });
});
