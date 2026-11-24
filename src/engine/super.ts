import { RESIDENT_TAX_BRACKETS, SUPER_CONSTANTS } from '../data/auConstants';
import type {
  FhsssProjection,
  SuperInput,
  SuperProjectionPoint,
  SuperSummary,
} from '../types/planner';
import { calculateTax } from './tax';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Computes employer SG, salary sacrifice concessional cap headroom, carry-forward eligibility,
 * Division 293 tax, bracket-aware income tax savings, FHSSS release & boost vs HISA,
 * and long-term super balance projection to age 60.
 */
export function calculateSuperAndFhsss(input: SuperInput): SuperSummary {
  const fy = input.financialYear;
  const grossSalary = Math.max(0, input.grossSalary);
  const superRatePct = Math.max(0, input.superRatePct);
  const currentSuperBalance = Math.max(0, input.currentSuperBalance);
  const salarySacrificeAnnual = Math.max(0, input.salarySacrificeAnnual);

  const concessionalCap = SUPER_CONSTANTS.concessionalCap[fy];
  const carryForwardEligible = currentSuperBalance < SUPER_CONSTANTS.carryForwardTsbLimit;
  const carryForwardAvailable = carryForwardEligible
    ? round2(Math.max(0, input.carryForwardUnusedCap))
    : 0;
  const effectiveMaxCap = round2(concessionalCap + carryForwardAvailable);

  const employerSgAnnual = round2(grossSalary * (superRatePct / 100));
  const totalConcessionalAnnual = round2(employerSgAnnual + salarySacrificeAnnual);
  const remainingCapSpace = round2(Math.max(0, effectiveMaxCap - totalConcessionalAnnual));
  const excessConcessionalAmount = round2(Math.max(0, totalConcessionalAnnual - effectiveMaxCap));

  // Division 293 income = taxable income + reportable super + employer SG = grossSalary + employerSgAnnual
  const div293Income = grossSalary + employerSgAnnual;
  const div293Triggered = div293Income > SUPER_CONSTANTS.div293Threshold;
  const div293Tax = div293Triggered
    ? round2(
        Math.min(
          Math.min(totalConcessionalAnnual, effectiveMaxCap),
          Math.max(0, div293Income - SUPER_CONSTANTS.div293Threshold),
        ) * SUPER_CONSTANTS.div293AdditionalTaxRate,
      )
    : 0;

  const contributionsTax15Pct = round2(
    totalConcessionalAnnual * SUPER_CONSTANTS.contributionsTaxRate,
  );
  const netSuperAddedThisYear = round2(
    Math.max(0, totalConcessionalAnnual - contributionsTax15Pct - div293Tax),
  );

  // Bracket-aware personal income tax + Medicare levy saved via salary sacrifice
  let incomeTaxSavedThisYear = 0;
  if (salarySacrificeAnnual > 0 && grossSalary > 0) {
    const taxWithoutSacrifice = calculateTax({
      financialYear: fy,
      grossSalary,
      salarySacrificeSuper: 0,
      hasPrivateHospitalCover: true,
      hecsBalance: 0,
    });
    const taxWithSacrifice = calculateTax({
      financialYear: fy,
      grossSalary,
      salarySacrificeSuper: salarySacrificeAnnual,
      hasPrivateHospitalCover: true,
      hecsBalance: 0,
    });
    incomeTaxSavedThisYear = round2(
      Math.max(
        0,
        taxWithoutSacrifice.incomeTax +
          taxWithoutSacrifice.medicareLevy -
          (taxWithSacrifice.incomeTax + taxWithSacrifice.medicareLevy),
      ),
    );
  }

  const takeHomePayReductionAnnual = round2(
    Math.max(0, salarySacrificeAnnual - incomeTaxSavedThisYear),
  );

  // FHSSS Calculation: $15k/yr cap, $50k lifetime cap, 85% concessional release + deemed SIC
  const rawMtr =
    input.marginalTaxRateWithMedicare > 1
      ? input.marginalTaxRateWithMedicare / 100
      : Math.max(0, input.marginalTaxRateWithMedicare);
  const yearsContributed = Math.max(0, Math.round(input.targetFhsssYears));
  const annualEligibleContribution = round2(
    Math.min(salarySacrificeAnnual, SUPER_CONSTANTS.fhsss.annualCap),
  );

  let remainingLifetime: number = SUPER_CONSTANTS.fhsss.lifetimeCap;
  let totalEligibleContributions = 0;
  let compoundedFhsssGross = 0;
  let hisaBalance = 0;
  const sicRate = SUPER_CONSTANTS.fhsss.deemedSicRate;
  const hisaAfterTaxRate = 0.05 * (1 - rawMtr);

  for (let y = 1; y <= yearsContributed; y++) {
    const contribThisYear = Math.min(annualEligibleContribution, remainingLifetime);
    remainingLifetime = Math.max(0, remainingLifetime - contribThisYear);
    totalEligibleContributions += contribThisYear;

    const netContribAfter15Pct = contribThisYear * (1 - SUPER_CONSTANTS.contributionsTaxRate);
    // Mid-year contribution timing approximation for deemed SIC earnings
    compoundedFhsssGross =
      compoundedFhsssGross * (1 + sicRate) + netContribAfter15Pct * (1 + sicRate * 0.5);

    const afterTaxCashSaved = contribThisYear * (1 - rawMtr);
    hisaBalance =
      hisaBalance * (1 + hisaAfterTaxRate) + afterTaxCashSaved * (1 + hisaAfterTaxRate * 0.5);
  }

  totalEligibleContributions = round2(totalEligibleContributions);
  const netContributionsAfter15PctTax = round2(
    totalEligibleContributions * (1 - SUPER_CONSTANTS.contributionsTaxRate),
  );
  const grossReleasableAmount = round2(compoundedFhsssGross);
  const deemedEarningsSic = round2(
    Math.max(0, grossReleasableAmount - netContributionsAfter15PctTax),
  );

  const withdrawalTaxRate = Math.max(0, rawMtr - SUPER_CONSTANTS.fhsss.withdrawalTaxOffset);
  const withdrawalTaxRatePct = round2(withdrawalTaxRate * 100);
  const estimatedWithdrawalTax = round2(grossReleasableAmount * withdrawalTaxRate);
  const netFhsssReleaseAmount = round2(
    Math.max(0, grossReleasableAmount - estimatedWithdrawalTax),
  );
  const taxSavedVsCashSaving = round2(
    totalEligibleContributions > 0 ? netFhsssReleaseAmount - hisaBalance : 0,
  );

  const fhsss: FhsssProjection = {
    annualEligibleContribution,
    yearsContributed,
    totalEligibleContributions,
    netContributionsAfter15PctTax,
    deemedEarningsSic,
    grossReleasableAmount,
    withdrawalTaxRatePct,
    estimatedWithdrawalTax,
    netFhsssReleaseAmount,
    taxSavedVsCashSaving,
  };

  // Multi-year projection to preservation age (60)
  const yearsTo60 = Math.max(0, SUPER_CONSTANTS.preservationAge - input.age);
  const invReturn = Math.max(0, input.investmentReturnPct) / 100;
  const sgNetAnnual = round2(
    employerSgAnnual * (1 - SUPER_CONSTANTS.contributionsTaxRate) -
      (div293Triggered && salarySacrificeAnnual === 0 ? div293Tax : 0),
  );

  const projectionSeries: SuperProjectionPoint[] = [
    {
      year: 0,
      age: input.age,
      balanceBaseline: round2(currentSuperBalance),
      balanceWithSacrifice: round2(currentSuperBalance),
      annualConcessionalTotal: totalConcessionalAnnual,
    },
  ];

  let balBase = currentSuperBalance;
  let balSac = currentSuperBalance;
  const horizonYears = Math.max(yearsTo60, 1);

  for (let y = 1; y <= horizonYears; y++) {
    balBase = balBase * (1 + invReturn) + sgNetAnnual;
    balSac = balSac * (1 + invReturn) + netSuperAddedThisYear;
    projectionSeries.push({
      year: y,
      age: input.age + y,
      balanceBaseline: round2(balBase),
      balanceWithSacrifice: round2(balSac),
      annualConcessionalTotal: totalConcessionalAnnual,
    });
  }

  const at60Point =
    yearsTo60 === 0 ? projectionSeries[0] : projectionSeries[yearsTo60];

  // Alerts and optimal contribution recommendation
  const alerts: string[] = [];
  if (excessConcessionalAmount > 0) {
    alerts.push(
      `Concessional contributions exceed your $${effectiveMaxCap.toLocaleString()} effective cap by $${Math.round(excessConcessionalAmount).toLocaleString()} (excess amounts are taxed at marginal rate).`,
    );
  }

  if (!carryForwardEligible && input.carryForwardUnusedCap > 0) {
    alerts.push(
      `Total super balance ($${Math.round(currentSuperBalance).toLocaleString()}) is at or above $500,000, so carry-forward unused caps cannot be used.`,
    );
  }

  if (div293Triggered) {
    alerts.push(
      `Division 293 applies ($${Math.round(div293Tax).toLocaleString()} extra 15% tax on super contributions above $250k income+super).`,
    );
  }

  if (salarySacrificeAnnual > 0) {
    alerts.push(
      `Salary sacrifice ($${Math.round(salarySacrificeAnnual).toLocaleString()}/yr) counts as Reportable Employer Super (RESC), so it does not reduce HECS-HELP repayments or MLS income.`,
    );
  }

  // Optimal concessional recommendation
  const brackets = RESIDENT_TAX_BRACKETS[fy];
  const highBracketFloor = brackets[3]?.over ?? 135000; // 37% bracket
  const midBracketFloor = brackets[2]?.over ?? 45000; // 30% bracket
  const maxAdditionalUnderCap = Math.max(0, concessionalCap - employerSgAnnual);

  if (grossSalary > highBracketFloor && remainingCapSpace > 0) {
    const amountToDropBracket = Math.min(
      Math.max(0, grossSalary - highBracketFloor),
      maxAdditionalUnderCap + carryForwardAvailable,
    );
    if (amountToDropBracket > salarySacrificeAnnual + 500) {
      alerts.push(
        `Optimal tax tip: sacrificing up to $${Math.round(amountToDropBracket).toLocaleString()}/yr shifts 39% marginal income down to 32%, netting 24% immediate tax arbitrage.`,
      );
    }
  } else if (grossSalary > midBracketFloor && salarySacrificeAnnual < Math.min(15000, maxAdditionalUnderCap)) {
    const suggestedFhsss = Math.min(SUPER_CONSTANTS.fhsss.annualCap, maxAdditionalUnderCap);
    alerts.push(
      `Optimal FHSSS tip: contributing $${Math.round(suggestedFhsss).toLocaleString()}/yr captures 15% super tax vs ${Math.round(rawMtr * 100)}% marginal rate for your first-home deposit.`,
    );
  }

  return {
    financialYear: fy,
    employerSgAnnual,
    salarySacrificeAnnual,
    totalConcessionalAnnual,
    concessionalCap,
    carryForwardAvailable,
    effectiveMaxCap,
    remainingCapSpace,
    excessConcessionalAmount,
    div293Triggered,
    div293Tax,
    contributionsTax15Pct,
    netSuperAddedThisYear,
    incomeTaxSavedThisYear,
    takeHomePayReductionAnnual,
    projectedBalanceAt60Baseline: at60Point.balanceBaseline,
    projectedBalanceAt60WithSacrifice: at60Point.balanceWithSacrifice,
    fhsss,
    projectionSeries,
    alerts,
  };
}
