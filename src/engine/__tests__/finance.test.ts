import { describe, expect, it } from 'vitest';
import { calculateHecsRepayment, simulateHecsPayoff } from '../hecs';
import {
  calculateBorrowingPower,
  calculateHouseDepositPlan,
  calculateRentBudgetPlan,
  calculateStampDuty,
  optimizeRentBudget,
  solveRequiredGrossIncome,
} from '../housing';
import { calculateNovatedLease } from '../novatedLease';
import { calculateSuperAndFhsss } from '../super';
import { calculateTax, getMarginalTaxRate } from '../tax';

describe('Tax Engine (src/engine/tax.ts)', () => {
  it('returns exact marginal tax rates for FY2026-27 and FY2025-26', () => {
    expect(getMarginalTaxRate(18200, '2026-27')).toBe(0);
    expect(getMarginalTaxRate(18201, '2026-27')).toBe(0.15);
    expect(getMarginalTaxRate(45000, '2026-27')).toBe(0.15);
    expect(getMarginalTaxRate(45001, '2026-27')).toBe(0.3);
    expect(getMarginalTaxRate(135000, '2026-27')).toBe(0.3);
    expect(getMarginalTaxRate(135001, '2026-27')).toBe(0.37);
    expect(getMarginalTaxRate(190001, '2026-27')).toBe(0.45);

    expect(getMarginalTaxRate(30000, '2025-26')).toBe(0.16);
    expect(getMarginalTaxRate(100000, '2025-26')).toBe(0.3);
  });

  it('computes income tax, LITO, and Medicare levy with low-income shade-in', () => {
    const low = calculateTax({
      financialYear: '2026-27',
      grossSalary: 25000,
      hasPrivateHospitalCover: false,
      hecsBalance: 0,
    });
    // Raw tax = (25000 - 18200) * 0.15 = 1020; LITO = 700; incomeTax = 320
    expect(low.litoOffset).toBe(700);
    expect(low.incomeTax).toBe(320);
    expect(low.medicareLevy).toBe(0); // <= $27,222

    const shadeIn = calculateTax({
      financialYear: '2026-27',
      grossSalary: 30000,
      hasPrivateHospitalCover: false,
      hecsBalance: 0,
    });
    // (30000 - 27222) * 0.10 = 277.80
    expect(shadeIn.medicareLevy).toBeCloseTo(277.8, 2);

    const standard = calculateTax({
      financialYear: '2026-27',
      grossSalary: 95000,
      hasPrivateHospitalCover: true,
      hecsBalance: 0,
    });
    // 4020 + (95000 - 45000) * 0.30 = 19020; Medicare = 1900
    expect(standard.litoOffset).toBe(0);
    expect(standard.incomeTax).toBe(19020);
    expect(standard.medicareLevy).toBe(1900);
    expect(standard.netAnnualIncome).toBe(95000 - 19020 - 1900);
    expect(standard.netMonthlyIncome).toBeCloseTo(standard.netAnnualIncome / 12, 2);
    expect(standard.netFortnightlyIncome).toBeCloseTo(standard.netAnnualIncome / 26, 2);
  });

  it('applies MLS tiers for singles and couples/families with dependent child increment', () => {
    const singleNoCover = calculateTax({
      financialYear: '2026-27',
      grossSalary: 138000,
      hasPrivateHospitalCover: false,
      hecsBalance: 0,
    });
    // $138k is in $123,001 - $164,000 => 1.25%
    expect(singleNoCover.mlsRatePct).toBe(1.25);
    expect(singleNoCover.medicareLevySurcharge).toBe(1725);

    const singleWithCover = calculateTax({
      financialYear: '2026-27',
      grossSalary: 138000,
      hasPrivateHospitalCover: true,
      hecsBalance: 0,
    });
    expect(singleWithCover.mlsRatePct).toBe(0);
    expect(singleWithCover.medicareLevySurcharge).toBe(0);

    // Couple combined $205k is below $210k family threshold => 0% MLS
    const coupleUnder = calculateTax({
      financialYear: '2026-27',
      grossSalary: 110000,
      partnerGrossSalary: 95000,
      relationshipStatus: 'couple',
      dependents: 0,
      hasPrivateHospitalCover: false,
      hecsBalance: 0,
    });
    expect(coupleUnder.mlsRatePct).toBe(0);

    // Couple combined $212k with 3 dependents (+2 * $1,500 = $213,000 threshold) => 0% MLS
    const coupleWithChildren = calculateTax({
      financialYear: '2026-27',
      grossSalary: 112000,
      partnerGrossSalary: 100000,
      relationshipStatus: 'couple',
      dependents: 3,
      hasPrivateHospitalCover: false,
      hecsBalance: 0,
    });
    expect(coupleWithChildren.mlsRatePct).toBe(0);

    // Alerts Division 293 above $250k
    const highIncome = calculateTax({
      financialYear: '2026-27',
      grossSalary: 260000,
      hasPrivateHospitalCover: true,
      hecsBalance: 0,
    });
    expect(highIncome.alerts.some((a) => a.includes('293'))).toBe(true);
  });
});

describe('HECS-HELP Engine (src/engine/hecs.ts)', () => {
  it('matches exact ATO FY2026-27 and FY2025-26 marginal HECS repayments', () => {
    expect(calculateHecsRepayment(69528, '2026-27', 35000)).toBe(0);
    // $80,000 RI -> 0.15 * (80000 - 69528) = $1,570.80
    expect(calculateHecsRepayment(80000, '2026-27', 35000)).toBe(1570.8);
    // $140,000 RI -> 9028 + 0.17 * (140000 - 129717) = 9028 + 1748.11 = $10,776.11
    expect(calculateHecsRepayment(140000, '2026-27', 50000)).toBe(10776.11);
    // $200,000 RI -> 10% of total RI = $20,000
    expect(calculateHecsRepayment(200000, '2026-27', 50000)).toBe(20000);
    // Capped at remaining balance
    expect(calculateHecsRepayment(200000, '2026-27', 1200)).toBe(1200);

    // FY2025-26: $80k -> 0.15 * (80000 - 67000) = $1,950
    expect(calculateHecsRepayment(80000, '2025-26', 35000)).toBe(1950);
  });

  it('simulates multi-year payoff with indexation, RFBA/RESC add-backs, and voluntary extra savings', () => {
    const baseline = simulateHecsPayoff({
      financialYear: '2026-27',
      startingBalance: 35000,
      grossSalary: 85000,
      salaryGrowthPct: 3.5,
      indexationRatePct: 3.2,
      voluntaryExtraAnnual: 0,
      reportableFringeBenefits: 10000,
      reportableEmployerSuper: 5000,
    });
    expect(baseline.yearOneRepaymentIncome).toBe(100000);
    // 0.15 * (100000 - 69528) = 4570.80
    expect(baseline.yearOneCompulsoryRepayment).toBe(4570.8);
    expect(baseline.yearsToPayoff).not.toBeNull();

    const withExtra = simulateHecsPayoff({
      financialYear: '2026-27',
      startingBalance: 35000,
      grossSalary: 85000,
      salaryGrowthPct: 3.5,
      indexationRatePct: 3.2,
      voluntaryExtraAnnual: 3000,
      reportableFringeBenefits: 10000,
      reportableEmployerSuper: 5000,
    });
    expect(withExtra.yearsSavedWithExtra).toBeGreaterThan(0);
    expect(withExtra.indexationSavedWithExtra).toBeGreaterThan(0);
    expect(withExtra.totalInterestIndexationPaid).toBeLessThan(
      baseline.totalInterestIndexationPaid,
    );
  });

  it('accumulates future Masters study debt (1 unit/trimester x 3/yr + SSAF) without same-year indexation', () => {
    const result = simulateHecsPayoff({
      financialYear: '2026-27',
      startingBalance: 20000,
      grossSalary: 85000,
      salaryGrowthPct: 3.5,
      indexationRatePct: 3.2,
      voluntaryExtraAnnual: 0,
      futureStudy: {
        enabled: true,
        unitsPerTerm: 1,
        termsPerYear: 3,
        totalUnitsRemaining: 12,
        unitsPerEftsl: 8,
        annualFeePerEftsl: 9537,
        includeSsaf: true,
        ssafAnnualAmount: 280,
      },
    });

    // 3 units/yr / 8 * $9,537 = $3,576.38/yr (rounded per year) x 4 yrs = $14,305.52; SSAF 4 x $280 = $1,120
    expect(result.totalNewTuitionAdded).toBe(14305.52);
    expect(result.totalNewSsafAdded).toBe(1120);
    expect(result.totalNewStudyDebtAdded).toBe(15425.52);
    expect(result.studyCompletionYears).toBe(4);
    // ATO 11-month rule: Year 1 indexation applies only to $20,000 startingBalance ($640), not Year 1 new debt
    expect(result.yearOneIndexation).toBe(640);
    expect(result.projections[0].unitsCompletedThisYear).toBe(3);
    expect(result.projections[0].ssafAddedThisYear).toBe(280);
  });

  it('simulates future Masters debt when starting HECS balance is $0', () => {
    const result = simulateHecsPayoff({
      financialYear: '2026-27',
      startingBalance: 0,
      grossSalary: 85000,
      salaryGrowthPct: 3.5,
      indexationRatePct: 3.2,
      voluntaryExtraAnnual: 0,
      futureStudy: {
        enabled: true,
        unitsPerTerm: 1,
        termsPerYear: 3,
        totalUnitsRemaining: 12,
        unitsPerEftsl: 8,
        annualFeePerEftsl: 9537,
        includeSsaf: true,
        ssafAnnualAmount: 280,
      },
    });

    expect(result.projections.length).toBeGreaterThanOrEqual(4);
    expect(result.totalNewStudyDebtAdded).toBe(15425.52);
    expect(result.yearOneIndexation).toBe(0);
    expect(result.peakBalance).toBeGreaterThan(0);
    expect(result.yearsToPayoff).not.toBeNull();
    expect(result.yearsToPayoff!).toBeGreaterThanOrEqual(4);
  });

  it('never marks paid off while future study units remain despite high salary and small initial balance', () => {
    const result = simulateHecsPayoff({
      financialYear: '2026-27',
      startingBalance: 1000,
      grossSalary: 140000,
      salaryGrowthPct: 3.5,
      indexationRatePct: 3.2,
      voluntaryExtraAnnual: 0,
      futureStudy: {
        enabled: true,
        unitsPerTerm: 1,
        termsPerYear: 3,
        totalUnitsRemaining: 12,
        unitsPerEftsl: 8,
        annualFeePerEftsl: 9537,
        includeSsaf: true,
        ssafAnnualAmount: 280,
      },
    });

    expect(result.projections.length).toBeGreaterThanOrEqual(4);
    expect(result.yearsToPayoff).toBe(4);
    expect(result.baselineYearsToPayoff).toBe(4);
  });

  it('prorates partial final study year units and SSAF cleanly', () => {
    const result = simulateHecsPayoff({
      financialYear: '2026-27',
      startingBalance: 5000,
      grossSalary: 85000,
      salaryGrowthPct: 3.0,
      indexationRatePct: 3.0,
      voluntaryExtraAnnual: 0,
      futureStudy: {
        enabled: true,
        unitsPerTerm: 1,
        termsPerYear: 3,
        totalUnitsRemaining: 10,
        unitsPerEftsl: 8,
        annualFeePerEftsl: 8000,
        includeSsaf: true,
        ssafAnnualAmount: 280,
      },
    });

    // Years 1-3: 3 units ($3,000) + $280 SSAF; Year 4: 1 unit ($1,000) + $93.33 SSAF; Year 5+: 0
    expect(result.projections[0].unitsCompletedThisYear).toBe(3);
    expect(result.projections[0].ssafAddedThisYear).toBe(280);
    expect(result.projections[2].unitsCompletedThisYear).toBe(3);
    expect(result.projections[3].unitsCompletedThisYear).toBe(1);
    expect(result.projections[3].tuitionAddedThisYear).toBe(1000);
    expect(result.projections[3].ssafAddedThisYear).toBe(93.33);
    expect(result.projections[4].unitsCompletedThisYear).toBe(0);
    expect(result.projections[4].newDebtAdded).toBe(0);
  });

  it('adds a January 2027 Student Start-up Loan ($1,349) without same-year indexation', () => {
    const result = simulateHecsPayoff({
      financialYear: '2026-27',
      startingBalance: 20000,
      grossSalary: 85000,
      salaryGrowthPct: 3.5,
      indexationRatePct: 3.2,
      voluntaryExtraAnnual: 0,
      futureStudy: {
        enabled: true,
        unitsPerTerm: 1,
        termsPerYear: 3,
        totalUnitsRemaining: 12,
        unitsPerEftsl: 8,
        annualFeePerEftsl: 9537,
        includeSsaf: true,
        ssafAnnualAmount: 280,
        includeSsl: true,
        sslInstalments: 1,
        sslAmountPerInstalment: 1349,
      },
    });

    expect(result.totalNewSslAdded).toBe(1349);
    expect(result.projections[0].sslAddedThisYear).toBe(1349);
    expect(result.projections[1].sslAddedThisYear).toBe(0);
    expect(result.totalNewStudyDebtAdded).toBe(16774.52);
    expect(result.yearOneIndexation).toBe(640);
  });

  it('schedules multiple SSL lots (max 2/yr) even when totalUnitsRemaining is 0', () => {
    const result = simulateHecsPayoff({
      financialYear: '2026-27',
      startingBalance: 0,
      grossSalary: 60000,
      salaryGrowthPct: 3.0,
      indexationRatePct: 3.0,
      voluntaryExtraAnnual: 0,
      futureStudy: {
        enabled: true,
        unitsPerTerm: 1,
        termsPerYear: 3,
        totalUnitsRemaining: 0,
        unitsPerEftsl: 8,
        annualFeePerEftsl: 9537,
        includeSsaf: false,
        ssafAnnualAmount: 280,
        includeSsl: true,
        sslInstalments: 3,
        sslAmountPerInstalment: 1349,
      },
    });

    expect(result.projections[0].sslAddedThisYear).toBe(2698);
    expect(result.projections[1].sslAddedThisYear).toBe(1349);
    expect(result.projections[2].sslAddedThisYear).toBe(0);
    expect(result.totalNewSslAdded).toBe(4047);
    expect(result.totalNewStudyDebtAdded).toBe(4047);
  });
});

describe('Super & FHSSS Engine (src/engine/super.ts)', () => {
  it('computes SG, concessional cap headroom, carry-forward eligibility, and FHSSS boost', () => {
    const summary = calculateSuperAndFhsss({
      financialYear: '2026-27',
      age: 28,
      grossSalary: 100000,
      superRatePct: 12.0,
      currentSuperBalance: 45000,
      salarySacrificeAnnual: 15000,
      carryForwardUnusedCap: 20000,
      investmentReturnPct: 7.0,
      targetFhsssYears: 3,
      marginalTaxRateWithMedicare: 0.32,
    });

    expect(summary.employerSgAnnual).toBe(12000);
    expect(summary.totalConcessionalAnnual).toBe(27000);
    expect(summary.concessionalCap).toBe(32500);
    expect(summary.carryForwardAvailable).toBe(20000);
    expect(summary.remainingCapSpace).toBe(25500);
    expect(summary.excessConcessionalAmount).toBe(0);
    // $15,000 sacrifice in 30%+2% bracket saves $4,800 income tax+Medicare
    expect(summary.incomeTaxSavedThisYear).toBe(4800);
    expect(summary.takeHomePayReductionAnnual).toBe(10200);
    expect(summary.contributionsTax15Pct).toBe(4050);

    // FHSSS: 3 yrs * $15k = $45k eligible (85% = $38,250 + SIC earnings, exit tax 2%)
    expect(summary.fhsss.totalEligibleContributions).toBe(45000);
    expect(summary.fhsss.netContributionsAfter15PctTax).toBe(38250);
    expect(summary.fhsss.deemedEarningsSic).toBeGreaterThan(3000);
    expect(summary.fhsss.withdrawalTaxRatePct).toBe(2);
    expect(summary.fhsss.taxSavedVsCashSaving).toBeGreaterThan(5000);
    expect(summary.projectedBalanceAt60WithSacrifice).toBeGreaterThan(
      summary.projectedBalanceAt60Baseline,
    );
  });

  it('respects TSB >= $500k carry-forward block, 15.4% APS rate, and Div 293', () => {
    const highBalance = calculateSuperAndFhsss({
      financialYear: '2025-26',
      age: 45,
      grossSalary: 240000,
      superRatePct: 15.4,
      currentSuperBalance: 550000,
      salarySacrificeAnnual: 5000,
      carryForwardUnusedCap: 25000,
      investmentReturnPct: 7.0,
      targetFhsssYears: 1,
      marginalTaxRateWithMedicare: 0.47,
    });

    expect(highBalance.concessionalCap).toBe(30000);
    expect(highBalance.employerSgAnnual).toBe(36960);
    expect(highBalance.carryForwardAvailable).toBe(0);
    expect(highBalance.excessConcessionalAmount).toBe(11960);
    // Div 293 income = 240000 + 36960 = 276960 > 250000 -> Div 293 triggered
    expect(highBalance.div293Triggered).toBe(true);
    expect(highBalance.div293Tax).toBeCloseTo(26960 * 0.15, 2);
  });

  it('caps FHSSS eligible contributions at $50,000 lifetime across 5 years', () => {
    const capped = calculateSuperAndFhsss({
      financialYear: '2026-27',
      age: 26,
      grossSalary: 110000,
      superRatePct: 12.0,
      currentSuperBalance: 30000,
      salarySacrificeAnnual: 18000,
      carryForwardUnusedCap: 0,
      investmentReturnPct: 7.0,
      targetFhsssYears: 5,
      marginalTaxRateWithMedicare: 0.32,
    });
    expect(capped.fhsss.annualEligibleContribution).toBe(15000);
    expect(capped.fhsss.totalEligibleContributions).toBe(50000);
    expect(capped.fhsss.netContributionsAfter15PctTax).toBe(42500);
  });
});

describe('Housing & Rent Engine (src/engine/housing.ts)', () => {
  it('calculates exact 2026 state stamp duty & FHB concessions', () => {
    // ACT FHB $900k -> $0 duty (no cap from 1 July 2026)
    expect(calculateStampDuty(900000, 'ACT', true, false)).toBe(0);
    expect(calculateStampDuty(900000, 'ACT', false, false)).toBe(28604);

    // NSW FHBAS: <= $800k -> $0, $900k -> 50% tapered ($17,515), $1M -> standard ($39,530)
    expect(calculateStampDuty(800000, 'NSW', true, false)).toBe(0);
    expect(calculateStampDuty(900000, 'NSW', true, false)).toBe(17515);
    expect(calculateStampDuty(1000000, 'NSW', true, false)).toBe(39530);

    // VIC FHB: <= $600k -> $0, $675k -> 50% tapered, $750k+ -> standard
    expect(calculateStampDuty(600000, 'VIC', true, false)).toBe(0);
    const vic675Standard = calculateStampDuty(675000, 'VIC', false, false);
    expect(calculateStampDuty(675000, 'VIC', true, false)).toBe(
      Math.round(vic675Standard * 0.5),
    );
    expect(calculateStampDuty(1000000, 'VIC', false, false)).toBe(55000);

    // QLD FHB: new home $950k -> $0 (no cap); established $700k -> $0, $750k -> 50% tapered
    expect(calculateStampDuty(950000, 'QLD', true, true)).toBe(0);
    expect(calculateStampDuty(700000, 'QLD', true, false)).toBe(0);
    const qld750Standard = calculateStampDuty(750000, 'QLD', false, false);
    expect(calculateStampDuty(750000, 'QLD', true, false)).toBe(
      Math.round(qld750Standard * 0.5),
    );

    // WA / SA / TAS / NT FHB rules
    expect(calculateStampDuty(450000, 'WA', true, false)).toBe(0);
    expect(calculateStampDuty(700000, 'SA', true, true)).toBe(0);
    expect(calculateStampDuty(700000, 'SA', true, false)).toBeGreaterThan(0);
    expect(calculateStampDuty(750000, 'TAS', true, false)).toBe(0);
    expect(calculateStampDuty(600000, 'NT', true, true)).toBe(0);
    expect(calculateStampDuty(600000, 'NT', true, false)).toBe(29700);
  });

  it('compares 5% HGS, 10% LMI, and 20% deposit strategies accurately', () => {
    const plan = calculateHouseDepositPlan({
      state: 'NSW',
      cityLabel: 'Sydney',
      propertyPrice: 750000,
      isFirstHomeBuyer: true,
      isNewHome: false,
      depositStrategy: '5_hgs',
      targetHomeYears: 4,
      targetMortgageRatePct: 6.1,
      currentCashSavings: 25000,
      currentInvestments: 12000,
      investmentReturnPct: 7.0,
      annualSavingsCapacity: 24000,
      fhsssNetContribution: 12000,
      householdGrossIncome: 95000,
      isCouple: false,
    });

    expect(plan.stampDutyWithConcession).toBe(0);
    expect(plan.hgsEligible).toBe(true);
    expect(plan.lmiEstimate).toBe(0);
    expect(plan.depositRequired).toBe(37500);
    expect(plan.strategyComparisons).toHaveLength(3);
    expect(plan.strategyComparisons[1].lmiEstimate).toBeGreaterThan(0); // 10% LMI
    expect(plan.strategyComparisons[2].lmiEstimate).toBe(0); // 20% no LMI
    expect(plan.timelineSeries.length).toBeGreaterThanOrEqual(5);
  });

  it('models APRA +3% borrowing power with HECS impact and converges Required Gross Income solver', () => {
    const noHecs = calculateBorrowingPower({
      grossSalary: 110000,
      hecsBalance: 0,
      monthlyLivingExpenses: 2200,
      targetMortgageRatePct: 6.0,
    });
    const withHecs = calculateBorrowingPower({
      grossSalary: 110000,
      hecsBalance: 45000,
      monthlyLivingExpenses: 2200,
      targetMortgageRatePct: 6.0,
    });
    expect(noHecs).toBeGreaterThan(withHecs);

    const solved = solveRequiredGrossIncome({
      state: 'ACT',
      cityLabel: 'Canberra',
      propertyPrice: 700000,
      isFirstHomeBuyer: true,
      isNewHome: false,
      depositStrategy: '5_hgs',
      targetHomeYears: 4,
      targetMortgageRatePct: 6.1,
      currentCashSavings: 10000,
      currentInvestments: 40000,
      investmentReturnPct: 7.0,
      fhsssNetContribution: 15000,
      monthlyLivingExpenses: 1800,
      weeklyRent: 450,
      hecsBalance: 35000,
    });

    expect(solved.converged).toBe(true);
    expect(solved.requiredGrossIncome).toBeGreaterThan(80000);
    expect(solved.requiredGrossIncome).toBeLessThan(200000);

    // Verify solved gross income actually passes borrowing power check
    const maxAtSolved = calculateBorrowingPower({
      grossSalary: solved.requiredGrossIncome,
      hecsBalance: 35000,
      monthlyLivingExpenses: 1800,
      targetMortgageRatePct: 6.1,
    });
    expect(maxAtSolved).toBeGreaterThanOrEqual(solved.loanAmount);
  });

  it('calculates rent budget stress and optimizer sensitivity curve ($250-$950/wk)', () => {
    const rentPlan = calculateRentBudgetPlan({
      netMonthlyIncome: 6000,
      weeklyRent: 550,
      monthlyLivingExpenses: 2200,
      state: 'NSW',
      cityLabel: 'Sydney',
      currentLiquidAssets: 37000,
      investmentReturnPct: 7.0,
      targetUpfrontCash: 55000,
    });

    expect(rentPlan.rentStressLevel).toBe('stressed'); // 2383.33 / 6000 = 39.7% > 30%
    expect(rentPlan.cityRentComparisons.length).toBeGreaterThanOrEqual(5);

    const opt = optimizeRentBudget({
      householdNetMonthlyIncome: 6000,
      monthlyLivingExpenses: 2200,
      currentLiquidAssets: 37000,
      investmentReturnPct: 7.0,
      targetUpfrontCash: 55000,
      targetYears: 3,
    });
    // 30% of $6,000/mo = $1,800/mo = $415/wk
    expect(opt.maxRentAt30PctBenchmark).toBe(415);
    expect(opt.sensitivityCurve[0].weeklyRent).toBe(250);
    expect(opt.sensitivityCurve[opt.sensitivityCurve.length - 1].weeklyRent).toBe(950);
  });
});

describe('Novated Lease Engine (src/engine/novatedLease.ts)', () => {
  it('computes EV FBT exemption, RFBA HECS/MLS knock-on, GST cap, and residuals', () => {
    const evSummary = calculateNovatedLease({
      financialYear: '2026-27',
      grossSalary: 138000,
      hasPrivateHospitalCover: false,
      hecsBalance: 18000,
      lease: {
        enabled: true,
        vehiclePrice: 58000,
        isEv: true,
        leaseTermYears: 4,
        annualRunningCosts: 3400,
        financeRatePct: 8.2,
        annualKm: 15000,
      },
    });

    expect(evSummary.fbtExemptUnderCurrentRules).toBe(true);
    expect(evSummary.gstSavedOnPurchase).toBeCloseTo(58000 / 11, 2);
    expect(evSummary.residualPct).toBe(37.5);
    // RFBA = 58000 * 0.20 * 1.8868 = 21886.88
    expect(evSummary.rfbaAmount).toBe(21886.88);
    expect(evSummary.postTaxEcmContributionAnnual).toBe(0);
    expect(evSummary.incomeTaxAndMedicareSavedAnnual).toBeGreaterThan(4000);
    // RFBA exceeds pre-tax deduction, raising RI and HECS compulsory repayment
    expect(evSummary.hecsImpactAnnual).toBeGreaterThan(0);
    expect(evSummary.mlsImpactAnnual).toBeGreaterThan(0);
    expect(evSummary.netSavingsVsCashOverTerm).toBeGreaterThan(0);
  });

  it('caps GST credit at $6,334, flags >$75k EV April 2027 transition, and applies 20% ECM for ICE', () => {
    const expensiveEv = calculateNovatedLease({
      financialYear: '2026-27',
      grossSalary: 160000,
      hasPrivateHospitalCover: true,
      hecsBalance: 0,
      lease: {
        enabled: true,
        vehiclePrice: 85000,
        isEv: true,
        leaseTermYears: 1,
        annualRunningCosts: 3500,
        financeRatePct: 8.0,
        annualKm: 15000,
      },
    });
    expect(expensiveEv.gstSavedOnPurchase).toBe(6334);
    expect(expensiveEv.residualPct).toBe(65.63);
    expect(expensiveEv.postApril2027EvTransitionNote).toContain('1 April 2027');
    expect(expensiveEv.postApril2027EvTransitionNote).toContain('$75,000');

    const ice = calculateNovatedLease({
      financialYear: '2026-27',
      grossSalary: 120000,
      hasPrivateHospitalCover: true,
      hecsBalance: 0,
      lease: {
        enabled: true,
        vehiclePrice: 45000,
        isEv: false,
        leaseTermYears: 5,
        annualRunningCosts: 4800,
        financeRatePct: 8.5,
        annualKm: 15000,
      },
    });
    expect(ice.fbtExemptUnderCurrentRules).toBe(false);
    expect(ice.residualPct).toBe(28.13);
    expect(ice.postTaxEcmContributionAnnual).toBe(9000); // 20% of $45,000
    expect(ice.rfbaAmount).toBe(0);
  });
});
