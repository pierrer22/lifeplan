import { HGS_PRICE_CAPS } from '../data/auConstants';
import type {
  AuState,
  BorrowingImpactItem,
  MortgageApprovalInput,
  MortgageApprovalSummary,
  RateStressPoint,
  UnderwritingGate,
} from '../types/planner';
import { calculateStampDuty } from './housing';
import { calculateTax } from './tax';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getHgsCapForCity(state: AuState, cityLabel: string): number {
  const caps = HGS_PRICE_CAPS[state];
  const lower = cityLabel.toLowerCase();
  const isMetro =
    lower.includes(caps.metroLabel.toLowerCase()) ||
    caps.metroCap === caps.regionalCap;
  return isMetro ? caps.metroCap : caps.regionalCap;
}

function computeMonthlyRepayment(
  principal: number,
  annualRatePct: number,
  termYears: number,
): number {
  if (principal <= 0) return 0;
  const n = Math.max(12, Math.round(termYears * 12));
  const r = Math.max(0, annualRatePct) / 100 / 12;
  if (r === 0) return round2(principal / n);
  return round2((principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1));
}

function maxLoanFromMonthlyCapacity(
  monthlyCapacity: number,
  annualRatePct: number,
  termYears: number,
): number {
  if (monthlyCapacity <= 0) return 0;
  const n = Math.max(12, Math.round(termYears * 12));
  const r = Math.max(0.01, annualRatePct) / 100 / 12;
  const maxLoan = monthlyCapacity * ((1 - Math.pow(1 + r, -n)) / r);
  return Math.max(0, Math.round(maxLoan));
}

function estimateLmiForApproval(
  loanAmount: number,
  lvrPct: number,
  hgsEligible: boolean,
): number {
  if (loanAmount <= 0 || lvrPct <= 80 || hgsEligible) return 0;
  if (lvrPct <= 90) return Math.round(loanAmount * 0.022);
  if (lvrPct <= 95) return Math.round(loanAmount * 0.038);
  return Math.round(loanAmount * 0.048);
}

/**
 * Evaluates Australian residential mortgage loan approval likelihood under APRA
 * +3.0% serviceability buffer, HEM living expense floors, 3.8%/mo credit card limit
 * shading, HECS-HELP Repayment Income impact, LVR/HGS/LMI, and DTI thresholds.
 */
export function evaluateMortgageApproval(
  input: MortgageApprovalInput,
): MortgageApprovalSummary {
  const isCouple = input.relationshipStatus === 'couple';
  const dependents = Math.max(0, Math.round(input.dependents));
  const termYears = Math.max(5, Math.min(35, Math.round(input.loanTermYears)));
  const interestRatePct = Math.max(1, input.interestRatePct);
  const apraBufferPct = Math.max(0, input.apraBufferPct);
  const assessmentRatePct = round2(interestRatePct + apraBufferPct);

  // Shaded income: 100% base salaries + 80% of bonus/overtime/other income
  const baseSalary = Math.max(0, input.grossSalary);
  const partnerGross = isCouple ? Math.max(0, input.partnerGrossSalary) : 0;
  const shadedBonus = Math.max(0, input.bonusOrOtherIncomeAnnual) * 0.8;
  const primaryAssessedGross = baseSalary + shadedBonus;
  const preTaxLease = Math.max(0, input.novatedLeaseAnnualPreTax);

  const primaryTaxWithHecs = calculateTax({
    financialYear: input.financialYear,
    grossSalary: primaryAssessedGross,
    partnerGrossSalary: partnerGross,
    relationshipStatus: input.relationshipStatus,
    dependents,
    preTaxDeductions: preTaxLease,
    hasPrivateHospitalCover: input.hasPrivateHospitalCover,
    hecsBalance: Math.max(0, input.hecsBalance),
  });

  const primaryTaxNoHecs = calculateTax({
    financialYear: input.financialYear,
    grossSalary: primaryAssessedGross,
    partnerGrossSalary: partnerGross,
    relationshipStatus: input.relationshipStatus,
    dependents,
    preTaxDeductions: preTaxLease,
    hasPrivateHospitalCover: input.hasPrivateHospitalCover,
    hecsBalance: 0,
  });

  const partnerTax = isCouple
    ? calculateTax({
        financialYear: input.financialYear,
        grossSalary: partnerGross,
        partnerGrossSalary: primaryAssessedGross,
        relationshipStatus: 'couple',
        dependents,
        hasPrivateHospitalCover: input.hasPrivateHospitalCover,
        hecsBalance: 0,
      })
    : null;

  const assessedNetMonthlyIncome = round2(
    primaryTaxWithHecs.netMonthlyIncome + (partnerTax?.netMonthlyIncome ?? 0),
  );
  const netMonthlyIncomeNoHecs = round2(
    primaryTaxNoHecs.netMonthlyIncome + (partnerTax?.netMonthlyIncome ?? 0),
  );
  const hecsMonthlyImpact = round2(
    Math.max(0, netMonthlyIncomeNoHecs - assessedNetMonthlyIncome),
  );

  // Household Expenditure Measure (HEM) floor + dependent uplift
  const hemFloorMonthly = (isCouple ? 2850 : 1900) + dependents * 450;
  const assessedLivingMonthly = Math.round(
    Math.max(hemFloorMonthly, Math.max(0, input.monthlyLivingExpenses)),
  );

  // Credit card limit shading at 3.8% of total credit limit per month
  const creditLimits = Math.max(0, input.creditCardLimitsTotal);
  const creditCardMonthlyAssessment = round2(creditLimits * 0.038);
  const otherDebtMonthly = Math.max(0, input.existingMonthlyDebtRepayments);
  const totalNonMortgageDebtMonthly = round2(
    otherDebtMonthly + creditCardMonthlyAssessment,
  );

  const maxBorrowingCapacityMonthly =
    assessedNetMonthlyIncome - assessedLivingMonthly - totalNonMortgageDebtMonthly;
  const maxBorrowingPower = maxLoanFromMonthlyCapacity(
    maxBorrowingCapacityMonthly,
    assessmentRatePct,
    termYears,
  );

  const borrowingPowerWithoutCards = maxLoanFromMonthlyCapacity(
    assessedNetMonthlyIncome - assessedLivingMonthly - otherDebtMonthly,
    assessmentRatePct,
    termYears,
  );
  const borrowingPowerWithoutHecs = maxLoanFromMonthlyCapacity(
    netMonthlyIncomeNoHecs - assessedLivingMonthly - totalNonMortgageDebtMonthly,
    assessmentRatePct,
    termYears,
  );
  const borrowingPowerNoCardsOrHecs = maxLoanFromMonthlyCapacity(
    netMonthlyIncomeNoHecs - assessedLivingMonthly - otherDebtMonthly,
    assessmentRatePct,
    termYears,
  );

  const borrowingLostToCards = Math.max(
    0,
    borrowingPowerWithoutCards - maxBorrowingPower,
  );
  const borrowingLostToHecs = Math.max(
    0,
    borrowingPowerWithoutHecs - maxBorrowingPower,
  );

  // Property, LVR, HGS, Stamp Duty & LMI
  const propertyPrice = Math.max(0, input.propertyPrice);
  const depositAmount = Math.max(0, Math.min(propertyPrice, input.depositAmount));
  const requestedLoanAmount = Math.max(0, Math.round(propertyPrice - depositAmount));
  const lvrPct =
    propertyPrice > 0 ? round2((requestedLoanAmount / propertyPrice) * 100) : 0;

  const hgsCap = getHgsCapForCity(input.state, input.cityLabel);
  const hgsEligible =
    input.isFirstHomeBuyer &&
    lvrPct <= 95 &&
    propertyPrice > 0 &&
    propertyPrice <= hgsCap;

  const stampDuty = calculateStampDuty(
    propertyPrice,
    input.state,
    input.isFirstHomeBuyer,
    input.isNewHome,
  );
  const lmiEstimate = estimateLmiForApproval(
    requestedLoanAmount,
    lvrPct,
    hgsEligible,
  );
  const totalCashNeeded = Math.round(depositAmount + stampDuty + lmiEstimate + 3500);

  const borrowingSurplusOrShortfall = Math.round(
    maxBorrowingPower - requestedLoanAmount,
  );

  const actualMonthlyRepayment = computeMonthlyRepayment(
    requestedLoanAmount,
    interestRatePct,
    termYears,
  );
  const stressedMonthlyRepayment = computeMonthlyRepayment(
    requestedLoanAmount,
    assessmentRatePct,
    termYears,
  );
  const totalMonthlyCommitments = round2(
    assessedLivingMonthly + totalNonMortgageDebtMonthly + stressedMonthlyRepayment,
  );
  const netMonthlySurplusAtStress = round2(
    assessedNetMonthlyIncome - totalMonthlyCommitments,
  );

  // Debt-to-Income (DTI) ratio against assessed gross household income
  const totalAssessedGrossAnnual = Math.max(1, primaryAssessedGross + partnerGross);
  const totalDebtExposure =
    requestedLoanAmount +
    Math.max(0, input.hecsBalance) +
    creditLimits +
    otherDebtMonthly * 36;
  const dtiRatio = round2(totalDebtExposure / totalAssessedGrossAnnual);

  // Gate 1: APRA Serviceability
  const serviceabilityStatus: UnderwritingGate['status'] =
    netMonthlySurplusAtStress >= 250 && maxBorrowingPower >= requestedLoanAmount
      ? 'pass'
      : netMonthlySurplusAtStress >= 0 && maxBorrowingPower >= requestedLoanAmount * 0.95
        ? 'borderline'
        : 'fail';

  // Gate 2: LVR & Deposit
  const lvrStatus: UnderwritingGate['status'] =
    lvrPct <= 80 || (lvrPct <= 95 && hgsEligible)
      ? 'pass'
      : lvrPct <= 95
        ? 'borderline'
        : 'fail';

  // Gate 3: Debt-to-Income Ratio
  const dtiStatus: UnderwritingGate['status'] =
    dtiRatio <= 6.0 ? 'pass' : dtiRatio <= 7.0 ? 'borderline' : 'fail';

  // Gate 4: Employment & Credit Profile
  const isStudyingLowIncome =
    input.employmentStatus === 'studying_austudy' &&
    baseSalary + partnerGross < 45000;
  const profileStatus: UnderwritingGate['status'] = isStudyingLowIncome
    ? 'fail'
    : input.employmentStatus === 'casual' || input.creditScoreBand === 'fair'
      ? 'borderline'
      : 'pass';

  const gates: UnderwritingGate[] = [
    {
      id: 'serviceability',
      label: `Serviceability (+${apraBufferPct.toFixed(1)}% APRA)`,
      status: serviceabilityStatus,
      actualDisplay: `$${Math.round(netMonthlySurplusAtStress).toLocaleString('en-AU')}/mo`,
      benchmarkDisplay: '≥ $250/mo surplus',
      detail:
        serviceabilityStatus === 'pass'
          ? `Passes ${assessmentRatePct.toFixed(2)}% stress test with max borrowing of $${maxBorrowingPower.toLocaleString('en-AU')}.`
          : serviceabilityStatus === 'borderline'
            ? `Tight serviceability buffer ($${Math.round(netMonthlySurplusAtStress).toLocaleString('en-AU')}/mo) at ${assessmentRatePct.toFixed(2)}%.`
            : `Shortfall of $${Math.abs(borrowingSurplusOrShortfall).toLocaleString('en-AU')} against requested $${requestedLoanAmount.toLocaleString('en-AU')} loan.`,
    },
    {
      id: 'lvr',
      label: 'LVR & Deposit Equity',
      status: lvrStatus,
      actualDisplay: `${lvrPct.toFixed(1)}% LVR`,
      benchmarkDisplay: hgsEligible ? '≤ 95% (HGS)' : '≤ 80% (no LMI)',
      detail:
        lvrPct > 95
          ? `LVR above 95% exceeds standard Australian residential maximum.`
          : hgsEligible
            ? `Eligible for 5% Home Guarantee Scheme in ${input.state} (cap $${hgsCap.toLocaleString('en-AU')}, $0 LMI).`
            : lvrPct > 80
              ? `Requires ~$${lmiEstimate.toLocaleString('en-AU')} Lenders Mortgage Insurance (80%–95% LVR).`
              : `20%+ deposit avoids LMI and unlocks sharper tier-1 rates.`,
    },
    {
      id: 'dti',
      label: 'Debt-to-Income (DTI)',
      status: dtiStatus,
      actualDisplay: `${dtiRatio.toFixed(1)}x`,
      benchmarkDisplay: '≤ 6.0x preferred',
      detail:
        dtiRatio <= 6.0
          ? `DTI of ${dtiRatio.toFixed(1)}x sits comfortably inside APRA's 6.0x monitoring threshold.`
          : dtiRatio <= 7.0
            ? `Elevated DTI (${dtiRatio.toFixed(1)}x): lenders may apply manual credit sign-off.`
            : `High DTI (${dtiRatio.toFixed(1)}x) exceeds typical 7.0x bank policy ceiling.`,
    },
    {
      id: 'profile',
      label: 'Employment & Credit',
      status: profileStatus,
      actualDisplay:
        input.creditScoreBand === 'very_good'
          ? 'Very Good'
          : input.creditScoreBand.charAt(0).toUpperCase() +
            input.creditScoreBand.slice(1),
      benchmarkDisplay: 'Stable PAYG + Good+',
      detail:
        profileStatus === 'pass'
          ? `PAYG employment with ${input.creditScoreBand.replace('_', ' ')} credit profile supports standard turnaround.`
          : profileStatus === 'borderline'
            ? `Casual income or fair credit score typically needs 6–12 months history or specialist lender.`
            : `Full-time study / Austudy income alone generally will not satisfy bank PAYG servicing.`,
    },
  ];

  const hasFail = gates.some((g) => g.status === 'fail');
  const hasBorderline = gates.some((g) => g.status === 'borderline');
  const verdict: MortgageApprovalSummary['verdict'] = hasFail
    ? 'Unlikely / Declined'
    : hasBorderline
      ? 'Conditional / Borderline'
      : 'Likely Approved';

  // Compute 0-100 approval score calibrated cleanly to gate statuses & headroom
  const coverageRatio =
    requestedLoanAmount > 0
      ? Math.min(1.4, maxBorrowingPower / requestedLoanAmount)
      : 1.4;
  let rawScore = Math.round(
    coverageRatio * 48 +
      (lvrStatus === 'pass' ? 22 : lvrStatus === 'borderline' ? 14 : 4) +
      (dtiStatus === 'pass' ? 16 : dtiStatus === 'borderline' ? 9 : 2) +
      (profileStatus === 'pass' ? 14 : profileStatus === 'borderline' ? 8 : 2),
  );
  rawScore = Math.max(5, Math.min(100, rawScore));
  const approvalScore = hasFail
    ? Math.min(45, rawScore)
    : hasBorderline
      ? Math.max(50, Math.min(74, rawScore))
      : Math.max(75, rawScore);

  const borrowingBreakdown: BorrowingImpactItem[] = [
    {
      name: 'Max w/o HECS & Cards',
      amount: borrowingPowerNoCardsOrHecs,
      color: '#64748B',
    },
    {
      name: 'After HECS-HELP',
      amount: borrowingPowerWithoutCards,
      color: '#D97706',
    },
    {
      name: 'Final Max Borrowing',
      amount: maxBorrowingPower,
      color: '#2563EB',
    },
    {
      name: 'Requested Loan',
      amount: requestedLoanAmount,
      color: maxBorrowingPower >= requestedLoanAmount ? '#059669' : '#E11D48',
    },
  ];

  // Rate stress test series: -0.5% to +3.0% (or apraBufferPct)
  const offsets = [-0.5, 0, 0.5, 1.0, 2.0, Math.max(2.5, round2(apraBufferPct))];
  const rateStressSeries: RateStressPoint[] = offsets.map((offset) => {
    const ratePct = round2(Math.max(1.5, interestRatePct + offset));
    const monthlyRepayment = computeMonthlyRepayment(
      requestedLoanAmount,
      ratePct,
      termYears,
    );
    const monthlySurplus = round2(
      assessedNetMonthlyIncome -
        assessedLivingMonthly -
        totalNonMortgageDebtMonthly -
        monthlyRepayment,
    );
    const isAssessment = Math.abs(offset - apraBufferPct) < 0.01;
    return {
      rateLabel: isAssessment
        ? `${ratePct.toFixed(1)}% (APRA)`
        : `${ratePct.toFixed(1)}%`,
      ratePct,
      monthlyRepayment: Math.round(monthlyRepayment),
      monthlySurplus: Math.round(monthlySurplus),
      isAssessmentRate: isAssessment,
    };
  });

  // Dynamic, dollar-quantified unlock actions
  const unlockActions: string[] = [];
  if (borrowingLostToCards >= 5000 && creditLimits > 0) {
    unlockActions.push(
      `Closing or reducing $${creditLimits.toLocaleString('en-AU')} in credit card limits (shaded at 3.8%/mo) adds +$${borrowingLostToCards.toLocaleString('en-AU')} to your borrowing power.`,
    );
  }
  if (borrowingLostToHecs >= 5000 && input.hecsBalance > 0) {
    unlockActions.push(
      `Paying off your $${Math.round(input.hecsBalance).toLocaleString('en-AU')} HECS-HELP balance frees $${Math.round(hecsMonthlyImpact).toLocaleString('en-AU')}/mo in cashflow, lifting borrowing power by +$${borrowingLostToHecs.toLocaleString('en-AU')}.`,
    );
  }
  if (borrowingSurplusOrShortfall < 0) {
    const shortfall = Math.abs(borrowingSurplusOrShortfall);
    unlockActions.push(
      `Close the $${shortfall.toLocaleString('en-AU')} borrowing shortfall by increasing deposit, adding a co-borrower, or targeting properties around $${Math.max(0, maxBorrowingPower + depositAmount).toLocaleString('en-AU')}.`,
    );
  }
  if (lvrPct > 80 && !hgsEligible) {
    unlockActions.push(
      `Increasing your deposit to 20% ($${Math.round(propertyPrice * 0.2).toLocaleString('en-AU')}) eliminates ~$${lmiEstimate.toLocaleString('en-AU')} in Lenders Mortgage Insurance.`,
    );
  }
  if (assessedLivingMonthly === hemFloorMonthly && input.monthlyLivingExpenses < hemFloorMonthly) {
    unlockActions.push(
      `Banks automatically apply the $${hemFloorMonthly.toLocaleString('en-AU')}/mo HEM floor even if declared expenses ($${Math.round(input.monthlyLivingExpenses).toLocaleString('en-AU')}/mo) are lower.`,
    );
  }
  if (unlockActions.length === 0) {
    unlockActions.push(
      `Strong approval position with $${Math.round(netMonthlySurplusAtStress).toLocaleString('en-AU')}/mo surplus at ${assessmentRatePct.toFixed(2)}% stress rate — compare 2–3 lenders for rate discounts.`,
    );
  }

  return {
    verdict,
    approvalScore,
    requestedLoanAmount,
    maxBorrowingPower,
    borrowingSurplusOrShortfall,
    lvrPct,
    hgsEligible,
    lmiEstimate,
    stampDuty,
    totalCashNeeded,
    dtiRatio,
    assessmentRatePct,
    actualMonthlyRepayment,
    stressedMonthlyRepayment,
    assessedNetMonthlyIncome,
    assessedLivingMonthly,
    hemFloorMonthly,
    creditCardMonthlyAssessment,
    hecsMonthlyImpact,
    totalMonthlyCommitments,
    netMonthlySurplusAtStress,
    borrowingPowerWithoutCards,
    borrowingPowerWithoutHecs,
    borrowingLostToCards,
    borrowingLostToHecs,
    gates,
    borrowingBreakdown,
    rateStressSeries,
    unlockActions,
  };
}
