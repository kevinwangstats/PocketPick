import { getRandomInt } from './csprng';
import { PickableItem } from './types';

export class EmptyPoolError extends Error {
  constructor(message = 'Cannot pick from an empty pool of items') {
    super(message);
    this.name = 'EmptyPoolError';
  }
}

/**
 * Selects an item uniformly at random from a non-empty array of items.
 * Each item has an equal 1/N probability of being chosen using unbiased CSPRNG.
 * Selection is strictly uniform across all pool items.
 */
export function pickUniform<T extends PickableItem>(items: T[]): T {
  if (!items || items.length === 0) {
    throw new EmptyPoolError();
  }
  if (items.length === 1) {
    return items[0];
  }

  const selectedIndex = getRandomInt(0, items.length - 1);
  return items[selectedIndex];
}
