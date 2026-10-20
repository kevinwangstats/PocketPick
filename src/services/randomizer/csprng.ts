import QuickCrypto from 'react-native-quick-crypto';

/**
 * Generates an unbiased cryptographically secure 32-bit unsigned integer.
 */
export function getRandomUint32(): number {
  const buffer = QuickCrypto.randomBytes(4);
  return buffer.readUInt32BE(0);
}

/**
 * Returns a cryptographically secure, uniformly distributed integer in the range [min, max] (inclusive).
 * Uses rejection sampling to completely eliminate modulo bias.
 *
 * @param min - Inclusive lower bound
 * @param max - Inclusive upper bound
 */
export function getRandomInt(min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error('Range bounds must be integers');
  }
  if (min > max) {
    throw new Error(`Invalid range: min (${min}) cannot be greater than max (${max})`);
  }

  const range = max - min + 1;
  if (range === 1) {
    return min;
  }

  // Calculate the largest multiple of range that fits within a 32-bit unsigned integer (0 to 2^32 - 1)
  // Max Uint32 is 0xFFFFFFFF = 4,294,967,295
  const maxUint32 = 0xffffffff;
  const maxAllowed = Math.floor(maxUint32 / range) * range;

  let rand: number;
  do {
    rand = getRandomUint32();
  } while (rand >= maxAllowed);

  return min + (rand % range);
}
