import { HECS_DEFAULT_INDEXATION_PCT } from '../data/auConstants';
import type {
  ForwardScenarioInput,
  ForwardScenarioSummary,
  ForwardScenarioYearBlock,
} from '../types/planner';
import { calculateHecsRepayment } from './hecs';
import { evaluateMortgageApproval } from './mortgageApproval';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Projects 1-year blocks across a forward horizon accounting for annual salary growth,
 * optional Masters completion salary uplift, year-by-year HECS-HELP paydown (plus any
 * remaining future study additions), deposit accumulation, and updated borrowing power.
 */
export function calculateForwardScenarios(
  input: ForwardScenarioInput,
): ForwardScenarioSummary {
  const { profile } = input;
  const horizonYears = Math.max(1, Math.min(10, Math.round(input.horizonYears ?? 5)));
  const startCalendarYear = profile.financialYear === '2026-27' ? 2027 : 2026;
  const includeMastersUplift = input.includeMastersUplift ?? true;
  const mastersUpliftPct = Math.max(0, input.mastersUpliftPct ?? 12);

  const fs = profile.hecsFutureStudy;
  const hasFutureUnits = Boolean(
    fs?.enabled &&
      fs.totalUnitsRemaining > 0 &&
      fs.unitsPerTerm > 0 &&
      fs.termsPerYear > 0,
  );
  const inferredMastersYear = hasFutureUnits && fs
    ? Math.ceil(fs.totalUnitsRemaining / Math.max(1, fs.unitsPerTerm * fs.termsPerYear))
    : profile.studyPlan.studyMode !== 'none' && profile.studyPlan.durationYears > 0
      ? Math.max(1, Math.ceil(profile.studyPlan.durationYears))
      : 2;

  const mastersCompletionYear = Math.max(
    1,
    Math.min(horizonYears, Math.round(input.mastersCompletionYear ?? inferredMastersYear)),
  );

  const salaryGrowthDec = Math.max(
    0,
    (input.salaryGrowthPct ?? profile.salaryGrowthPct) / 100,
  );
  const indexationRate = HECS_DEFAULT_INDEXATION_PCT / 100;
  const returnRateDec = Math.max(0, profile.investmentReturnPct / 100);
  const voluntaryExtraTarget = Math.max(
    0,
    input.voluntaryExtraHecsAnnual ?? profile.hecsVoluntaryExtraAnnual,
  );

  let currentSalary = Math.max(0, input.startingSalary ?? profile.grossSalary);
  let hecsBal = Math.max(0, input.startingHecsBalance ?? profile.hecsBalance);
  let liquidDeposit = Math.max(
    0,
    input.depositAmountNow ?? profile.currentCashSavings + profile.currentInvestments,
  );
  const annualSavings = Math.max(0, input.annualSavingsCapacity ?? 0);

  // Track any remaining study units + SSL lots if profile.hecsFutureStudy is active
  let remainingUnits =
    hasFutureUnits && fs ? Math.max(0, Math.round(fs.totalUnitsRemaining)) : 0;
  const unitsPerYear =
    hasFutureUnits && fs ? Math.max(1, Math.round(fs.unitsPerTerm * fs.termsPerYear)) : 0;
  const costPerUnit =
    hasFutureUnits && fs
      ? Math.max(0, fs.annualFeePerEftsl) / Math.max(1, fs.unitsPerEftsl)
      : 0;
  let remainingSsl =
    fs?.enabled && fs.includeSsl && (fs.sslInstalments ?? 0) > 0
      ? Math.max(0, Math.round(fs.sslInstalments ?? 0))
      : 0;
  const sslAmount = Math.max(0, fs?.sslAmountPerInstalment ?? 1349);

  const propertyPrice = Math.max(50000, input.propertyPrice ?? profile.targetPropertyPrice);
  const interestRatePct = input.interestRatePct ?? profile.targetMortgageRatePct;
  const apraBufferPct = input.apraBufferPct ?? 3.0;
  const loanTermYears = input.loanTermYears ?? 30;
  const creditCardLimitsTotal = input.creditCardLimitsTotal ?? 10000;
  const existingMonthlyDebtRepayments = input.existingMonthlyDebtRepayments ?? 0;
  const monthlyLivingExpenses =
    input.monthlyLivingExpenses ?? profile.currentMonthlyLivingExpenses;
  const creditScoreBand = input.creditScoreBand ?? 'very_good';
  const bonusOrOtherIncomeAnnual = input.bonusOrOtherIncomeAnnual ?? 0;
  const novatedLeaseAnnualPreTax = input.novatedLeaseAnnualPreTax ?? 0;

  const blocks: ForwardScenarioYearBlock[] = [];
  let baselineBorrowingNow = 0;

  for (let year = 0; year <= horizonYears; year++) {
    let mastersJustCompleted = false;
    let annualHecsRepayment = 0;

    if (year > 0) {
      currentSalary = Math.round(currentSalary * (1 + salaryGrowthDec));
      if (includeMastersUplift && year === mastersCompletionYear) {
        currentSalary = Math.round(currentSalary * (1 + mastersUpliftPct / 100));
        mastersJustCompleted = true;
      }

      // 1-year HECS-HELP progression (with future study additions if enabled)
      const unitsThisYr =
        remainingUnits > 0 ? Math.min(remainingUnits, unitsPerYear) : 0;
      const tuitionThisYr = round2(unitsThisYr * costPerUnit);
      const ssafThisYr =
        hasFutureUnits && fs?.includeSsaf && unitsThisYr > 0 && unitsPerYear > 0
          ? round2(
              Math.max(0, fs.ssafAnnualAmount) *
                Math.min(1, unitsThisYr / unitsPerYear),
            )
          : 0;
      const sslLotsThisYr = remainingSsl > 0 ? Math.min(remainingSsl, 2) : 0;
      const sslThisYr = round2(sslLotsThisYr * sslAmount);
      const newStudyDebt = round2(tuitionThisYr + ssafThisYr + sslThisYr);
      remainingUnits -= unitsThisYr;
      remainingSsl -= sslLotsThisYr;

      const voluntaryBeforeIdx =
        hecsBal > 0 ? round2(Math.min(hecsBal, voluntaryExtraTarget)) : 0;
      const beforeIdx = Math.max(0, hecsBal - voluntaryBeforeIdx);
      const indexation = round2(beforeIdx * indexationRate);
      const remainingVol = round2(Math.max(0, voluntaryExtraTarget - voluntaryBeforeIdx));
      const volOnNew = newStudyDebt > 0 ? round2(Math.min(newStudyDebt, remainingVol)) : 0;
      const afterAdd = round2(beforeIdx + indexation + newStudyDebt - volOnNew);

      const ri = round2(
        currentSalary + bonusOrOtherIncomeAnnual * 0.8 + profile.salarySacrificeAnnual,
      );
      const compulsory = calculateHecsRepayment(ri, profile.financialYear, afterAdd);
      hecsBal = round2(Math.max(0, afterAdd - compulsory));
      annualHecsRepayment = Math.round(compulsory + voluntaryBeforeIdx + volOnNew);

      liquidDeposit = Math.round(liquidDeposit * (1 + returnRateDec) + annualSavings);
    } else {
      const ri0 = round2(
        currentSalary + bonusOrOtherIncomeAnnual * 0.8 + profile.salarySacrificeAnnual,
      );
      annualHecsRepayment = Math.round(
        calculateHecsRepayment(ri0, profile.financialYear, hecsBal),
      );
    }

    const mastersAttained = includeMastersUplift && year >= mastersCompletionYear;
    const approval = evaluateMortgageApproval({
      financialYear: profile.financialYear,
      state: profile.state,
      cityLabel: profile.cityLabel,
      relationshipStatus: profile.relationshipStatus,
      dependents: profile.dependents,
      employmentStatus:
        year > 0 && profile.employmentStatus === 'studying_austudy'
          ? 'full_time'
          : profile.employmentStatus,
      grossSalary: currentSalary,
      partnerGrossSalary: profile.partnerGrossSalary,
      bonusOrOtherIncomeAnnual,
      hasPrivateHospitalCover: profile.hasPrivateHospitalCover,
      hecsBalance: hecsBal,
      monthlyLivingExpenses,
      creditCardLimitsTotal,
      existingMonthlyDebtRepayments,
      novatedLeaseAnnualPreTax,
      propertyPrice,
      depositAmount: Math.min(propertyPrice, liquidDeposit),
      isFirstHomeBuyer: profile.isFirstHomeBuyer,
      isNewHome: profile.isNewHome,
      interestRatePct,
      apraBufferPct,
      loanTermYears,
      creditScoreBand,
    });

    if (year === 0) {
      baselineBorrowingNow = approval.maxBorrowingPower;
    }

    blocks.push({
      year,
      calendarYear: startCalendarYear + year,
      label: year === 0 ? 'Now' : `Yr ${year} (${startCalendarYear + year})`,
      grossSalary: Math.round(currentSalary),
      mastersAttained,
      mastersJustCompleted,
      hecsBalance: Math.round(hecsBal),
      hecsAnnualRepayment: annualHecsRepayment,
      maxBorrowingPower: approval.maxBorrowingPower,
      borrowingDeltaVsNow: approval.maxBorrowingPower - baselineBorrowingNow,
      approvalScore: approval.approvalScore,
      verdict: approval.verdict,
      dtiRatio: approval.dtiRatio,
      projectedLiquidDeposit: Math.round(liquidDeposit),
      maxPropertyBudget: approval.maxBorrowingPower + Math.round(liquidDeposit),
    });
  }

  const last = blocks[blocks.length - 1];
  const first = blocks[0];
  return {
    blocks,
    mastersCompletionYear,
    mastersUpliftPct,
    fiveYearBorrowingGain: last.maxBorrowingPower - first.maxBorrowingPower,
    fiveYearHecsReduction: Math.max(0, first.hecsBalance - last.hecsBalance),
  };
}
