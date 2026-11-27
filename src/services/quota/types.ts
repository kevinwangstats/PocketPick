export interface QuotaStatus {
  currentCount: number;
  maxLimit: number;
  remaining: number;
  isBlocked: boolean;
  periodMonth: string;
}

export class QuotaExceededError extends Error {
  constructor(limitOrMessage: number | string = 500) {
    const message =
      typeof limitOrMessage === 'number'
        ? `Monthly LLM quota exceeded (${limitOrMessage} requests max). Operation blocked.`
        : limitOrMessage;
    super(message);
    this.name = 'QuotaExceededError';
  }
}
