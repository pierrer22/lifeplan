import { describe, expect, it } from 'vitest';
import type { RentVsBuyInput } from '../../types/planner';
import { calculateRentVsBuy } from '../rentVsBuy';

function makeBaseInput(overrides: Partial<RentVsBuyInput> = {}): RentVsBuyInput {
  return {
    state: 'NSW',
    cityLabel: 'Sydney',
    propertyPrice: 800000,
    depositPct: 20,
    isFirstHomeBuyer: true,
    isNewHome: false,
    mortgageRatePct: 6.0,
    loanTermYears: 30,
    capitalGrowthPct: 5.5,
    inflationRatePct: 2.8,
    weeklyRent: 620,
    annualRentIncreasePct: 3.5,
    rentersInsuranceAnnual: 280,
    investmentReturnPct: 7.5,
    marginalTaxRatePct: 32,
    strataAnnual: 3600,
    councilRatesAnnual: 1600,
    waterRatesAnnual: 1000,
    homeInsuranceAnnual: 1800,
    maintenancePctOfValue: 0.8,
    buyingCostsFixed: 3500,
    sellingCostsPct: 2.2,
    horizonYears: 15,
    ...overrides,
  };
}

describe('calculateRentVsBuy', () => {
  it('computes Year-0 apples-to-apples outlay and horizonYears + 1 points', () => {
    const res = calculateRentVsBuy(makeBaseInput({ horizonYears: 12 }));

    expect(res.yearlySeries).toHaveLength(13);
    expect(res.initialCashRequired).toBe(
      res.depositAmount + res.stampDuty + res.lmiEstimate + res.buyingCostsFixed,
    );
    expect(res.yearlySeries[0].renterNetWealthNominal).toBe(res.initialCashRequired);
  });

  it('higher capital growth improves buyer wealth and shortens break-even', () => {
    const slow = calculateRentVsBuy(makeBaseInput({ capitalGrowthPct: 3.0, horizonYears: 20 }));
    const fast = calculateRentVsBuy(makeBaseInput({ capitalGrowthPct: 7.0, horizonYears: 20 }));

    expect(fast.buyerNetWealthNominal).toBeGreaterThan(slow.buyerNetWealthNominal);
    if (slow.breakEvenYearNominal !== null && fast.breakEvenYearNominal !== null) {
      expect(fast.breakEvenYearNominal).toBeLessThanOrEqual(slow.breakEvenYearNominal);
    }
  });

  it('higher rent increases raise totalRentPaid and shift net wealth toward buying', () => {
    const lowRentGrowth = calculateRentVsBuy(makeBaseInput({ annualRentIncreasePct: 1.5 }));
    const highRentGrowth = calculateRentVsBuy(makeBaseInput({ annualRentIncreasePct: 6.0 }));

    expect(highRentGrowth.totalRentPaid).toBeGreaterThan(lowRentGrowth.totalRentPaid);
    expect(highRentGrowth.netWealthDiffNominal).toBeGreaterThan(
      lowRentGrowth.netWealthDiffNominal,
    );
  });

  it('each ownership cost (strata, council, water, insurance, maintenance) increases unrecoverable buy costs and lowers buyer wealth', () => {
    const base = calculateRentVsBuy(makeBaseInput());

    const checks: Array<[Partial<RentVsBuyInput>, keyof typeof base]> = [
      [{ strataAnnual: 7200 }, 'totalStrata'],
      [{ councilRatesAnnual: 3200 }, 'totalCouncil'],
      [{ waterRatesAnnual: 2200 }, 'totalWater'],
      [{ homeInsuranceAnnual: 3800 }, 'totalHomeInsurance'],
      [{ maintenancePctOfValue: 1.6 }, 'totalMaintenance'],
    ];

    for (const [override, key] of checks) {
      const updated = calculateRentVsBuy(makeBaseInput(override));
      expect(Number(updated[key])).toBeGreaterThan(Number(base[key]));
      expect(updated.totalBuyUnrecoverable).toBeGreaterThan(base.totalBuyUnrecoverable);
      expect(updated.netWealthDiffNominal).toBeLessThan(base.netWealthDiffNominal);
    }
  });

  it('inflation indexes nominal running costs upward while discounting real net wealth', () => {
    const lowInf = calculateRentVsBuy(makeBaseInput({ inflationRatePct: 1.0 }));
    const highInf = calculateRentVsBuy(makeBaseInput({ inflationRatePct: 5.0 }));

    expect(highInf.totalCouncil).toBeGreaterThan(lowInf.totalCouncil);
    expect(highInf.totalWater).toBeGreaterThan(lowInf.totalWater);
    expect(highInf.totalHomeInsurance).toBeGreaterThan(lowInf.totalHomeInsurance);
    expect(highInf.totalStrata).toBeGreaterThan(lowInf.totalStrata);
    expect(highInf.buyerNetWealthReal).toBeLessThan(highInf.buyerNetWealthNominal);
    expect(highInf.renterNetWealthReal).toBeLessThan(highInf.renterNetWealthNominal);
  });

  it('higher mortgage rate increases total mortgage interest and improves renting relative position', () => {
    const lowRate = calculateRentVsBuy(makeBaseInput({ mortgageRatePct: 4.5 }));
    const highRate = calculateRentVsBuy(makeBaseInput({ mortgageRatePct: 8.0 }));

    expect(highRate.totalMortgageInterest).toBeGreaterThan(lowRate.totalMortgageInterest);
    expect(highRate.netWealthDiffNominal).toBeLessThan(lowRate.netWealthDiffNominal);
  });

  it('remains finite over a 25-year horizon with zero NaN or Infinity', () => {
    const res = calculateRentVsBuy(makeBaseInput({ horizonYears: 25 }));
    expect(Number.isFinite(res.buyerNetWealthNominal)).toBe(true);
    expect(Number.isFinite(res.renterNetWealthNominal)).toBe(true);
    expect(Number.isFinite(res.buyerNetWealthReal)).toBe(true);
    expect(Number.isFinite(res.renterNetWealthReal)).toBe(true);
    for (const pt of res.yearlySeries) {
      expect(Number.isFinite(pt.buyerNetWealthNominal)).toBe(true);
      expect(Number.isFinite(pt.renterNetWealthNominal)).toBe(true);
    }
  });
});
