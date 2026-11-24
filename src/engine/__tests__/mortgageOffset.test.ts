import { describe, expect, it } from 'vitest';
import { calculateMortgageOffset } from '../mortgageOffset';

describe('calculateMortgageOffset', () => {
  it('returns zero savings and identical balances when offset cash and contributions are 0', () => {
    const res = calculateMortgageOffset({
      loanAmount: 600000,
      annualRatePct: 6.0,
      loanTermYears: 30,
      initialOffsetBalance: 0,
      monthlyOffsetContribution: 0,
      marginalTaxRateWithMedicarePct: 32,
      hisaRatePct: 5.0,
    });

    expect(res.grossInterestSaved).toBe(0);
    expect(res.monthsSavedPayoff).toBe(0);
    expect(res.offsetTotalInterest).toBe(res.baselineTotalInterest);
    expect(res.monthsToFullOffset).toBeNull();
    // 6.0 / (1 - 0.32) = 8.82% pre-tax HISA; 3% + 2.8% + (6.0 - 2.04 - 2.8)/0.68 = 7.51% pre-tax ETF
    expect(res.taxFreeEquivalentHisaRatePct).toBeCloseTo(8.82, 2);
    expect(res.taxFreeEquivalentEtfRatePct).toBeCloseTo(7.51, 2);
  });

  it('saves substantial interest, shortens payoff term, and beats after-tax HISA with $25k + $500/mo offset', () => {
    const res = calculateMortgageOffset({
      loanAmount: 640000,
      annualRatePct: 6.1,
      loanTermYears: 30,
      initialOffsetBalance: 25000,
      monthlyOffsetContribution: 500,
      annualOffsetFee: 0,
      marginalTaxRateWithMedicarePct: 32,
      hisaRatePct: 5.0,
    });

    expect(res.grossInterestSaved).toBeGreaterThan(150000);
    expect(res.monthsSavedPayoff).toBeGreaterThan(60);
    expect(res.monthsToFullOffset).not.toBeNull();
    expect(res.yearOneInterestSaved).toBeGreaterThan(res.yearOneHisaAfterTaxInterest);
    expect(res.yearOneNetAdvantageVsHisa).toBeGreaterThan(0);
  });

  it('caps offset benefit at loan balance so excess cash never generates negative interest', () => {
    const res = calculateMortgageOffset({
      loanAmount: 200000,
      annualRatePct: 6.0,
      loanTermYears: 30,
      initialOffsetBalance: 350000,
      monthlyOffsetContribution: 0,
      marginalTaxRateWithMedicarePct: 32,
    });

    expect(res.offsetTotalInterest).toBe(0);
    expect(res.grossInterestSaved).toBe(res.baselineTotalInterest);
    expect(res.monthsToFullOffset).toBe(0);
  });

  it('subtracts annual package fees accurately and calculates break-even offset balance', () => {
    const res = calculateMortgageOffset({
      loanAmount: 500000,
      annualRatePct: 6.0,
      loanTermYears: 30,
      initialOffsetBalance: 20000,
      monthlyOffsetContribution: 0,
      annualOffsetFee: 395,
      marginalTaxRateWithMedicarePct: 32,
    });

    // $395 / 0.06 = $6,583
    expect(res.breakEvenOffsetBalanceForFee).toBe(6583);
    expect(res.totalOffsetFeesPaid).toBeGreaterThan(0);
    expect(res.netInterestSavedAfterFees).toBe(
      res.grossInterestSaved - res.totalOffsetFeesPaid,
    );
  });
});
