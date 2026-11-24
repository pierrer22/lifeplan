import { describe, expect, it } from 'vitest';
import type { MortgageApprovalInput } from '../../types/planner';
import { evaluateMortgageApproval } from '../mortgageApproval';

function makeBaseInput(overrides: Partial<MortgageApprovalInput> = {}): MortgageApprovalInput {
  return {
    financialYear: '2026-27',
    state: 'NSW',
    cityLabel: 'Sydney',
    relationshipStatus: 'couple',
    dependents: 0,
    employmentStatus: 'full_time',
    grossSalary: 120000,
    partnerGrossSalary: 100000,
    bonusOrOtherIncomeAnnual: 0,
    hasPrivateHospitalCover: true,
    hecsBalance: 0,
    monthlyLivingExpenses: 3200,
    creditCardLimitsTotal: 0,
    existingMonthlyDebtRepayments: 0,
    novatedLeaseAnnualPreTax: 0,
    propertyPrice: 800000,
    depositAmount: 160000,
    isFirstHomeBuyer: true,
    isNewHome: false,
    interestRatePct: 6.0,
    apraBufferPct: 3.0,
    loanTermYears: 30,
    creditScoreBand: 'excellent',
    ...overrides,
  };
}

describe('evaluateMortgageApproval', () => {
  it('approves strong dual-income borrower with clean LVR, DTI, and serviceability', () => {
    const res = evaluateMortgageApproval(makeBaseInput());

    expect(res.verdict).toBe('Likely Approved');
    expect(res.approvalScore).toBeGreaterThanOrEqual(75);
    expect(res.gates.every((g) => g.status === 'pass')).toBe(true);
    expect(res.requestedLoanAmount).toBe(640000);
    expect(res.maxBorrowingPower).toBeGreaterThan(640000);
    expect(res.lvrPct).toBe(80);
    expect(res.lmiEstimate).toBe(0);
  });

  it('applies 3.8%/mo credit card limit shading and quantifies lost borrowing power', () => {
    const noCards = evaluateMortgageApproval(
      makeBaseInput({ relationshipStatus: 'single', partnerGrossSalary: 0, grossSalary: 130000, propertyPrice: 650000, depositAmount: 130000 }),
    );
    const withCards = evaluateMortgageApproval(
      makeBaseInput({
        relationshipStatus: 'single',
        partnerGrossSalary: 0,
        grossSalary: 130000,
        propertyPrice: 650000,
        depositAmount: 130000,
        creditCardLimitsTotal: 20000,
      }),
    );

    expect(withCards.creditCardMonthlyAssessment).toBeCloseTo(760, 0);
    expect(noCards.maxBorrowingPower - withCards.maxBorrowingPower).toBeGreaterThan(60000);
    expect(withCards.borrowingLostToCards).toBeGreaterThan(60000);
    expect(withCards.unlockActions.some((a) => a.toLowerCase().includes('credit card'))).toBe(true);
  });

  it('reduces borrowing power when borrower has active HECS-HELP balance', () => {
    const noHecs = evaluateMortgageApproval(
      makeBaseInput({ relationshipStatus: 'single', partnerGrossSalary: 0, grossSalary: 120000, hecsBalance: 0 }),
    );
    const withHecs = evaluateMortgageApproval(
      makeBaseInput({ relationshipStatus: 'single', partnerGrossSalary: 0, grossSalary: 120000, hecsBalance: 45000 }),
    );

    expect(withHecs.hecsMonthlyImpact).toBeGreaterThan(0);
    expect(withHecs.borrowingLostToHecs).toBeGreaterThan(40000);
    expect(withHecs.maxBorrowingPower).toBeLessThan(noHecs.maxBorrowingPower);
  });

  it('handles 95% FHB HGS eligibility vs >95% LVR hard fail', () => {
    const hgs = evaluateMortgageApproval(
      makeBaseInput({ propertyPrice: 750000, depositAmount: 37500, isFirstHomeBuyer: true }),
    );
    expect(hgs.lvrPct).toBe(95);
    expect(hgs.hgsEligible).toBe(true);
    expect(hgs.lmiEstimate).toBe(0);
    expect(hgs.gates.find((g) => g.id === 'lvr')?.status).toBe('pass');

    const over95 = evaluateMortgageApproval(
      makeBaseInput({ propertyPrice: 750000, depositAmount: 20000, isFirstHomeBuyer: true }),
    );
    expect(over95.lvrPct).toBeGreaterThan(95);
    expect(over95.gates.find((g) => g.id === 'lvr')?.status).toBe('fail');
    expect(over95.verdict).toBe('Unlikely / Declined');
  });

  it('flags DTI above 7.0x as fail', () => {
    const res = evaluateMortgageApproval(
      makeBaseInput({
        relationshipStatus: 'single',
        partnerGrossSalary: 0,
        grossSalary: 100000,
        propertyPrice: 950000,
        depositAmount: 190000,
      }),
    );

    expect(res.dtiRatio).toBeGreaterThan(7.0);
    expect(res.gates.find((g) => g.id === 'dti')?.status).toBe('fail');
    expect(res.verdict).toBe('Unlikely / Declined');
  });

  it('enforces HEM living expense floor when declared expenses are below benchmark', () => {
    const single = evaluateMortgageApproval(
      makeBaseInput({ relationshipStatus: 'single', partnerGrossSalary: 0, dependents: 0, monthlyLivingExpenses: 500 }),
    );
    expect(single.hemFloorMonthly).toBe(1900);
    expect(single.assessedLivingMonthly).toBe(1900);

    const coupleWithChild = evaluateMortgageApproval(
      makeBaseInput({ relationshipStatus: 'couple', dependents: 1, monthlyLivingExpenses: 1200 }),
    );
    expect(coupleWithChild.hemFloorMonthly).toBe(3300);
    expect(coupleWithChild.assessedLivingMonthly).toBe(3300);
  });

  it('produces monotonically increasing repayments across the rate stress series', () => {
    const res = evaluateMortgageApproval(makeBaseInput());
    expect(res.rateStressSeries.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < res.rateStressSeries.length; i++) {
      expect(res.rateStressSeries[i].ratePct).toBeGreaterThan(
        res.rateStressSeries[i - 1].ratePct,
      );
      expect(res.rateStressSeries[i].monthlyRepayment).toBeGreaterThan(
        res.rateStressSeries[i - 1].monthlyRepayment,
      );
    }
    expect(res.rateStressSeries.some((p) => p.isAssessmentRate)).toBe(true);
  });
});
