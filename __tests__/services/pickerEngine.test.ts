import {
  EmptyPoolError,
  pickUniform,
  pickWeighted,
} from '../../src/services/randomizer/pickerEngine';
import { PickableItem } from '../../src/services/randomizer/types';

describe('PickerEngine (Selection Algorithms)', () => {
  describe('pickUniform', () => {
    it('throws EmptyPoolError on empty array', () => {
      expect(() => pickUniform([])).toThrow(EmptyPoolError);
    });

    it('returns the only item in a single-item pool', () => {
      const item: PickableItem = { id: 'only-one', weight: 1 };
      expect(pickUniform([item])).toBe(item);
    });

    it('distributes selections evenly across items', () => {
      const items: PickableItem[] = [
        { id: 'A', weight: 1 },
        { id: 'B', weight: 1 },
        { id: 'C', weight: 1 },
        { id: 'D', weight: 1 },
      ];

      const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
      const trials = 4000;

      for (let i = 0; i < trials; i++) {
        const picked = pickUniform(items);
        counts[picked.id]++;
      }

      // Expected ~1000 each (25%). Margin of error < 3.5%
      for (const id of Object.keys(counts)) {
        const proportion = counts[id] / trials;
        expect(proportion).toBeGreaterThan(0.215);
        expect(proportion).toBeLessThan(0.285);
      }
    });
  });

  describe('pickWeighted', () => {
    it('throws EmptyPoolError on empty array', () => {
      expect(() => pickWeighted([])).toThrow(EmptyPoolError);
    });

    it('returns the only item in a single-item pool', () => {
      const item: PickableItem = { id: 'only-one', weight: 5 };
      expect(pickWeighted([item])).toBe(item);
    });

    it('samples according to relative weights within statistical bounds (10,000 trials)', () => {
      const items: PickableItem[] = [
        { id: 'low', weight: 1 }, // 10%
        { id: 'mid', weight: 2 }, // 20%
        { id: 'high', weight: 7 }, // 70%
      ];

      const counts: Record<string, number> = { low: 0, mid: 0, high: 0 };
      const trials = 10000;

      for (let i = 0; i < trials; i++) {
        const picked = pickWeighted(items);
        counts[picked.id]++;
      }

      const pLow = counts.low / trials;
      const pMid = counts.mid / trials;
      const pHigh = counts.high / trials;

      // Expected: 0.10, 0.20, 0.70. With 10,000 trials, 99.9% CI is within +/- 0.02
      expect(pLow).toBeGreaterThan(0.08);
      expect(pLow).toBeLessThan(0.12);

      expect(pMid).toBeGreaterThan(0.18);
      expect(pMid).toBeLessThan(0.22);

      expect(pHigh).toBeGreaterThan(0.68);
      expect(pHigh).toBeLessThan(0.72);
    });

    it('treats zero or negative weights as minimum 1 weight for safety', () => {
      const items: PickableItem[] = [
        { id: 'A', weight: 0 },
        { id: 'B', weight: -5 },
      ];

      const counts: Record<string, number> = { A: 0, B: 0 };
      const trials = 1000;

      for (let i = 0; i < trials; i++) {
        const picked = pickWeighted(items);
        counts[picked.id]++;
      }

      // Both normalized to weight 1, so roughly 50/50
      expect(counts.A).toBeGreaterThan(400);
      expect(counts.B).toBeGreaterThan(400);
    });
  });
});
