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
 * Each item has an equal 1/N probability of being chosen.
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

/**
 * Selects an item with probability proportional to its weight.
 * Items with higher weights have proportionally higher likelihood of selection.
 * Uses cumulative distribution and unbiased CSPRNG sampling.
 */
export function pickWeighted<T extends PickableItem>(items: T[]): T {
  if (!items || items.length === 0) {
    throw new EmptyPoolError();
  }
  if (items.length === 1) {
    return items[0];
  }

  // Calculate cumulative weights
  let totalWeight = 0;
  const cumulativeWeights: number[] = new Array(items.length);

  for (let i = 0; i < items.length; i++) {
    const w = Math.max(1, Math.floor(items[i].weight ?? 1));
    totalWeight += w;
    cumulativeWeights[i] = totalWeight;
  }

  if (totalWeight <= 0) {
    throw new Error('Total weight must be greater than zero');
  }

  // Sample target in [0, totalWeight - 1]
  const target = getRandomInt(0, totalWeight - 1);

  // Binary search for efficiency across larger collections
  let low = 0;
  let high = items.length - 1;
  let resultIndex = items.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (target < cumulativeWeights[mid]) {
      resultIndex = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return items[resultIndex];
}
