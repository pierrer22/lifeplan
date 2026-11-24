import { HECS_THRESHOLDS } from '../data/auConstants';
import type {
  FinancialYear,
  HecsProjectionYear,
  HecsSimulationInput,
  HecsSummary,
} from '../types/planner';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates annual compulsory HECS-HELP repayment under the ATO marginal repayment system,
 * capped at the remaining HECS-HELP balance.
 */
export function calculateHecsRepayment(
  repaymentIncome: number,
  fy: FinancialYear,
  hecsBalance: number,
): number {
  const balance = Math.max(0, hecsBalance);
  const ri = Math.max(0, repaymentIncome);
  if (balance <= 0 || ri <= 0) {
    return 0;
  }

  const tiers = HECS_THRESHOLDS[fy];
  let rawRepayment = 0;

  for (const tier of tiers) {
    const ceiling = tier.max ?? Number.POSITIVE_INFINITY;
    if (ri <= ceiling) {
      if (tier.mode === 'nil') {
        rawRepayment = 0;
      } else if (tier.mode === 'marginal') {
        rawRepayment = tier.baseAmount + (ri - tier.over) * tier.rate;
      } else {
        rawRepayment = ri * tier.rate;
      }
      break;
    }
  }

  return round2(Math.min(balance, Math.max(0, rawRepayment)));
}

/**
 * Simulates multi-year HECS-HELP debt payoff with 1 June indexation,
 * Repayment Income add-backs (RFBA, RESC), and voluntary vs compulsory comparison.
 */
export function simulateHecsPayoff(input: HecsSimulationInput): HecsSummary {
  const startingBalance = round2(Math.max(0, input.startingBalance));
  const fy = input.financialYear;
  const rfba = Math.max(0, input.reportableFringeBenefits ?? 0);
  const resc = Math.max(0, input.reportableEmployerSuper ?? 0);
  const yearOneRepaymentIncome = round2(Math.max(0, input.grossSalary) + rfba + resc);
  const indexationRate = Math.max(0, input.indexationRatePct) / 100;
  const salaryGrowth = input.salaryGrowthPct / 100;
  const voluntaryExtraTarget = Math.max(0, input.voluntaryExtraAnnual);
  const maxYears = Math.max(1, input.maxYears ?? 30);
  const startCalendarYear = fy === '2026-27' ? 2027 : 2026;

  const fs = input.futureStudy;
  const futureStudyActive = Boolean(
    fs?.enabled &&
      fs.totalUnitsRemaining > 0 &&
      fs.unitsPerTerm > 0 &&
      fs.termsPerYear > 0,
  );
  const unitsPerYear =
    futureStudyActive && fs
      ? Math.max(1, Math.round(fs.unitsPerTerm * fs.termsPerYear))
      : 0;
  const unitsPerEftsl = Math.max(1, fs?.unitsPerEftsl ?? 8);
  const costPerUnit =
    futureStudyActive && fs
      ? Math.max(0, fs.annualFeePerEftsl) / unitsPerEftsl
      : 0;
  const totalUnitsToSchedule =
    futureStudyActive && fs
      ? Math.max(0, Math.round(fs.totalUnitsRemaining))
      : 0;
  const studyCompletionYears =
    futureStudyActive && unitsPerYear > 0
      ? Math.ceil(totalUnitsToSchedule / unitsPerYear)
      : 0;

  if (startingBalance <= 0 && !futureStudyActive) {
    return {
      startingBalance: 0,
      yearOneCompulsoryRepayment: 0,
      yearOneRepaymentIncome,
      yearOneIndexation: 0,
      yearsToPayoff: 0,
      baselineYearsToPayoff: 0,
      yearsSavedWithExtra: 0,
      totalInterestIndexationPaid: 0,
      totalPaid: 0,
      indexationSavedWithExtra: 0,
      totalNewStudyDebtAdded: 0,
      totalNewTuitionAdded: 0,
      totalNewSsafAdded: 0,
      peakBalance: 0,
      peakBalanceCalendarYear: null,
      studyCompletionYears: 0,
      projections: [],
      notes: ['No HECS-HELP debt remaining.'],
    };
  }

  const projections: HecsProjectionYear[] = [];
  let balance = startingBalance;
  let baselineBalance = startingBalance;
  let remainingUnits = totalUnitsToSchedule;
  let cumulativeRepaid = 0;
  let totalInterestIndexationPaid = 0;
  let baselineTotalIndexation = 0;
  let totalNewTuitionAdded = 0;
  let totalNewSsafAdded = 0;
  let totalNewStudyDebtAdded = 0;
  let peakBalance = startingBalance;
  let peakBalanceCalendarYear: number | null =
    startingBalance > 0 ? startCalendarYear : null;
  let yearsToPayoff: number | null = null;
  let baselineYearsToPayoff: number | null = null;

  for (let yearIndex = 1; yearIndex <= maxYears; yearIndex++) {
    const salary = round2(Math.max(0, input.grossSalary) * Math.pow(1 + salaryGrowth, yearIndex - 1));
    const repaymentIncome = round2(salary + rfba + resc);
    const calendarYear = startCalendarYear + yearIndex - 1;

    // Future study / Masters debt incurred in this year (tuition + optional SSAF)
    const unitsCompletedThisYear =
      remainingUnits > 0 ? Math.min(remainingUnits, unitsPerYear) : 0;
    const tuitionAddedThisYear = round2(unitsCompletedThisYear * costPerUnit);
    const ssafAddedThisYear =
      futureStudyActive && fs?.includeSsaf && unitsCompletedThisYear > 0 && unitsPerYear > 0
        ? round2(
            Math.max(0, fs.ssafAnnualAmount) *
              Math.min(1, unitsCompletedThisYear / unitsPerYear),
          )
        : 0;
    const newDebtAdded = round2(tuitionAddedThisYear + ssafAddedThisYear);
    remainingUnits -= unitsCompletedThisYear;

    totalNewTuitionAdded = round2(totalNewTuitionAdded + tuitionAddedThisYear);
    totalNewSsafAdded = round2(totalNewSsafAdded + ssafAddedThisYear);
    totalNewStudyDebtAdded = round2(totalNewStudyDebtAdded + newDebtAdded);

    // Active scenario: ATO indexes aged balance (11+ months) on 1 June before same-year new debt is added
    const openingBalance = balance;
    const voluntaryBeforeIndexation =
      openingBalance > 0 ? round2(Math.min(openingBalance, voluntaryExtraTarget)) : 0;
    const balanceBeforeIndexation = Math.max(0, openingBalance - voluntaryBeforeIndexation);
    const indexationAdded = round2(balanceBeforeIndexation * indexationRate);
    const remainingVoluntary = round2(Math.max(0, voluntaryExtraTarget - voluntaryBeforeIndexation));
    const voluntaryOnNewDebt =
      newDebtAdded > 0 ? round2(Math.min(newDebtAdded, remainingVoluntary)) : 0;
    const voluntaryExtra = round2(voluntaryBeforeIndexation + voluntaryOnNewDebt);
    const balanceAfterAdditions = round2(
      balanceBeforeIndexation + indexationAdded + newDebtAdded - voluntaryOnNewDebt,
    );
    const compulsoryRepayment = calculateHecsRepayment(
      repaymentIncome,
      fy,
      balanceAfterAdditions,
    );
    const closingBalance = round2(Math.max(0, balanceAfterAdditions - compulsoryRepayment));

    totalInterestIndexationPaid = round2(totalInterestIndexationPaid + indexationAdded);
    cumulativeRepaid = round2(cumulativeRepaid + voluntaryExtra + compulsoryRepayment);

    // Baseline scenario (no voluntary extra)
    const baseIndexation = round2(baselineBalance * indexationRate);
    const baseAfterAdditions = round2(baselineBalance + baseIndexation + newDebtAdded);
    const baseCompulsory = calculateHecsRepayment(repaymentIncome, fy, baseAfterAdditions);
    const baselineClosingBalance = round2(Math.max(0, baseAfterAdditions - baseCompulsory));
    baselineTotalIndexation = round2(baselineTotalIndexation + baseIndexation);

    if (closingBalance > peakBalance) {
      peakBalance = closingBalance;
      peakBalanceCalendarYear = calendarYear;
    }

    if (remainingUnits === 0 && yearsToPayoff === null && closingBalance <= 0.01) {
      yearsToPayoff = yearIndex;
    }
    if (
      remainingUnits === 0 &&
      baselineYearsToPayoff === null &&
      baselineClosingBalance <= 0.01
    ) {
      baselineYearsToPayoff = yearIndex;
    }

    projections.push({
      yearIndex,
      calendarYear,
      salary,
      repaymentIncome,
      openingBalance,
      unitsCompletedThisYear,
      tuitionAddedThisYear,
      ssafAddedThisYear,
      newDebtAdded,
      indexationAdded,
      compulsoryRepayment,
      voluntaryExtra,
      closingBalance,
      cumulativeRepaid,
      baselineClosingBalance,
    });

    balance = closingBalance;
    baselineBalance = baselineClosingBalance;

    if (remainingUnits === 0 && balance <= 0.01 && baselineBalance <= 0.01) {
      break;
    }
  }

  const yearOne = projections[0];
  const yearsSavedWithExtra =
    yearsToPayoff !== null && baselineYearsToPayoff !== null
      ? Math.max(0, baselineYearsToPayoff - yearsToPayoff)
      : yearsToPayoff !== null && baselineYearsToPayoff === null
        ? Math.max(0, maxYears - yearsToPayoff)
        : 0;
  const indexationSavedWithExtra = round2(
    Math.max(0, baselineTotalIndexation - totalInterestIndexationPaid),
  );

  const notes: string[] = [];
  if (yearOne && yearOne.compulsoryRepayment === 0) {
    const threshold = HECS_THRESHOLDS[fy][0].max ?? 69528;
    notes.push(
      `Year 1 Repayment Income ($${Math.round(yearOneRepaymentIncome).toLocaleString()}) is below the $${threshold.toLocaleString()} FY${fy} threshold ($0 compulsory repayment).`,
    );
  } else if (yearOne) {
    notes.push(
      `Under FY${fy} marginal HECS-HELP rules, Year 1 compulsory repayment is $${yearOne.compulsoryRepayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
    );
  }

  if (totalNewStudyDebtAdded > 0) {
    notes.push(
      `Future study adds ${totalUnitsToSchedule} units over ${studyCompletionYears} yr(s): $${Math.round(totalNewTuitionAdded).toLocaleString()} tuition + $${Math.round(totalNewSsafAdded).toLocaleString()} SSAF = $${Math.round(totalNewStudyDebtAdded).toLocaleString()} total (same-year additions are exempt from 1 June indexation until aged 11+ months).`,
    );
  }

  if (rfba > 0 || resc > 0) {
    notes.push(
      `Repayment Income includes $${Math.round(rfba + resc).toLocaleString()} in RFBA/reportable super add-backs.`,
    );
  }

  if (voluntaryExtraTarget > 0) {
    notes.push(
      `Voluntary repayments of $${Math.round(voluntaryExtraTarget).toLocaleString()}/yr before 1 June save $${Math.round(indexationSavedWithExtra).toLocaleString()} in indexation${yearsSavedWithExtra > 0 ? ` and ${yearsSavedWithExtra} year(s)` : ''}.`,
    );
  } else {
    notes.push(
      `HECS-HELP is indexed at ${input.indexationRatePct.toFixed(1)}% p.a. on 1 June; extra repayments before 1 June reduce the indexed principal.`,
    );
  }

  return {
    startingBalance,
    yearOneCompulsoryRepayment: yearOne?.compulsoryRepayment ?? 0,
    yearOneRepaymentIncome,
    yearOneIndexation: yearOne?.indexationAdded ?? 0,
    yearsToPayoff,
    baselineYearsToPayoff,
    yearsSavedWithExtra,
    totalInterestIndexationPaid,
    totalPaid: cumulativeRepaid,
    indexationSavedWithExtra,
    totalNewStudyDebtAdded,
    totalNewTuitionAdded,
    totalNewSsafAdded,
    peakBalance,
    peakBalanceCalendarYear,
    studyCompletionYears,
    projections,
    notes,
  };
}
