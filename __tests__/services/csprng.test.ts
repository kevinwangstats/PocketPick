import { getRandomInt, getRandomUint32 } from '../../src/services/randomizer/csprng';

describe('CSPRNG (Cryptographically Secure PRNG)', () => {
  it('generates 32-bit unsigned integers', () => {
    for (let i = 0; i < 50; i++) {
      const val = getRandomUint32();
      expect(typeof val).toBe('number');
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('generates numbers strictly within [min, max] inclusive', () => {
    const min = 3;
    const max = 7;
    for (let i = 0; i < 200; i++) {
      const val = getRandomInt(min, max);
      expect(val).toBeGreaterThanOrEqual(min);
      expect(val).toBeLessThanOrEqual(max);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('handles single value range [n, n]', () => {
    expect(getRandomInt(42, 42)).toBe(42);
    expect(getRandomInt(0, 0)).toBe(0);
    expect(getRandomInt(-5, -5)).toBe(-5);
  });

  it('supports negative ranges', () => {
    for (let i = 0; i < 50; i++) {
      const val = getRandomInt(-10, -2);
      expect(val).toBeGreaterThanOrEqual(-10);
      expect(val).toBeLessThanOrEqual(-2);
    }
  });

  it('throws error when min > max', () => {
    expect(() => getRandomInt(10, 5)).toThrow('Invalid range');
  });

  it('throws error on non-integer inputs', () => {
    expect(() => getRandomInt(1.5, 4)).toThrow('must be integers');
    expect(() => getRandomInt(1, 4.2)).toThrow('must be integers');
  });
});
