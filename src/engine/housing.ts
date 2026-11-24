import {
  CITY_MARKET_BENCHMARKS,
  HGS_PRICE_CAPS,
  STATE_FHB_RULES,
  STATE_STAMP_DUTY_BRACKETS,
} from '../data/auConstants';
import type {
  AuState,
  DepositScenarioComparison,
  DepositStrategy,
  FinancialYear,
  HouseDepositInput,
  HouseDepositSummary,
  HouseDepositTimelinePoint,
  RentBudgetBreakdownItem,
  RentBudgetInput,
  RentBudgetSummary,
  RentVsBuyComparison,
} from '../types/planner';
import { calculateTax } from './tax';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Computes standard (non-concessional) stamp duty for a given property price and state.
 */
export function calculateStandardStampDuty(price: number, state: AuState): number {
  const dutiableValue = Math.max(0, price);
  if (dutiableValue <= 0) {
    return 0;
  }
  const brackets = STATE_STAMP_DUTY_BRACKETS[state];
  for (const bracket of brackets) {
    const ceiling = bracket.max ?? Number.POSITIVE_INFINITY;
    if (dutiableValue <= ceiling) {
      // Flat rate applied to total value (used in VIC $960k-$2M, ACT >$1.455M, and NT)
      if (bracket.min > 0 && bracket.over === 0) {
        return Math.round((dutiableValue / 100) * bracket.ratePer100);
      }
      return Math.round(
        bracket.baseDuty + ((dutiableValue - bracket.over) / 100) * bracket.ratePer100,
      );
    }
  }
  return 0;
}

/**
 * Computes state stamp duty after 2026 First Home Buyer exemptions and tapered concessions.
 */
export function calculateStampDuty(
  price: number,
  state: AuState,
  isFirstHomeBuyer: boolean,
  isNewHome: boolean,
): number {
  const dutiableValue = Math.max(0, price);
  if (dutiableValue <= 0) {
    return 0;
  }

  const standardDuty = calculateStandardStampDuty(dutiableValue, state);
  if (!isFirstHomeBuyer) {
    return standardDuty;
  }

  const rule = STATE_FHB_RULES[state];
  if (isNewHome) {
    if (rule.exemptCapNewHome === null) {
      return 0;
    }
    if (dutiableValue <= rule.exemptCapNewHome) {
      return 0;
    }
    if (dutiableValue < rule.concessionUpperCapEstablished) {
      const ratio =
        (dutiableValue - rule.exemptCapNewHome) /
        (rule.concessionUpperCapEstablished - rule.exemptCapNewHome);
      return Math.round(standardDuty * ratio);
    }
    return standardDuty;
  }

  if (rule.exemptCapEstablished <= 0) {
    return standardDuty;
  }
  if (dutiableValue <= rule.exemptCapEstablished) {
    return 0;
  }
  if (dutiableValue < rule.concessionUpperCapEstablished) {
    const ratio =
      (dutiableValue - rule.exemptCapEstablished) /
      (rule.concessionUpperCapEstablished - rule.exemptCapEstablished);
    return Math.round(standardDuty * ratio);
  }
  return standardDuty;
}

function getHgsCapForCity(state: AuState, cityLabel: string): number {
  const caps = HGS_PRICE_CAPS[state];
  const lower = cityLabel.toLowerCase();
  const isMetro =
    lower.includes(caps.metroLabel.toLowerCase()) ||
    caps.metroCap === caps.regionalCap;
  return isMetro ? caps.metroCap : caps.regionalCap;
}

function getFhogAmount(
  state: AuState,
  propertyPrice: number,
  isFirstHomeBuyer: boolean,
  isNewHome: boolean,
): number {
  if (!isFirstHomeBuyer || !isNewHome || propertyPrice <= 0) {
    return 0;
  }
  const rule = STATE_FHB_RULES[state];
  if (rule.fhogNewHomeCap === null || propertyPrice <= rule.fhogNewHomeCap) {
    return rule.fhogNewHomeGrant;
  }
  return 0;
}

function computeMonthlyMortgageRepayment(loanAmount: number, annualRatePct: number): number {
  if (loanAmount <= 0) {
    return 0;
  }
  const monthlyRate = Math.max(0, annualRatePct) / 100 / 12;
  const totalMonths = 360;
  if (monthlyRate === 0) {
    return round2(loanAmount / totalMonths);
  }
  return round2(
    (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) /
      (Math.pow(1 + monthlyRate, totalMonths) - 1),
  );
}

function estimateLmi(
  strategy: DepositStrategy,
  loanAmount: number,
  hgsEligible: boolean,
): number {
  if (loanAmount <= 0 || strategy === '20_no_lmi') {
    return 0;
  }
  if (strategy === '5_hgs') {
    return hgsEligible ? 0 : Math.round(loanAmount * 0.038);
  }
  return Math.round(loanAmount * 0.022);
}

function estimateYearsToReachTarget(
  startingLiquid: number,
  targetAmount: number,
  annualSavingsCapacity: number,
  investmentReturnPct: number,
): number {
  if (startingLiquid >= targetAmount) {
    return 0;
  }
  const monthlyReturn = Math.pow(1 + Math.max(0, investmentReturnPct) / 100, 1 / 12) - 1;
  const monthlyContribution = annualSavingsCapacity / 12;
  if (monthlyContribution <= 0 && monthlyReturn <= 0) {
    return 99;
  }

  let balance = startingLiquid;
  const maxMonths = 360;
  for (let m = 1; m <= maxMonths; m++) {
    balance = balance * (1 + monthlyReturn) + monthlyContribution;
    if (balance >= targetAmount) {
      return round2(m / 12);
    }
  }
  return 99;
}

function estimateHouseholdNetMonthlyIncome(
  householdGrossIncome: number,
  isCouple: boolean,
  fy: FinancialYear = '2026-27',
  hecsBalance = 0,
): number {
  if (householdGrossIncome <= 0) {
    return 0;
  }
  if (!isCouple) {
    return calculateTax({
      financialYear: fy,
      grossSalary: householdGrossIncome,
      hasPrivateHospitalCover: true,
      hecsBalance,
    }).netMonthlyIncome;
  }
  const primary = calculateTax({
    financialYear: fy,
    grossSalary: householdGrossIncome * 0.55,
    relationshipStatus: 'couple',
    partnerGrossSalary: householdGrossIncome * 0.45,
    hasPrivateHospitalCover: true,
    hecsBalance: hecsBalance * 0.5,
  }).netMonthlyIncome;
  const partner = calculateTax({
    financialYear: fy,
    grossSalary: householdGrossIncome * 0.45,
    relationshipStatus: 'couple',
    partnerGrossSalary: householdGrossIncome * 0.55,
    hasPrivateHospitalCover: true,
    hecsBalance: hecsBalance * 0.5,
  }).netMonthlyIncome;
  return round2(primary + partner);
}

/**
 * Estimates maximum borrowing power under APRA's +3.0% serviceability buffer,
 * accounting for net after-tax/HECS income and monthly living expenses.
 */
export function calculateBorrowingPower(params: {
  grossSalary: number;
  partnerGrossSalary?: number;
  hecsBalance: number;
  partnerHecsBalance?: number;
  monthlyLivingExpenses: number;
  targetMortgageRatePct: number;
  hasPrivateHospitalCover?: boolean;
  financialYear?: FinancialYear;
}): number {
  const fy = params.financialYear ?? '2026-27';
  const hasCover = params.hasPrivateHospitalCover ?? true;
  const partnerGross = Math.max(0, params.partnerGrossSalary ?? 0);
  const isCouple = partnerGross > 0;

  const primaryTax = calculateTax({
    financialYear: fy,
    grossSalary: Math.max(0, params.grossSalary),
    partnerGrossSalary: partnerGross,
    relationshipStatus: isCouple ? 'couple' : 'single',
    hasPrivateHospitalCover: hasCover,
    hecsBalance: Math.max(0, params.hecsBalance),
  });

  const partnerNetMonthly = isCouple
    ? calculateTax({
        financialYear: fy,
        grossSalary: partnerGross,
        partnerGrossSalary: params.grossSalary,
        relationshipStatus: 'couple',
        hasPrivateHospitalCover: hasCover,
        hecsBalance: Math.max(0, params.partnerHecsBalance ?? 0),
      }).netMonthlyIncome
    : 0;

  const householdNetMonthly = primaryTax.netMonthlyIncome + partnerNetMonthly;
  const hemFloor = isCouple ? 2800 : 1850;
  const assessedLivingMonthly = Math.max(hemFloor, params.monthlyLivingExpenses);
  const maxMonthlyRepayment = Math.max(0, householdNetMonthly - assessedLivingMonthly);

  if (maxMonthlyRepayment <= 0) {
    return 0;
  }

  // APRA +3.0% serviceability buffer
  const stressedAnnualRate = Math.max(3, params.targetMortgageRatePct + 3.0);
  const r = stressedAnnualRate / 100 / 12;
  const n = 360;
  const maxLoan = maxMonthlyRepayment * ((1 - Math.pow(1 + r, -n)) / r);
  return Math.round(maxLoan);
}

export interface RequiredIncomeSolverInput {
  financialYear?: FinancialYear;
  state: AuState;
  cityLabel: string;
  propertyPrice: number;
  isFirstHomeBuyer: boolean;
  isNewHome: boolean;
  depositStrategy: DepositStrategy;
  targetHomeYears: number;
  targetMortgageRatePct: number;
  currentCashSavings: number;
  currentInvestments: number;
  investmentReturnPct: number;
  fhsssNetContribution: number;
  monthlyLivingExpenses: number;
  weeklyRent: number;
  hecsBalance: number;
  hasPrivateHospitalCover?: boolean;
}

export interface RequiredIncomeResult {
  requiredGrossIncome: number;
  incomeForServiceability: number;
  incomeForDepositTimeline: number;
  loanAmount: number;
  totalUpfrontCashRequired: number;
  converged: boolean;
}

/**
 * Binary-search solver finding the minimum gross annual income needed to BOTH:
 * 1) pass APRA +3% loan serviceability for the target property, and
 * 2) save the required upfront deposit within targetHomeYears.
 */
export function solveRequiredGrossIncome(input: RequiredIncomeSolverInput): RequiredIncomeResult {
  const fy = input.financialYear ?? '2026-27';
  const hasCover = input.hasPrivateHospitalCover ?? true;
  const stampDuty = calculateStampDuty(
    input.propertyPrice,
    input.state,
    input.isFirstHomeBuyer,
    input.isNewHome,
  );
  const hgsCap = getHgsCapForCity(input.state, input.cityLabel);
  const hgsEligible = input.isFirstHomeBuyer && input.propertyPrice <= hgsCap;
  const depositPct =
    input.depositStrategy === '5_hgs' ? 0.05 : input.depositStrategy === '10_lmi' ? 0.1 : 0.2;
  const depositRequired = input.propertyPrice * depositPct;
  const loanAmount = Math.max(0, input.propertyPrice - depositRequired);
  const lmi = estimateLmi(input.depositStrategy, loanAmount, hgsEligible);
  const fhog = getFhogAmount(
    input.state,
    input.propertyPrice,
    input.isFirstHomeBuyer,
    input.isNewHome,
  );
  const legalAndMisc = 3000;
  const totalUpfrontCashRequired = Math.max(
    0,
    depositRequired + stampDuty + lmi + legalAndMisc - fhog,
  );

  const startingLiquid =
    Math.max(0, input.currentCashSavings) +
    Math.max(0, input.currentInvestments) +
    Math.max(0, input.fhsssNetContribution);
  const annualExpenses =
    Math.max(0, input.monthlyLivingExpenses) * 12 + Math.max(0, input.weeklyRent) * 52;

  const canService = (gross: number): boolean =>
    calculateBorrowingPower({
      grossSalary: gross,
      hecsBalance: input.hecsBalance,
      monthlyLivingExpenses: input.monthlyLivingExpenses,
      targetMortgageRatePct: input.targetMortgageRatePct,
      hasPrivateHospitalCover: hasCover,
      financialYear: fy,
    }) >= loanAmount;

  const canSaveInTime = (gross: number): boolean => {
    const netAnnual = calculateTax({
      financialYear: fy,
      grossSalary: gross,
      hasPrivateHospitalCover: hasCover,
      hecsBalance: input.hecsBalance,
    }).netAnnualIncome;
    const annualSavings = netAnnual - annualExpenses;
    const years = estimateYearsToReachTarget(
      startingLiquid,
      totalUpfrontCashRequired,
      annualSavings,
      input.investmentReturnPct,
    );
    return years <= Math.max(0.5, input.targetHomeYears);
  };

  const binarySearchMin = (predicate: (g: number) => boolean): number => {
    let low = 20000;
    let high = 800000;
    if (!predicate(high)) {
      return high;
    }
    for (let i = 0; i < 50; i++) {
      const mid = (low + high) / 2;
      if (predicate(mid)) {
        high = mid;
      } else {
        low = mid;
      }
    }
    return Math.ceil(high);
  };

  const incomeForServiceability = loanAmount > 0 ? binarySearchMin(canService) : 0;
  const incomeForDepositTimeline =
    startingLiquid >= totalUpfrontCashRequired ? 0 : binarySearchMin(canSaveInTime);
  const requiredGrossIncome = Math.max(incomeForServiceability, incomeForDepositTimeline);

  return {
    requiredGrossIncome,
    incomeForServiceability,
    incomeForDepositTimeline,
    loanAmount: round2(loanAmount),
    totalUpfrontCashRequired: round2(totalUpfrontCashRequired),
    converged: requiredGrossIncome < 800000,
  };
}

/**
 * Generates a full house deposit plan comparing 5% HGS, 10% LMI, and 20% no-LMI strategies,
 * including 2026 state stamp duty concessions, FHOG, borrowing power, and monthly timeline.
 */
export function calculateHouseDepositPlan(input: HouseDepositInput): HouseDepositSummary {
  const propertyPrice = Math.max(0, input.propertyPrice);
  const stampDutyStandard = calculateStandardStampDuty(propertyPrice, input.state);
  const stampDutyWithConcession = calculateStampDuty(
    propertyPrice,
    input.state,
    input.isFirstHomeBuyer,
    input.isNewHome,
  );
  const stampDutySaved = round2(Math.max(0, stampDutyStandard - stampDutyWithConcession));
  const fhogGrantAmount = getFhogAmount(
    input.state,
    propertyPrice,
    input.isFirstHomeBuyer,
    input.isNewHome,
  );
  const legalAndMiscCosts = propertyPrice > 0 ? 3000 : 0;

  const hgsCapForCity = getHgsCapForCity(input.state, input.cityLabel);
  const hgsEligible = input.isFirstHomeBuyer && propertyPrice <= hgsCapForCity;
  const availableLiquidNow = round2(
    Math.max(0, input.currentCashSavings) + Math.max(0, input.currentInvestments),
  );
  const fhsssBoostApplied = round2(Math.max(0, input.fhsssNetContribution));
  const startingLiquidWithFhsss = availableLiquidNow + fhsssBoostApplied;

  const strategies: Array<{ strategy: DepositStrategy; label: string; pct: number }> = [
    { strategy: '5_hgs', label: '5% Deposit (HGS — $0 LMI)', pct: 5 },
    { strategy: '10_lmi', label: '10% Deposit (with LMI)', pct: 10 },
    { strategy: '20_no_lmi', label: '20% Deposit ($0 LMI)', pct: 20 },
  ];

  const strategyComparisons: DepositScenarioComparison[] = strategies.map((s) => {
    const depositAmount = round2(propertyPrice * (s.pct / 100));
    const loanAmount = round2(Math.max(0, propertyPrice - depositAmount));
    const lmiEstimate = estimateLmi(s.strategy, loanAmount, hgsEligible);
    const totalUpfrontCashRequired = round2(
      Math.max(
        0,
        depositAmount +
          stampDutyWithConcession +
          lmiEstimate +
          legalAndMiscCosts -
          fhogGrantAmount,
      ),
    );
    const monthlyMortgageRepayment = computeMonthlyMortgageRepayment(
      loanAmount,
      input.targetMortgageRatePct,
    );
    const yearsToReachTarget = estimateYearsToReachTarget(
      startingLiquidWithFhsss,
      totalUpfrontCashRequired,
      input.annualSavingsCapacity,
      input.investmentReturnPct,
    );

    return {
      strategy: s.strategy,
      label: s.label,
      depositPct: s.pct,
      depositAmount,
      lmiEstimate,
      stampDuty: stampDutyWithConcession,
      totalUpfrontCashRequired,
      loanAmount,
      monthlyMortgageRepayment,
      yearsToReachTarget,
      hgsEligible: s.strategy === '5_hgs' ? hgsEligible : false,
    };
  });

  const selected =
    strategyComparisons.find((c) => c.strategy === input.depositStrategy) ??
    strategyComparisons[0];

  const lvrPct = propertyPrice > 0 ? round2((selected.loanAmount / propertyPrice) * 100) : 0;
  const fortnightlyMortgageRepayment = round2((selected.monthlyMortgageRepayment * 12) / 26);

  const netMonthlyIncome = estimateHouseholdNetMonthlyIncome(
    input.householdGrossIncome,
    input.isCouple,
  );
  const mortgageStressPctOfNetIncome =
    netMonthlyIncome > 0
      ? round2((selected.monthlyMortgageRepayment / netMonthlyIncome) * 100)
      : 0;

  const fundingGapNow = round2(
    Math.max(0, selected.totalUpfrontCashRequired - startingLiquidWithFhsss),
  );
  const estimatedYearsToReady = selected.yearsToReachTarget;
  const onTrackForTargetYears = estimatedYearsToReady <= input.targetHomeYears;

  const chartHorizonYears = Math.max(
    input.targetHomeYears + 1,
    Math.min(10, Math.ceil(estimatedYearsToReady === 99 ? 6 : estimatedYearsToReady) + 1),
  );
  const rAnnual = Math.max(0, input.investmentReturnPct) / 100;
  const timelineSeries: HouseDepositTimelinePoint[] = [];
  let proj = startingLiquidWithFhsss;

  for (let year = 0; year <= chartHorizonYears; year++) {
    timelineSeries.push({
      year,
      projectedSavings: round2(proj),
      targetUpfrontRequired: selected.totalUpfrontCashRequired,
    });
    proj = proj * (1 + rAnnual) + input.annualSavingsCapacity;
  }

  const maxBorrowing = calculateBorrowingPower({
    grossSalary: input.isCouple ? input.householdGrossIncome * 0.55 : input.householdGrossIncome,
    partnerGrossSalary: input.isCouple ? input.householdGrossIncome * 0.45 : 0,
    hecsBalance: 0,
    monthlyLivingExpenses: 2200,
    targetMortgageRatePct: input.targetMortgageRatePct,
  });

  const notes: string[] = [];
  if (input.isFirstHomeBuyer && stampDutySaved > 0) {
    notes.push(
      `${input.state} FHB concession (${STATE_FHB_RULES[input.state].schemeName}) saves $${Math.round(stampDutySaved).toLocaleString()} in stamp duty.`,
    );
  }
  if (input.depositStrategy === '5_hgs' && !hgsEligible) {
    notes.push(
      `Property exceeds the ${input.state} HGS price cap ($${hgsCapForCity.toLocaleString()}) or buyer is not FHB, so LMI applies at 95% LVR.`,
    );
  }
  if (selected.loanAmount > maxBorrowing && input.householdGrossIncome > 0) {
    notes.push(
      `At APRA +3.0% serviceability buffer, estimated max borrowing is ~$${maxBorrowing.toLocaleString()} vs $${Math.round(selected.loanAmount).toLocaleString()} needed.`,
    );
  }
  if (mortgageStressPctOfNetIncome > 30) {
    notes.push(
      `Estimated repayments take ${mortgageStressPctOfNetIncome.toFixed(1)}% of net household income (above the 30% housing stress benchmark).`,
    );
  }

  return {
    state: input.state,
    propertyPrice,
    depositStrategy: input.depositStrategy,
    depositPct: selected.depositPct,
    depositRequired: selected.depositAmount,
    stampDutyStandard,
    stampDutyWithConcession,
    stampDutySaved,
    fhogGrantAmount,
    lmiEstimate: selected.lmiEstimate,
    legalAndMiscCosts,
    totalUpfrontCashRequired: selected.totalUpfrontCashRequired,
    loanAmount: selected.loanAmount,
    lvrPct,
    monthlyMortgageRepayment: selected.monthlyMortgageRepayment,
    fortnightlyMortgageRepayment,
    mortgageStressPctOfNetIncome,
    hgsCapForCity,
    hgsEligible,
    availableLiquidNow,
    fhsssBoostApplied,
    fundingGapNow,
    estimatedYearsToReady,
    onTrackForTargetYears,
    strategyComparisons,
    timelineSeries,
    notes,
  };
}

export interface RentSensitivityPoint {
  weeklyRent: number;
  monthlyRent: number;
  monthlySurplus: number;
  rentToNetIncomePct: number;
  yearsToTargetDeposit: number;
}

export interface RentOptimizationResult {
  maxSustainableWeeklyRent: number;
  maxRentAt30PctBenchmark: number;
  maxRentToHitDepositOnSchedule: number;
  sensitivityCurve: RentSensitivityPoint[];
}

/**
 * Computes max sustainable weekly rent (respecting both 30% housing stress benchmark and
 * target deposit timeline) plus a sensitivity curve across $250-$950/wk.
 */
export function optimizeRentBudget(params: {
  householdNetMonthlyIncome: number;
  monthlyLivingExpenses: number;
  currentLiquidAssets: number;
  investmentReturnPct: number;
  targetUpfrontCash: number;
  targetYears?: number;
}): RentOptimizationResult {
  const targetYears = Math.max(0.5, params.targetYears ?? 3);
  const maxRentAt30PctBenchmark = Math.max(
    0,
    Math.floor(((params.householdNetMonthlyIncome * 0.3) * 12) / 52),
  );

  let low = 0;
  let high = 2000;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    const monthlyRent = (mid * 52) / 12;
    const annualSavings =
      (params.householdNetMonthlyIncome - params.monthlyLivingExpenses - monthlyRent) * 12;
    const years = estimateYearsToReachTarget(
      params.currentLiquidAssets,
      params.targetUpfrontCash,
      annualSavings,
      params.investmentReturnPct,
    );
    if (years <= targetYears) {
      low = mid;
    } else {
      high = mid;
    }
  }
  const maxRentToHitDepositOnSchedule = Math.max(0, Math.floor(low));
  const maxSustainableWeeklyRent = Math.min(
    maxRentAt30PctBenchmark,
    maxRentToHitDepositOnSchedule,
  );

  const sensitivityCurve: RentSensitivityPoint[] = [];
  for (let weeklyRent = 250; weeklyRent <= 950; weeklyRent += 100) {
    const monthlyRent = round2((weeklyRent * 52) / 12);
    const monthlySurplus = round2(
      params.householdNetMonthlyIncome - params.monthlyLivingExpenses - monthlyRent,
    );
    const rentToNetIncomePct =
      params.householdNetMonthlyIncome > 0
        ? round2((monthlyRent / params.householdNetMonthlyIncome) * 100)
        : 0;
    const yearsToTargetDeposit = estimateYearsToReachTarget(
      params.currentLiquidAssets,
      params.targetUpfrontCash,
      monthlySurplus * 12,
      params.investmentReturnPct,
    );
    sensitivityCurve.push({
      weeklyRent,
      monthlyRent,
      monthlySurplus,
      rentToNetIncomePct,
      yearsToTargetDeposit,
    });
  }

  return {
    maxSustainableWeeklyRent,
    maxRentAt30PctBenchmark,
    maxRentToHitDepositOnSchedule,
    sensitivityCurve,
  };
}

/**
 * Evaluates current rent sustainability against the 30% housing stress benchmark,
 * monthly savings capacity, and capital-city rent-vs-buy benchmarks.
 */
export function calculateRentBudgetPlan(input: RentBudgetInput): RentBudgetSummary {
  const householdNetMonthlyIncome = round2(
    Math.max(0, input.netMonthlyIncome) + Math.max(0, input.partnerNetMonthlyIncome ?? 0),
  );
  const weeklyRent = Math.max(0, input.weeklyRent);
  const monthlyRent = round2((weeklyRent * 52) / 12);
  const annualRent = round2(weeklyRent * 52);
  const monthlyLivingExpenses = round2(Math.max(0, input.monthlyLivingExpenses));
  const monthlyTotalOutgoings = round2(monthlyRent + monthlyLivingExpenses);
  const monthlySurplus = round2(householdNetMonthlyIncome - monthlyTotalOutgoings);
  const annualSavingsCapacity = round2(monthlySurplus * 12);

  const rentToNetIncomePct =
    householdNetMonthlyIncome > 0
      ? round2((monthlyRent / householdNetMonthlyIncome) * 100)
      : 0;
  const savingsRatePct =
    householdNetMonthlyIncome > 0
      ? round2((monthlySurplus / householdNetMonthlyIncome) * 100)
      : 0;

  const rentStressLevel: 'comfortable' | 'moderate' | 'stressed' =
    rentToNetIncomePct <= 25
      ? 'comfortable'
      : rentToNetIncomePct <= 30
        ? 'moderate'
        : 'stressed';

  const budgetBreakdown: RentBudgetBreakdownItem[] = [
    {
      category: 'Rent',
      monthlyAmount: monthlyRent,
      pctOfNet:
        householdNetMonthlyIncome > 0
          ? round2((monthlyRent / householdNetMonthlyIncome) * 100)
          : 0,
    },
    {
      category: 'Living Expenses',
      monthlyAmount: monthlyLivingExpenses,
      pctOfNet:
        householdNetMonthlyIncome > 0
          ? round2((monthlyLivingExpenses / householdNetMonthlyIncome) * 100)
          : 0,
    },
    {
      category: 'Savings / Surplus',
      monthlyAmount: round2(Math.max(0, monthlySurplus)),
      pctOfNet:
        householdNetMonthlyIncome > 0
          ? round2((Math.max(0, monthlySurplus) / householdNetMonthlyIncome) * 100)
          : 0,
    },
  ];

  const cityRentComparisons: RentVsBuyComparison[] = CITY_MARKET_BENCHMARKS.map((city) => ({
    city: city.city,
    medianUnitWeeklyRent: city.medianUnitWeeklyRent,
    medianHouseWeeklyRent: city.medianHouseWeeklyRent,
    annualRentCost: round2(city.medianUnitWeeklyRent * 52),
    estimatedMonthlyMortgageOnTarget: computeMonthlyMortgageRepayment(
      city.medianFhbUnitPrice * 0.8,
      6.1,
    ),
  }));

  const opt = optimizeRentBudget({
    householdNetMonthlyIncome,
    monthlyLivingExpenses,
    currentLiquidAssets: Math.max(0, input.currentLiquidAssets),
    investmentReturnPct: Math.max(0, input.investmentReturnPct),
    targetUpfrontCash: Math.max(0, input.targetUpfrontCash),
    targetYears: 3,
  });

  const notes: string[] = [];
  if (rentStressLevel === 'stressed') {
    notes.push(
      `Rent is ${rentToNetIncomePct.toFixed(1)}% of net income (above the 30% housing stress benchmark). Max rent at 30% is $${opt.maxRentAt30PctBenchmark}/wk.`,
    );
  } else {
    notes.push(
      `Rent is ${rentToNetIncomePct.toFixed(1)}% of net income (${rentStressLevel}); 30% benchmark cap is $${opt.maxRentAt30PctBenchmark}/wk.`,
    );
  }

  if (input.targetUpfrontCash > 0) {
    notes.push(
      `Max sustainable rent to hit your $${Math.round(input.targetUpfrontCash).toLocaleString()} deposit within 3 years while staying under 30% rent stress is $${opt.maxSustainableWeeklyRent}/wk.`,
    );
  }

  return {
    householdNetMonthlyIncome,
    monthlyRent,
    annualRent,
    monthlyLivingExpenses,
    monthlyTotalOutgoings,
    monthlySurplus,
    annualSavingsCapacity,
    rentToNetIncomePct,
    savingsRatePct,
    rentStressLevel,
    budgetBreakdown,
    cityRentComparisons,
    notes,
  };
}
