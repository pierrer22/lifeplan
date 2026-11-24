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

  if (startingBalance <= 0) {
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
      projections: [],
      notes: ['No HECS-HELP debt remaining.'],
    };
  }

  const projections: HecsProjectionYear[] = [];
  let balance = startingBalance;
  let baselineBalance = startingBalance;
  let cumulativeRepaid = 0;
  let totalInterestIndexationPaid = 0;
  let baselineTotalIndexation = 0;
  let yearsToPayoff: number | null = null;
  let baselineYearsToPayoff: number | null = null;

  for (let yearIndex = 1; yearIndex <= maxYears; yearIndex++) {
    const salary = round2(Math.max(0, input.grossSalary) * Math.pow(1 + salaryGrowth, yearIndex - 1));
    const repaymentIncome = round2(salary + rfba + resc);

    // Active scenario (with optional voluntary extra paid before 1 June indexation)
    const openingBalance = balance;
    const voluntaryExtra =
      openingBalance > 0 ? round2(Math.min(openingBalance, voluntaryExtraTarget)) : 0;
    const balanceBeforeIndexation = Math.max(0, openingBalance - voluntaryExtra);
    const indexationAdded = round2(balanceBeforeIndexation * indexationRate);
    const balanceAfterIndexation = round2(balanceBeforeIndexation + indexationAdded);
    const compulsoryRepayment = calculateHecsRepayment(
      repaymentIncome,
      fy,
      balanceAfterIndexation,
    );
    const closingBalance = round2(Math.max(0, balanceAfterIndexation - compulsoryRepayment));

    totalInterestIndexationPaid = round2(totalInterestIndexationPaid + indexationAdded);
    cumulativeRepaid = round2(cumulativeRepaid + voluntaryExtra + compulsoryRepayment);

    // Baseline scenario (no voluntary extra)
    const baseIndexation = round2(baselineBalance * indexationRate);
    const baseAfterIndexation = round2(baselineBalance + baseIndexation);
    const baseCompulsory = calculateHecsRepayment(repaymentIncome, fy, baseAfterIndexation);
    const baselineClosingBalance = round2(Math.max(0, baseAfterIndexation - baseCompulsory));
    baselineTotalIndexation = round2(baselineTotalIndexation + baseIndexation);

    if (yearsToPayoff === null && closingBalance <= 0.01) {
      yearsToPayoff = yearIndex;
    }
    if (baselineYearsToPayoff === null && baselineClosingBalance <= 0.01) {
      baselineYearsToPayoff = yearIndex;
    }

    projections.push({
      yearIndex,
      calendarYear: startCalendarYear + yearIndex - 1,
      salary,
      repaymentIncome,
      openingBalance,
      indexationAdded,
      compulsoryRepayment,
      voluntaryExtra,
      closingBalance,
      cumulativeRepaid,
      baselineClosingBalance,
    });

    balance = closingBalance;
    baselineBalance = baselineClosingBalance;

    if (balance <= 0.01 && baselineBalance <= 0.01) {
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
    projections,
    notes,
  };
}
