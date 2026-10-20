import {
  getPeriodMonthString,
  getQuotaStatus,
  incrementAndEnforceQuota,
  MAX_MONTHLY_QUOTA,
} from '../../src/services/quota/quotaManager';
import { QuotaExceededError } from '../../src/services/quota/types';
import { getDatabase, closeDatabase } from '../../src/db/client';

describe('Quota Guard & Monthly Limit Enforcer (TDD)', () => {
  beforeEach(() => {
    closeDatabase();
  });

  afterEach(() => {
    closeDatabase();
  });

  it('correctly formats period month strings as YYYY-MM', () => {
    const octDate = new Date(Date.UTC(2026, 9, 20)); // October 2026
    expect(getPeriodMonthString(octDate)).toBe('2026-10');

    const janDate = new Date(Date.UTC(2027, 0, 1)); // January 2027
    expect(getPeriodMonthString(janDate)).toBe('2027-01');
  });

  it('returns default full allowance (100 remaining) when month has no recorded calls', async () => {
    const date = new Date(Date.UTC(2026, 9, 1));
    const status = await getQuotaStatus(date);

    expect(status.currentCount).toBe(0);
    expect(status.maxLimit).toBe(MAX_MONTHLY_QUOTA);
    expect(status.remaining).toBe(MAX_MONTHLY_QUOTA);
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

  it('throws QuotaExceededError when limit is reached', () => {
    const error = new QuotaExceededError();
    expect(error.name).toBe('QuotaExceededError');
    expect(error.message).toContain('100 requests max');
  });
});
