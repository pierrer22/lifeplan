import { describe, expect, it } from 'vitest';
import { PRESET_PROFILES } from '../../data/presets';
import { calculateForwardScenarios } from '../forwardScenarios';

describe('calculateForwardScenarios', () => {
  it('generates 1-year blocks with rising salary, falling HECS, and higher borrowing power', () => {
    const base = PRESET_PROFILES[0];
    const res = calculateForwardScenarios({
      profile: base,
      horizonYears: 5,
      includeMastersUplift: false,
      annualSavingsCapacity: 15000,
    });

    expect(res.blocks).toHaveLength(6); // Year 0 .. Year 5
    expect(res.blocks[0].year).toBe(0);
    expect(res.blocks[5].year).toBe(5);
    expect(res.blocks[5].grossSalary).toBeGreaterThan(res.blocks[0].grossSalary);
    expect(res.blocks[5].hecsBalance).toBeLessThan(res.blocks[0].hecsBalance);
    expect(res.blocks[5].maxBorrowingPower).toBeGreaterThan(
      res.blocks[0].maxBorrowingPower,
    );
    expect(res.fiveYearBorrowingGain).toBeGreaterThan(0);
  });

  it('applies Masters graduation salary uplift in the completion year and boosts borrowing power', () => {
    const base = PRESET_PROFILES[0];
    const noMasters = calculateForwardScenarios({
      profile: base,
      horizonYears: 5,
      includeMastersUplift: false,
    });
    const withMasters = calculateForwardScenarios({
      profile: base,
      horizonYears: 5,
      includeMastersUplift: true,
      mastersCompletionYear: 2,
      mastersUpliftPct: 12,
    });

    expect(withMasters.blocks[2].mastersJustCompleted).toBe(true);
    expect(withMasters.blocks[2].mastersAttained).toBe(true);
    expect(withMasters.blocks[1].mastersAttained).toBe(false);
    expect(withMasters.blocks[2].grossSalary).toBeGreaterThan(
      noMasters.blocks[2].grossSalary,
    );
    expect(withMasters.blocks[5].maxBorrowingPower).toBeGreaterThan(
      noMasters.blocks[5].maxBorrowingPower,
    );
  });

  it('tracks reduced HECS balance across consecutive 1-year blocks', () => {
    const base = { ...PRESET_PROFILES[0], grossSalary: 110000, hecsBalance: 25000 };
    const res = calculateForwardScenarios({
      profile: base,
      horizonYears: 5,
      includeMastersUplift: false,
    });

    for (let i = 1; i < res.blocks.length; i++) {
      expect(res.blocks[i].hecsBalance).toBeLessThanOrEqual(
        res.blocks[i - 1].hecsBalance,
      );
    }
    expect(res.fiveYearHecsReduction).toBeGreaterThan(15000);
  });
});
