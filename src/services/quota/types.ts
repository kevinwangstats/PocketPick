export interface QuotaStatus {
  currentCount: number;
  maxLimit: number;
  remaining: number;
  isBlocked: boolean;
  periodMonth: string;
}

export class QuotaExceededError extends Error {
  constructor(message = 'Monthly LLM quota exceeded (100 requests max). Operation blocked.') {
    super(message);
    this.name = 'QuotaExceededError';
  }
}
