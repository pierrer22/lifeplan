import { NOVATED_LEASE_CONSTANTS } from '../data/auConstants';
import type {
  NovatedLeaseCalcInput,
  NovatedLeaseComparisonPoint,
  NovatedLeaseSummary,
} from '../types/planner';
import { calculateTax } from './tax';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function computeMonthlyLeasePayment(
  financedAmountExGst: number,
  residualExGst: number,
  annualRatePct: number,
  termYears: number,
): number {
  const n = Math.max(1, termYears * 12);
  const r = Math.max(0, annualRatePct) / 100 / 12;
  if (financedAmountExGst <= 0) {
    return 0;
  }
  if (r === 0) {
    return (financedAmountExGst - residualExGst) / n;
  }
  const pvResidual = residualExGst / Math.pow(1 + r, n);
  return ((financedAmountExGst - pvResidual) * r) / (1 - Math.pow(1 + r, -n));
}

/**
 * Evaluates a novated lease (EV FBT-exempt or ICE ECM 20% post-tax) against cash purchase
 * and standard car loan, accounting for GST credits ($69,674 car limit), ATO statutory residuals,
 * RFBA gross-up, exact HECS-HELP and MLS knock-on costs, and the 1 April 2027 $75k EV rule.
 */
export function calculateNovatedLease(input: NovatedLeaseCalcInput): NovatedLeaseSummary {
  const fy = input.financialYear;
  const lease = input.lease;
  const vehiclePrice = Math.max(0, lease.vehiclePrice);
  const termYears = lease.leaseTermYears;

  const gstInVehicle = vehiclePrice / (1 + 1 / NOVATED_LEASE_CONSTANTS.gstRate); // price / 11
  const gstSavedOnPurchase = round2(
    Math.min(NOVATED_LEASE_CONSTANTS.maxGstCredit, gstInVehicle),
  );
  const financedAmountExGst = round2(Math.max(0, vehiclePrice - gstSavedOnPurchase));

  const residualRate = NOVATED_LEASE_CONSTANTS.atoResidualsByTerm[termYears];
  const residualPct = round2(residualRate * 100);
  const residualExGst = financedAmountExGst * residualRate;
  const residualValueIncGst = round2(residualExGst * (1 + NOVATED_LEASE_CONSTANTS.gstRate));

  const monthlyFinance = computeMonthlyLeasePayment(
    financedAmountExGst,
    residualExGst,
    lease.financeRatePct,
    termYears,
  );
  const annualFinancePayment = round2(monthlyFinance * 12);

  const annualRunningCosts = Math.max(0, lease.annualRunningCosts);
  const annualRunningCostsExGst = round2(
    annualRunningCosts / (1 + NOVATED_LEASE_CONSTANTS.gstRate),
  );
  const totalAnnualLeasePackageCost = round2(annualFinancePayment + annualRunningCostsExGst);

  const fuelEfficientLct = NOVATED_LEASE_CONSTANTS.fuelEfficientLct[fy];
  const fbtExemptUnderCurrentRules = lease.isEv && vehiclePrice <= fuelEfficientLct;

  const evThreshold = NOVATED_LEASE_CONSTANTS.evTransitionApril2027.fullExemptionPriceCap;
  const postApril2027EvTransitionNote = lease.isEv
    ? vehiclePrice <= evThreshold
      ? `Eligible for 100% FBT exemption (price <= $${evThreshold.toLocaleString()} retains full exemption after 1 April 2027). RFBA still applies for HECS/MLS.`
      : vehiclePrice <= fuelEfficientLct
        ? `Currently 100% FBT-exempt under FY${fy} LCT ($${fuelEfficientLct.toLocaleString()}), but from 1 April 2027 EVs above $${evThreshold.toLocaleString()} shift to a 15% statutory rate / 25% FBT discount.`
        : `Exceeds the fuel-efficient LCT ($${fuelEfficientLct.toLocaleString()}); ineligible for EV FBT exemption so 20% post-tax ECM applies.`
    : 'ICE vehicles are not eligible for the EV FBT exemption and use the 20% post-tax Employee Contribution Method (ECM).';

  const fbtBaseStatutory = vehiclePrice * NOVATED_LEASE_CONSTANTS.rfbaStatutoryRate;

  let preTaxDeductionAnnual = 0;
  let postTaxEcmContributionAnnual = 0;
  let rfbaAmount = 0;

  if (fbtExemptUnderCurrentRules) {
    preTaxDeductionAnnual = totalAnnualLeasePackageCost;
    postTaxEcmContributionAnnual = 0;
    // FBT-exempt EVs still generate a Reportable Fringe Benefits Amount
    rfbaAmount = round2(
      vehiclePrice *
        NOVATED_LEASE_CONSTANTS.rfbaStatutoryRate *
        NOVATED_LEASE_CONSTANTS.rfbaType2GrossUp,
    );
  } else {
    // 20% post-tax ECM eliminates FBT & RFBA
    postTaxEcmContributionAnnual = round2(Math.min(totalAnnualLeasePackageCost, fbtBaseStatutory));
    preTaxDeductionAnnual = round2(
      Math.max(0, totalAnnualLeasePackageCost - postTaxEcmContributionAnnual),
    );
    rfbaAmount = 0;
  }

  const taxBaseline = calculateTax({
    financialYear: fy,
    grossSalary: input.grossSalary,
    hasPrivateHospitalCover: input.hasPrivateHospitalCover,
    hecsBalance: input.hecsBalance,
  });

  const taxWithLease = calculateTax({
    financialYear: fy,
    grossSalary: input.grossSalary,
    preTaxDeductions: preTaxDeductionAnnual,
    reportableFringeBenefits: rfbaAmount,
    hasPrivateHospitalCover: input.hasPrivateHospitalCover,
    hecsBalance: input.hecsBalance,
  });

  const incomeTaxAndMedicareSavedAnnual = round2(
    taxBaseline.incomeTax +
      taxBaseline.medicareLevy -
      (taxWithLease.incomeTax + taxWithLease.medicareLevy),
  );
  const hecsImpactAnnual = round2(
    taxWithLease.hecsCompulsoryRepayment - taxBaseline.hecsCompulsoryRepayment,
  );
  const mlsImpactAnnual = round2(
    taxWithLease.medicareLevySurcharge - taxBaseline.medicareLevySurcharge,
  );

  const netTakeHomePayReductionAnnual = round2(
    taxBaseline.netAnnualIncome -
      (taxWithLease.netAnnualIncome - postTaxEcmContributionAnnual),
  );
  const netTakeHomePayReductionFortnightly = round2(netTakeHomePayReductionAnnual / 26);

  const cashPurchaseTotalCostOverTerm = round2(vehiclePrice + annualRunningCosts * termYears);
  const novatedLeaseNetCostOverTerm = round2(
    netTakeHomePayReductionAnnual * termYears + residualValueIncGst,
  );
  const netSavingsVsCashOverTerm = round2(
    cashPurchaseTotalCostOverTerm - novatedLeaseNetCostOverTerm,
  );
  const effectiveDiscountPct =
    cashPurchaseTotalCostOverTerm > 0
      ? round2((netSavingsVsCashOverTerm / cashPurchaseTotalCostOverTerm) * 100)
      : 0;

  // Also estimate a standard post-tax car loan at same rate for reference alert
  const monthlyCarLoan = computeMonthlyLeasePayment(
    vehiclePrice,
    0,
    lease.financeRatePct,
    termYears,
  );
  const carLoanTotalCostOverTerm = round2(
    monthlyCarLoan * 12 * termYears + annualRunningCosts * termYears,
  );

  const comparisonChart: NovatedLeaseComparisonPoint[] = [
    {
      label: 'Vehicle / Finance',
      cashCost: round2(vehiclePrice),
      novatedCost: round2(annualFinancePayment * termYears + residualValueIncGst),
    },
    {
      label: 'Running Costs',
      cashCost: round2(annualRunningCosts * termYears),
      novatedCost: round2(annualRunningCostsExGst * termYears),
    },
    {
      label: 'Tax Saved (Credit)',
      cashCost: 0,
      novatedCost: round2(-incomeTaxAndMedicareSavedAnnual * termYears),
    },
    {
      label: 'HECS & MLS Knock-on',
      cashCost: 0,
      novatedCost: round2((hecsImpactAnnual + mlsImpactAnnual) * termYears),
    },
    {
      label: `${termYears}-Yr Net Total`,
      cashCost: cashPurchaseTotalCostOverTerm,
      novatedCost: novatedLeaseNetCostOverTerm,
    },
  ];

  const alerts: string[] = [];
  if (rfbaAmount > 0 && hecsImpactAnnual > 0) {
    alerts.push(
      `RFBA ($${Math.round(rfbaAmount).toLocaleString()}/yr) increases HECS-HELP repayment by $${Math.round(hecsImpactAnnual).toLocaleString()}/yr, reducing headline tax savings.`,
    );
  }
  if (rfbaAmount > 0 && mlsImpactAnnual > 0) {
    alerts.push(
      `RFBA ($${Math.round(rfbaAmount).toLocaleString()}/yr) triggers $${Math.round(mlsImpactAnnual).toLocaleString()}/yr in extra Medicare Levy Surcharge without private hospital cover.`,
    );
  }
  if (lease.isEv && vehiclePrice > evThreshold && vehiclePrice <= fuelEfficientLct) {
    alerts.push(postApril2027EvTransitionNote);
  }
  alerts.push(
    `Compared to a standard ${lease.financeRatePct.toFixed(1)}% car loan ($${Math.round(carLoanTotalCostOverTerm).toLocaleString()} total), novated lease saves $${Math.round(carLoanTotalCostOverTerm - novatedLeaseNetCostOverTerm).toLocaleString()} over ${termYears} years.`,
  );

  return {
    enabled: lease.enabled,
    vehiclePrice,
    isEv: lease.isEv,
    gstSavedOnPurchase,
    financedAmountExGst,
    residualPct,
    residualValueIncGst,
    annualFinancePayment,
    annualRunningCosts,
    totalAnnualLeasePackageCost,
    fbtExemptUnderCurrentRules,
    postApril2027EvTransitionNote,
    preTaxDeductionAnnual,
    postTaxEcmContributionAnnual,
    rfbaAmount,
    incomeTaxAndMedicareSavedAnnual,
    hecsImpactAnnual,
    mlsImpactAnnual,
    netTakeHomePayReductionAnnual,
    netTakeHomePayReductionFortnightly,
    cashPurchaseTotalCostOverTerm,
    novatedLeaseNetCostOverTerm,
    netSavingsVsCashOverTerm,
    effectiveDiscountPct,
    comparisonChart,
    alerts,
  };
}
