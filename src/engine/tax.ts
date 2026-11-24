import {
  LITO_CONSTANTS,
  MEDICARE_LEVY_CONSTANTS,
  MLS_TIERS,
  RESIDENT_TAX_BRACKETS,
  SUPER_CONSTANTS,
} from '../data/auConstants';
import type {
  FinancialYear,
  TaxBracketBreakdownItem,
  TaxInput,
  TaxSummary,
} from '../types/planner';
import { calculateHecsRepayment } from './hecs';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Returns the resident marginal income tax rate (excluding 2% Medicare levy)
 * as a decimal (e.g., 0.30 for 30%) for the given taxable income and financial year.
 */
export function getMarginalTaxRate(taxableIncome: number, fy: FinancialYear): number {
  const income = Math.max(0, taxableIncome);
  const brackets = RESIDENT_TAX_BRACKETS[fy];
  for (const bracket of brackets) {
    if (income <= (bracket.max ?? Number.POSITIVE_INFINITY)) {
      return bracket.rate;
    }
  }
  return brackets[brackets.length - 1].rate;
}

/**
 * Computes Low Income Tax Offset (LITO), capped so it never goes negative.
 */
export function calculateLito(taxableIncome: number): number {
  const income = Math.max(0, taxableIncome);
  if (income <= LITO_CONSTANTS.fullThreshold) {
    return LITO_CONSTANTS.maxOffset;
  }
  if (income <= LITO_CONSTANTS.midThreshold) {
    return round2(
      Math.max(
        0,
        LITO_CONSTANTS.maxOffset -
          (income - LITO_CONSTANTS.fullThreshold) * LITO_CONSTANTS.firstTaperRate,
      ),
    );
  }
  if (income < LITO_CONSTANTS.zeroThreshold) {
    const atMid =
      LITO_CONSTANTS.maxOffset -
      (LITO_CONSTANTS.midThreshold - LITO_CONSTANTS.fullThreshold) *
        LITO_CONSTANTS.firstTaperRate;
    return round2(
      Math.max(
        0,
        atMid - (income - LITO_CONSTANTS.midThreshold) * LITO_CONSTANTS.secondTaperRate,
      ),
    );
  }
  return 0;
}

/**
 * Computes the Medicare Levy (2% standard, with low-income threshold and 10% shade-in).
 */
export function calculateMedicareLevy(taxableIncome: number): number {
  const income = Math.max(0, taxableIncome);
  if (income <= MEDICARE_LEVY_CONSTANTS.singleLowIncomeThreshold) {
    return 0;
  }
  if (income <= MEDICARE_LEVY_CONSTANTS.singleShadeInUpper) {
    return round2(
      (income - MEDICARE_LEVY_CONSTANTS.singleLowIncomeThreshold) *
        MEDICARE_LEVY_CONSTANTS.shadeInRate,
    );
  }
  return round2(income * MEDICARE_LEVY_CONSTANTS.standardRate);
}

/**
 * Computes Medicare Levy Surcharge rate (decimal) based on single vs family thresholds.
 */
export function getMlsRate(params: {
  financialYear: FinancialYear;
  familyMlsIncome: number;
  isFamily: boolean;
  dependents: number;
  hasPrivateHospitalCover: boolean;
}): number {
  if (params.hasPrivateHospitalCover || params.familyMlsIncome <= 0) {
    return 0;
  }
  const config = MLS_TIERS[params.financialYear];
  const tiers = params.isFamily ? config.families : config.singles;
  const extraChildAllowance =
    params.isFamily && params.dependents > 1
      ? (params.dependents - 1) * config.dependentChildIncrement
      : 0;

  for (const tier of tiers) {
    const adjustedMax =
      tier.max === null ? Number.POSITIVE_INFINITY : tier.max + extraChildAllowance;
    if (params.familyMlsIncome <= adjustedMax) {
      return tier.rate;
    }
  }
  return tiers[tiers.length - 1].rate;
}

/**
 * Computes full Australian resident tax, LITO, Medicare levy, MLS, HECS-HELP repayment,
 * marginal/effective rates, and take-home pay breakdown.
 */
export function calculateTax(input: TaxInput): TaxSummary {
  const fy = input.financialYear;
  const grossIncome = Math.max(0, input.grossSalary);
  const salarySacrificeSuper = Math.max(0, input.salarySacrificeSuper ?? 0);
  const preTaxDeductions = Math.max(0, input.preTaxDeductions ?? 0);
  const taxableIncome = Math.max(0, grossIncome - salarySacrificeSuper - preTaxDeductions);

  const rfba = Math.max(0, input.reportableFringeBenefits ?? 0);
  const resc = Math.max(0, input.reportableEmployerSuper ?? salarySacrificeSuper);
  const netInvestmentLosses = Math.max(0, input.netInvestmentLosses ?? 0);

  const repaymentIncome = round2(taxableIncome + rfba + resc + netInvestmentLosses);
  const mlsIncome = repaymentIncome;

  const brackets = RESIDENT_TAX_BRACKETS[fy];
  const bracketBreakdown: TaxBracketBreakdownItem[] = [];
  let rawIncomeTax = 0;

  for (const bracket of brackets) {
    const ceiling = bracket.max ?? Number.POSITIVE_INFINITY;
    const taxableInBracket = round2(Math.max(0, Math.min(taxableIncome, ceiling) - bracket.over));
    const taxPaid = round2(taxableInBracket * bracket.rate);
    rawIncomeTax += taxPaid;
    bracketBreakdown.push({
      label: bracket.label,
      min: bracket.min,
      max: bracket.max,
      rate: bracket.rate,
      taxableInBracket,
      taxPaid,
    });
  }

  const rawLito = taxableIncome > 0 ? calculateLito(taxableIncome) : 0;
  const litoOffset = round2(Math.min(rawIncomeTax, rawLito));
  const incomeTax = round2(Math.max(0, rawIncomeTax - litoOffset));

  const medicareLevy = calculateMedicareLevy(taxableIncome);

  const partnerGross = Math.max(0, input.partnerGrossSalary ?? 0);
  const dependents = Math.max(0, input.dependents ?? 0);
  const isFamily =
    input.relationshipStatus === 'couple' || partnerGross > 0 || dependents > 0;
  const familyMlsIncome = mlsIncome + (isFamily ? partnerGross : 0);

  const mlsRate = getMlsRate({
    financialYear: fy,
    familyMlsIncome,
    isFamily,
    dependents,
    hasPrivateHospitalCover: input.hasPrivateHospitalCover,
  });
  const mlsRatePct = round2(mlsRate * 100);
  // MLS applies to taxable income + reportable fringe benefits
  const medicareLevySurcharge =
    mlsRate > 0 ? round2(Math.max(0, taxableIncome + rfba) * mlsRate) : 0;

  const hecsCompulsoryRepayment = calculateHecsRepayment(
    repaymentIncome,
    fy,
    Math.max(0, input.hecsBalance),
  );

  const totalTaxAndHecs = round2(
    incomeTax + medicareLevy + medicareLevySurcharge + hecsCompulsoryRepayment,
  );
  const netAnnualIncome = round2(Math.max(0, taxableIncome - totalTaxAndHecs));
  const netMonthlyIncome = round2(netAnnualIncome / 12);
  const netFortnightlyIncome = round2(netAnnualIncome / 26);

  const marginalTaxRate = getMarginalTaxRate(taxableIncome, fy);
  const marginalMedicareRate =
    taxableIncome <= MEDICARE_LEVY_CONSTANTS.singleLowIncomeThreshold
      ? 0
      : taxableIncome <= MEDICARE_LEVY_CONSTANTS.singleShadeInUpper
        ? MEDICARE_LEVY_CONSTANTS.shadeInRate
        : MEDICARE_LEVY_CONSTANTS.standardRate;
  const effectiveMarginalRateWithMedicare = round2(marginalTaxRate + marginalMedicareRate);

  const totalTaxOnly = incomeTax + medicareLevy + medicareLevySurcharge;
  const effectiveTaxRatePct =
    grossIncome > 0 ? round2((totalTaxOnly / grossIncome) * 100) : 0;

  const alerts: string[] = [];
  if (medicareLevySurcharge > 0) {
    alerts.push(
      `Medicare Levy Surcharge of $${Math.round(medicareLevySurcharge).toLocaleString()} (${mlsRatePct}%) applies because MLS income exceeds the ${isFamily ? 'family' : 'single'} threshold without private hospital cover.`,
    );
  } else if (!input.hasPrivateHospitalCover && mlsIncome > 0) {
    const baseThreshold = isFamily
      ? MLS_TIERS[fy].families[0].max ?? 210000
      : MLS_TIERS[fy].singles[0].max ?? 105000;
    const adjustedThreshold =
      baseThreshold +
      (isFamily && dependents > 1
        ? (dependents - 1) * MLS_TIERS[fy].dependentChildIncrement
        : 0);
    if (adjustedThreshold - familyMlsIncome <= 5000 && familyMlsIncome <= adjustedThreshold) {
      alerts.push(
        `Income is within $${Math.round(adjustedThreshold - familyMlsIncome).toLocaleString()} of the MLS threshold ($${adjustedThreshold.toLocaleString()}) without private hospital cover.`,
      );
    }
  }

  const estimatedSg = grossIncome * SUPER_CONSTANTS.sgRate;
  if (mlsIncome + estimatedSg > SUPER_CONSTANTS.div293Threshold) {
    alerts.push(
      `Division 293 threshold ($${SUPER_CONSTANTS.div293Threshold.toLocaleString()}) exceeded: an extra 15% tax applies to concessional super contributions above the threshold.`,
    );
  }

  if (rfba > 0 && input.hecsBalance > 0) {
    alerts.push(
      `Reportable Fringe Benefits ($${Math.round(rfba).toLocaleString()}) are included in Repayment Income for HECS-HELP and MLS.`,
    );
  }

  return {
    financialYear: fy,
    grossIncome,
    taxableIncome: round2(taxableIncome),
    repaymentIncome,
    mlsIncome,
    incomeTax,
    litoOffset,
    medicareLevy,
    medicareLevySurcharge,
    mlsRatePct,
    hecsCompulsoryRepayment,
    totalTaxAndHecs,
    netAnnualIncome,
    netMonthlyIncome,
    netFortnightlyIncome,
    marginalTaxRate,
    effectiveMarginalRateWithMedicare,
    effectiveTaxRatePct,
    bracketBreakdown,
    alerts,
  };
}
