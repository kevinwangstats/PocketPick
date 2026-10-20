import { EmptyPoolError, pickUniform } from '../../src/services/randomizer/pickerEngine';
import { PickableItem } from '../../src/services/randomizer/types';

describe('PickerEngine (Strictly Uniform Selection Algorithm)', () => {
  describe('pickUniform', () => {
    it('throws EmptyPoolError on empty array', () => {
      expect(() => pickUniform([])).toThrow(EmptyPoolError);
    });

    it('returns the only item in a single-item pool', () => {
      const item: PickableItem = { id: 'only-one' };
      expect(pickUniform([item])).toBe(item);
    });

    it('distributes selections evenly across items with equal 1/N probability', () => {
      const items: PickableItem[] = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }];

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
});
