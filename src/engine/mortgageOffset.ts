import type {
  MortgageOffsetInput,
  MortgageOffsetSummary,
  MortgageOffsetYearPoint,
} from '../types/planner';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function computeScheduledMonthlyPI(
  principal: number,
  annualRatePct: number,
  termYears: number,
): number {
  if (principal <= 0) return 0;
  const n = Math.max(12, Math.round(termYears * 12));
  const r = Math.max(0, annualRatePct) / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

/**
 * Simulates an Australian 100% mortgage offset account against a standard P&I home loan,
 * quantifying lifetime interest saved, term shortened, full-offset milestone, package fee
 * break-even balance, and after-tax HISA comparison.
 */
export function calculateMortgageOffset(
  input: MortgageOffsetInput,
): MortgageOffsetSummary {
  const loanAmount = Math.max(0, Math.round(input.loanAmount));
  const annualRatePct = Math.max(0, input.annualRatePct);
  const loanTermYears = Math.max(1, Math.min(35, Math.round(input.loanTermYears)));
  const initialOffsetBalance = Math.max(0, input.initialOffsetBalance);
  const monthlyOffsetContribution = Math.max(0, input.monthlyOffsetContribution);
  const annualOffsetFee = Math.max(0, input.annualOffsetFee ?? 0);
  const marginalTaxDec = Math.max(
    0,
    Math.min(0.49, input.marginalTaxRateWithMedicarePct / 100),
  );
  const hisaRatePct = Math.max(0, input.hisaRatePct ?? 5.0);

  const taxFreeEquivalentHisaRatePct =
    marginalTaxDec < 0.99
      ? round2(annualRatePct / (1 - marginalTaxDec))
      : annualRatePct;
  // 2026-27 Federal Budget (from 1 Jul 2027): 50% CGT discount replaced by CPI cost-base
  // indexation (assumes 2.8% CPI) + 30% minimum CGT tax floor on real gains.
  const annualRateDec = annualRatePct / 100;
  const dividendYield = 0.03;
  const assumedCpi = 0.028;
  const effectiveCgtRate = Math.max(0.3, marginalTaxDec);
  const maxYieldNet = dividendYield * (1 - marginalTaxDec);
  const etfEquivDec =
    annualRateDec <= maxYieldNet
      ? annualRateDec / (1 - marginalTaxDec)
      : annualRateDec <= maxYieldNet + assumedCpi
        ? dividendYield + (annualRateDec - maxYieldNet)
        : dividendYield +
          assumedCpi +
          (annualRateDec - maxYieldNet - assumedCpi) / (1 - effectiveCgtRate);
  const taxFreeEquivalentEtfRatePct = round2(etfEquivDec * 100);
  const breakEvenOffsetBalanceForFee =
    annualOffsetFee > 0 && annualRatePct > 0
      ? Math.round(annualOffsetFee / (annualRatePct / 100))
      : 0;

  if (loanAmount <= 0) {
    return {
      loanAmount: 0,
      annualRatePct,
      loanTermYears,
      scheduledMonthlyRepayment: 0,
      baselineTotalInterest: 0,
      offsetTotalInterest: 0,
      grossInterestSaved: 0,
      totalOffsetFeesPaid: 0,
      netInterestSavedAfterFees: 0,
      baselineMonths: 0,
      offsetMonths: 0,
      monthsSavedPayoff: 0,
      yearsSavedPayoff: 0,
      monthsToFullOffset: null,
      yearsToFullOffset: null,
      yearOneInterestSaved: 0,
      yearOneHisaAfterTaxInterest: 0,
      yearOneNetAdvantageVsHisa: 0,
      taxFreeEquivalentHisaRatePct,
      taxFreeEquivalentEtfRatePct,
      breakEvenOffsetBalanceForFee,
      finalOffsetCashBalance: Math.round(initialOffsetBalance),
      yearlySeries: [
        {
          year: 0,
          baselineLoanBalance: 0,
          offsetLoanBalance: 0,
          offsetCashBalance: Math.round(initialOffsetBalance),
          netDebtWithOffset: Math.round(-initialOffsetBalance),
          cumulativeInterestSaved: 0,
        },
      ],
    };
  }

  const totalMonths = loanTermYears * 12;
  const monthlyRate = annualRatePct / 100 / 12;
  const scheduledMonthlyPI = computeScheduledMonthlyPI(
    loanAmount,
    annualRatePct,
    loanTermYears,
  );
  const hisaAfterTaxMonthlyRate =
    Math.pow(1 + (hisaRatePct / 100) * (1 - marginalTaxDec), 1 / 12) - 1;

  const hasOffsetActivity =
    initialOffsetBalance > 0 || monthlyOffsetContribution > 0;

  let baseBal = loanAmount;
  let offBal = loanAmount;
  let offsetCash = initialOffsetBalance;
  let hisaCompareBalance = initialOffsetBalance;

  let baselineTotalInterest = 0;
  let offsetTotalInterest = 0;
  let totalOffsetFeesPaid = 0;
  let yearOneInterestSaved = 0;

  let baselineMonths = 0;
  let offsetMonths = 0;
  let monthsToFullOffset: number | null =
    initialOffsetBalance >= loanAmount ? 0 : null;

  const yearlySeries: MortgageOffsetYearPoint[] = [
    {
      year: 0,
      baselineLoanBalance: loanAmount,
      offsetLoanBalance: loanAmount,
      offsetCashBalance: Math.round(offsetCash),
      netDebtWithOffset: Math.round(Math.max(0, loanAmount - offsetCash)),
      cumulativeInterestSaved: 0,
    },
  ];

  for (let m = 1; m <= totalMonths; m++) {
    let baseInterest = 0;
    if (baseBal > 0.01) {
      baseInterest = baseBal * monthlyRate;
      const basePay = Math.min(baseBal + baseInterest, scheduledMonthlyPI);
      const basePrincipal = Math.max(0, basePay - baseInterest);
      baseBal = Math.max(0, baseBal - basePrincipal);
      baselineTotalInterest += baseInterest;
      baselineMonths = m;
    }

    offsetCash += monthlyOffsetContribution;
    if (m <= 12) {
      hisaCompareBalance =
        (hisaCompareBalance + monthlyOffsetContribution) *
        (1 + hisaAfterTaxMonthlyRate);
    }

    let offInterest = 0;
    if (offBal > 0.01) {
      if (hasOffsetActivity && annualOffsetFee > 0) {
        totalOffsetFeesPaid += annualOffsetFee / 12;
      }
      const effectiveOffset = Math.min(offBal, offsetCash);
      const chargeablePrincipal = Math.max(0, offBal - effectiveOffset);
      offInterest = chargeablePrincipal * monthlyRate;
      const offPay = Math.min(offBal + offInterest, scheduledMonthlyPI);
      const offPrincipal = Math.max(0, offPay - offInterest);
      offBal = Math.max(0, offBal - offPrincipal);
      offsetTotalInterest += offInterest;
      offsetMonths = m;

      if (hasOffsetActivity && monthsToFullOffset === null && offBal > 0.01 && offsetCash >= offBal) {
        monthsToFullOffset = m;
      } else if (hasOffsetActivity && monthsToFullOffset === null && offBal <= 0.01) {
        monthsToFullOffset = m;
      }
    }

    if (m <= 12) {
      yearOneInterestSaved += Math.max(0, baseInterest - offInterest);
    }

    if (m % 12 === 0 || (baseBal <= 0.01 && offBal <= 0.01)) {
      const yr = Math.ceil(m / 12);
      const existingLast = yearlySeries[yearlySeries.length - 1];
      if (!existingLast || existingLast.year < yr) {
        yearlySeries.push({
          year: yr,
          baselineLoanBalance: Math.round(baseBal),
          offsetLoanBalance: Math.round(offBal),
          offsetCashBalance: Math.round(offsetCash),
          netDebtWithOffset: Math.round(Math.max(0, offBal - offsetCash)),
          cumulativeInterestSaved: Math.max(
            0,
            Math.round(baselineTotalInterest - offsetTotalInterest),
          ),
        });
      }
      if (baseBal <= 0.01 && offBal <= 0.01) {
        break;
      }
    }
  }

  const grossInterestSaved = Math.max(
    0,
    Math.round(baselineTotalInterest - offsetTotalInterest),
  );
  const roundedFees = Math.round(totalOffsetFeesPaid);
  const netInterestSavedAfterFees = Math.round(
    grossInterestSaved - roundedFees,
  );
  const monthsSavedPayoff = Math.max(0, baselineMonths - offsetMonths);
  const yearsSavedPayoff = round2(monthsSavedPayoff / 12);
  const yearsToFullOffset =
    monthsToFullOffset !== null ? round2(monthsToFullOffset / 12) : null;

  const yearOneTotalDeposits =
    initialOffsetBalance + monthlyOffsetContribution * Math.min(12, totalMonths);
  const yearOneHisaAfterTaxInterest = round2(
    Math.max(0, hisaCompareBalance - yearOneTotalDeposits),
  );
  const yearOneFee = hasOffsetActivity ? annualOffsetFee : 0;
  const yearOneInterestSavedRounded = Math.round(yearOneInterestSaved);
  const yearOneNetAdvantageVsHisa = Math.round(
    yearOneInterestSavedRounded - yearOneFee - yearOneHisaAfterTaxInterest,
  );

  return {
    loanAmount,
    annualRatePct,
    loanTermYears,
    scheduledMonthlyRepayment: Math.round(scheduledMonthlyPI),
    baselineTotalInterest: Math.round(baselineTotalInterest),
    offsetTotalInterest: Math.round(offsetTotalInterest),
    grossInterestSaved,
    totalOffsetFeesPaid: roundedFees,
    netInterestSavedAfterFees,
    baselineMonths,
    offsetMonths,
    monthsSavedPayoff,
    yearsSavedPayoff,
    monthsToFullOffset,
    yearsToFullOffset,
    yearOneInterestSaved: yearOneInterestSavedRounded,
    yearOneHisaAfterTaxInterest: Math.round(yearOneHisaAfterTaxInterest),
    yearOneNetAdvantageVsHisa,
    taxFreeEquivalentHisaRatePct,
    taxFreeEquivalentEtfRatePct,
    breakEvenOffsetBalanceForFee,
    finalOffsetCashBalance: Math.round(offsetCash),
    yearlySeries,
  };
}
