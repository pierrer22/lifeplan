import { HECS_DEFAULT_INDEXATION_PCT, SUPER_CONSTANTS } from '../data/auConstants';
import type {
  ActionHorizon,
  ActionStep,
  GoalReadiness,
  LifePlanSummary,
  NetWorthProjectionPoint,
  PlannerProfile,
} from '../types/planner';
import { analyzeEducationRoi } from './education';
import { analyzeCareerPathway } from './employment';
import { simulateHecsPayoff } from './hecs';
import {
  calculateHouseDepositPlan,
  calculateRentBudgetPlan,
  solveRequiredGrossIncome,
} from './housing';
import { calculateNovatedLease } from './novatedLease';
import { calculateSuperAndFhsss } from './super';
import { calculateTax } from './tax';

const HORIZON_ORDER: Record<ActionHorizon, number> = {
  Immediate: 0,
  '1-12 Months': 1,
  '1-3 Years': 2,
  '3+ Years': 3,
};

const PRIORITY_ORDER: Record<ActionStep['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function buildGoalReadiness(
  profile: PlannerProfile,
  summary: {
    estimatedYearsToReady: number;
    mortgageStressPctOfNetIncome: number;
    savingsRatePct: number;
    rentToNetIncomePct: number;
    projectedSuperAt60: number;
    hecsYearsToPayoff: number | null;
    requiredIncome: number;
    householdGross: number;
  },
): GoalReadiness {
  const timeRatio =
    summary.estimatedYearsToReady <= profile.targetHomeYears
      ? 1
      : profile.targetHomeYears / Math.max(profile.targetHomeYears, summary.estimatedYearsToReady);
  const timePts = 60 * timeRatio;

  const stress = summary.mortgageStressPctOfNetIncome;
  const stressPts =
    stress <= 30 ? 40 : stress <= 42 ? 40 - ((stress - 30) / 12) * 25 : Math.max(0, 15 - (stress - 42));
  const housingReadinessPct = Math.round(Math.min(100, Math.max(0, timePts + stressPts)));

  const savingsPts = Math.min(60, Math.max(0, (summary.savingsRatePct / 25) * 60));
  const rentPct = summary.rentToNetIncomePct;
  const rentPts =
    rentPct <= 25 ? 40 : rentPct <= 35 ? 40 - ((rentPct - 25) / 10) * 25 : Math.max(0, 15 - (rentPct - 35));
  const cashflowHealthPct = Math.round(Math.min(100, Math.max(0, savingsPts + rentPts)));

  const superBenchmark = profile.relationshipStatus === 'couple' ? 850000 : 650000;
  const retirementTrajectoryPct = Math.round(
    Math.min(100, Math.max(0, (summary.projectedSuperAt60 / superBenchmark) * 100)),
  );

  let hecsTrajectoryPct = 100;
  if (profile.hecsBalance > 0) {
    if (summary.hecsYearsToPayoff === null) {
      hecsTrajectoryPct = profile.employmentStatus === 'studying_austudy' ? 45 : 25;
    } else if (summary.hecsYearsToPayoff <= 5) {
      hecsTrajectoryPct = 95;
    } else if (summary.hecsYearsToPayoff <= 10) {
      hecsTrajectoryPct = 82;
    } else if (summary.hecsYearsToPayoff <= 15) {
      hecsTrajectoryPct = 68;
    } else {
      hecsTrajectoryPct = 52;
    }
  }

  const overallScore = Math.round(
    0.35 * housingReadinessPct +
      0.3 * cashflowHealthPct +
      0.2 * retirementTrajectoryPct +
      0.15 * hecsTrajectoryPct,
  );

  const statusLabel: GoalReadiness['statusLabel'] =
    overallScore >= 72 ? 'On Track' : overallScore >= 48 ? 'Needs Adjustment' : 'Stretch Goal';

  const summaryHeadline =
    statusLabel === 'On Track'
      ? `On track for your $${profile.targetPropertyPrice.toLocaleString('en-AU')} home in ~${summary.estimatedYearsToReady.toFixed(1)} yrs with ${summary.savingsRatePct.toFixed(0)}% savings rate.`
      : statusLabel === 'Needs Adjustment'
        ? `Close to target (${summary.estimatedYearsToReady.toFixed(1)} yrs to deposit vs ${profile.targetHomeYears}-yr goal); FHSSS, super, or income growth will bridge the gap.`
        : `Stretch goal on current income ($${summary.householdGross.toLocaleString('en-AU')}/yr vs ~$${summary.requiredIncome.toLocaleString('en-AU')}/yr needed); career progression or study transition is the key lever.`;

  return {
    overallScore,
    statusLabel,
    housingReadinessPct,
    cashflowHealthPct,
    retirementTrajectoryPct,
    hecsTrajectoryPct,
    summaryHeadline,
  };
}

function buildNetWorthProjection(
  profile: PlannerProfile,
  annualSavingsCapacity: number,
  superSeries: LifePlanSummary['superSummary']['projectionSeries'],
  hecsProjections: LifePlanSummary['hecs']['projections'],
  houseDeposit: LifePlanSummary['houseDeposit'],
): NetWorthProjectionPoint[] {
  const points: NetWorthProjectionPoint[] = [];
  const invReturn = profile.investmentReturnPct / 100;
  const purchaseYear =
    houseDeposit.estimatedYearsToReady <= 10
      ? Math.max(1, Math.ceil(houseDeposit.estimatedYearsToReady))
      : null;

  let liquid = profile.currentCashSavings + profile.currentInvestments;
  let remainingMortgage = 0;
  const mortgageRate = profile.targetMortgageRatePct / 100;
  const annualMortgagePmt = houseDeposit.monthlyMortgageRepayment * 12;

  for (let year = 0; year <= 10; year++) {
    if (year > 0) {
      liquid = liquid * (1 + invReturn) + annualSavingsCapacity;
      if (purchaseYear !== null && year === purchaseYear) {
        liquid = Math.max(0, liquid - houseDeposit.totalUpfrontCashRequired);
        remainingMortgage = houseDeposit.loanAmount;
      } else if (purchaseYear !== null && year > purchaseYear && remainingMortgage > 0) {
        const interest = remainingMortgage * mortgageRate;
        const principalPaid = Math.max(0, annualMortgagePmt - interest);
        remainingMortgage = Math.max(0, remainingMortgage - principalPaid);
      }
    }

    const superPoint = superSeries.find((s) => s.year === year);
    const superBalance = superPoint ? Math.round(superPoint.balanceWithSacrifice) : profile.currentSuperBalance;

    let homeEquityEstimated = 0;
    if (purchaseYear !== null && year >= purchaseYear) {
      const yearsHeld = year - purchaseYear;
      const estHomeValue = profile.targetPropertyPrice * Math.pow(1.04, yearsHeld);
      homeEquityEstimated = Math.round(Math.max(0, estHomeValue - remainingMortgage));
    }

    const hecsDebt =
      year === 0
        ? profile.hecsBalance
        : hecsProjections[year - 1]?.closingBalance ?? 0;

    const netWorth = Math.round(liquid + superBalance + homeEquityEstimated - hecsDebt);

    points.push({
      year,
      age: profile.age + year,
      liquidAndInvestments: Math.round(liquid),
      superBalance,
      homeEquityEstimated,
      hecsDebt: Math.round(hecsDebt),
      netWorth,
    });
  }

  return points;
}

function buildActionPlan(
  profile: PlannerProfile,
  plan: Omit<LifePlanSummary, 'readiness' | 'actionPlan' | 'netWorthProjection'>,
): ActionStep[] {
  const steps: ActionStep[] = [];

  if (plan.tax.medicareLevySurcharge > 0 && !profile.hasPrivateHospitalCover) {
    steps.push({
      id: 'mls-hospital-cover',
      horizon: 'Immediate',
      category: 'tax',
      title: 'Review Basic Hospital Cover vs MLS',
      description: `Your MLS income ($${plan.tax.mlsIncome.toLocaleString('en-AU')}) triggers $${Math.round(plan.tax.medicareLevySurcharge).toLocaleString('en-AU')}/yr Medicare Levy Surcharge (${plan.tax.mlsRatePct}%). Compare a basic compliant hospital policy before 30 June.`,
      estimatedAnnualImpactAud: Math.round(plan.tax.medicareLevySurcharge),
      priority: 'high',
    });
  }

  if (
    profile.novatedLease.enabled &&
    (plan.novatedLease.hecsImpactAnnual > 0 || plan.novatedLease.mlsImpactAnnual > 0)
  ) {
    const knockOn = Math.round(
      plan.novatedLease.hecsImpactAnnual + plan.novatedLease.mlsImpactAnnual,
    );
    steps.push({
      id: 'novated-rfba-knockon',
      horizon: 'Immediate',
      category: 'novated',
      title: 'Account for EV RFBA Knock-On to HECS & MLS',
      description: `Your $${Math.round(plan.novatedLease.rfbaAmount).toLocaleString('en-AU')} Reportable Fringe Benefit adds $${knockOn.toLocaleString('en-AU')}/yr in extra HECS/MLS charges, reducing net lease savings to $${Math.round(plan.novatedLease.netSavingsVsCashOverTerm).toLocaleString('en-AU')} over the term.`,
      estimatedAnnualImpactAud: knockOn,
      priority: 'high',
    });
  } else if (!profile.novatedLease.enabled && profile.grossSalary >= 90000) {
    steps.push({
      id: 'ev-april-2027-window',
      horizon: '1-12 Months',
      category: 'novated',
      title: 'Check 1 April 2027 EV FBT Transition if Buying a Car',
      description: `EVs <=$75,000 remain 100% FBT-exempt, while EVs $75,001–LCT move to a 15% statutory rate from 1 April 2027. Always verify RFBA impact on HECS/MLS before signing.`,
      estimatedAnnualImpactAud: 2200,
      priority: 'low',
    });
  }

  if (plan.rentBudget.rentStressLevel !== 'comfortable') {
    const targetMonthlyRent = plan.rentBudget.householdNetMonthlyIncome * 0.28;
    const annualSaving = Math.max(
      0,
      Math.round((plan.rentBudget.monthlyRent - targetMonthlyRent) * 12),
    );
    steps.push({
      id: 'rent-stress-trim',
      horizon: 'Immediate',
      category: 'budget',
      title: 'Reduce Rent Below 30% Net Income Stress Line',
      description: `Current rent ($${profile.currentWeeklyRent}/wk) consumes ${plan.rentBudget.rentToNetIncomePct.toFixed(1)}% of net income (${plan.rentBudget.rentStressLevel}). Targeting <=$${Math.round(targetMonthlyRent / 4.333)}/wk frees ~$${annualSaving.toLocaleString('en-AU')}/yr for your deposit.`,
      estimatedAnnualImpactAud: annualSaving,
      priority: 'high',
    });
  }

  if (profile.isFirstHomeBuyer && profile.grossSalary >= 50000 && profile.salarySacrificeAnnual < 15000) {
    const headroom = Math.min(
      15000 - profile.salarySacrificeAnnual,
      Math.max(0, plan.superSummary.remainingCapSpace),
    );
    const estTaxSave = Math.round(
      headroom * Math.max(0, plan.tax.effectiveMarginalRateWithMedicare - SUPER_CONSTANTS.contributionsTaxRate),
    );
    if (estTaxSave > 500) {
      steps.push({
        id: 'fhsss-salary-sacrifice',
        horizon: '1-12 Months',
        category: 'super',
        title: 'Maximize FHSSS Concessional Contributions ($15k/yr)',
        description: `Salary sacrificing an extra $${Math.round(headroom).toLocaleString('en-AU')}/yr into super for FHSSS saves ~$${estTaxSave.toLocaleString('en-AU')}/yr in tax vs a standard bank account (up to $50k lifetime).`,
        estimatedAnnualImpactAud: estTaxSave,
        priority: 'high',
      });
    }
  }

  if (
    profile.carryForwardUnusedCap > 0 &&
    profile.currentSuperBalance < SUPER_CONSTANTS.carryForwardTsbLimit &&
    profile.grossSalary >= 90000
  ) {
    const maxExtra = Math.min(profile.carryForwardUnusedCap, 15000);
    const estTaxSave = Math.round(
      maxExtra * Math.max(0, plan.tax.effectiveMarginalRateWithMedicare - SUPER_CONSTANTS.contributionsTaxRate),
    );
    steps.push({
      id: 'carry-forward-super',
      horizon: '1-3 Years',
      category: 'super',
      title: 'Utilize Carry-Forward Unused Concessional Cap',
      description: `With super under $500k and $${profile.carryForwardUnusedCap.toLocaleString('en-AU')} unused cap, you can top up above the $${plan.superSummary.concessionalCap.toLocaleString('en-AU')} annual cap in high-income years.`,
      estimatedAnnualImpactAud: estTaxSave,
      priority: 'medium',
    });
  }

  if (profile.hecsBalance > 0) {
    if (
      profile.hecsVoluntaryExtraAnnual > 0 &&
      profile.investmentReturnPct > HECS_DEFAULT_INDEXATION_PCT
    ) {
      const oppGain = Math.round(
        profile.hecsVoluntaryExtraAnnual *
          ((profile.investmentReturnPct - HECS_DEFAULT_INDEXATION_PCT) / 100),
      );
      steps.push({
        id: 'hecs-vs-invest',
        horizon: '1-12 Months',
        category: 'hecs',
        title: 'Compare Voluntary HECS vs Offset / ETF Returns',
        description: `Your ${profile.investmentReturnPct}% expected investment return exceeds the ${HECS_DEFAULT_INDEXATION_PCT}% HECS indexation rate; redirecting $${profile.hecsVoluntaryExtraAnnual.toLocaleString('en-AU')}/yr voluntary extra could build deposit liquidity faster.`,
        estimatedAnnualImpactAud: Math.max(200, oppGain),
        priority: 'medium',
      });
    } else if (plan.hecs.yearsToPayoff !== null && plan.hecs.yearsToPayoff <= 4) {
      steps.push({
        id: 'hecs-pre-june-payoff',
        horizon: '1-3 Years',
        category: 'hecs',
        title: 'Time Final HECS Payoff Before 1 June Indexation',
        description: `Your HECS clears in ~${plan.hecs.yearsToPayoff} yrs. Making the final lump-sum before late May in the payoff year avoids 1 June indexation on the closing balance.`,
        estimatedAnnualImpactAud: Math.round(plan.hecs.yearOneIndexation),
        priority: 'low',
      });
    }
  }

  if (profile.studyPlan.studyMode !== 'none') {
    steps.push({
      id: 'study-roi-csp',
      horizon: 'Immediate',
      category: 'career',
      title: profile.studyPlan.isCsp
        ? 'Lock In CSP Place & Austudy / Grad Transition'
        : 'Switch Full-Fee Study to CSP or Part-Time Mode',
      description: profile.studyPlan.isCsp
        ? `Your CSP plan saves $${plan.educationRoi.cspVsFullFeeSavings.toLocaleString('en-AU')} in tuition vs Full-Fee and targets $${plan.educationRoi.expectedPostStudyGrossIncome.toLocaleString('en-AU')}/yr post-grad.`
        : `Full-Fee adds $${plan.educationRoi.tuitionTotalAddedToHecs.toLocaleString('en-AU')} to HECS; securing a CSP saves $${plan.educationRoi.cspVsFullFeeSavings.toLocaleString('en-AU')}.`,
      estimatedAnnualImpactAud: Math.max(
        1000,
        Math.round(plan.educationRoi.selectedScenario.incomeUpliftAnnual),
      ),
      priority: 'high',
    });
  }

  if (
    plan.careerPathway.incomeGapToGoals > 0 ||
    profile.state === 'NSW'
  ) {
    const cbrDelta = plan.careerPathway.cityComparison.netDisposableDeltaCanberraVsSydneyAnnual;
    steps.push({
      id: 'career-canberra-aps',
      horizon: '1-3 Years',
      category: 'career',
      title:
        profile.state === 'NSW'
          ? 'Evaluate Canberra APS Relocation ($0 FHB Duty + Lower Rent)'
          : 'Target Next Band Progression & 15.4% Super Packages',
      description:
        profile.state === 'NSW'
          ? `Canberra offers ${cbrDelta >= 0 ? '+' : '-'}$${Math.abs(cbrDelta).toLocaleString('en-AU')}/yr net cashflow after rent vs Sydney, $0 ACT FHB stamp duty (no cap), and 15.4% APS super.`
          : `Closing the $${plan.careerPathway.incomeGapToGoals.toLocaleString('en-AU')}/yr income gap puts you in the ${plan.careerPathway.milestones[1]?.label ?? 'mid-career'} band and accelerates borrowing capacity.`,
      estimatedAnnualImpactAud: Math.max(3000, Math.abs(cbrDelta)),
      priority: plan.careerPathway.incomeGapToGoals > 0 ? 'high' : 'medium',
    });
  }

  const hgsOption = plan.houseDeposit.strategyComparisons.find((s) => s.strategy === '5_hgs');
  if (profile.isFirstHomeBuyer && hgsOption && hgsOption.hgsEligible) {
    steps.push({
      id: 'housing-strategy-check',
      horizon: '3+ Years',
      category: 'housing',
      title: 'Compare 5% HGS ($0 LMI) vs 20% Deposit Timing',
      description: `5% Home Guarantee Scheme cuts upfront cash to $${hgsOption.totalUpfrontCashRequired.toLocaleString('en-AU')} (${hgsOption.yearsToReachTarget.toFixed(1)} yrs to ready) with $0 LMI, while 20% minimizes ongoing mortgage repayments.`,
      estimatedAnnualImpactAud: Math.max(1500, Math.round(plan.houseDeposit.stampDutySaved)),
      priority: 'medium',
    });
  } else {
    steps.push({
      id: 'housing-timeline-review',
      horizon: '3+ Years',
      category: 'housing',
      title: 'Stress-Test Mortgage Repayments at +3% Buffer',
      description: `Target property ($${profile.targetPropertyPrice.toLocaleString('en-AU')}) requires $${plan.houseDeposit.totalUpfrontCashRequired.toLocaleString('en-AU')} upfront and $${Math.round(plan.houseDeposit.monthlyMortgageRepayment).toLocaleString('en-AU')}/mo repayments.`,
      estimatedAnnualImpactAud: Math.round(plan.houseDeposit.stampDutySaved),
      priority: 'medium',
    });
  }

  return steps.sort((a, b) => {
    const hDiff = HORIZON_ORDER[a.horizon] - HORIZON_ORDER[b.horizon];
    if (hDiff !== 0) return hDiff;
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.estimatedAnnualImpactAud - a.estimatedAnnualImpactAud;
  });
}

/**
 * Orchestrate all 8 Australian financial, housing, super, HECS, novated lease,
 * education ROI, and career engines into one integrated LifePlanSummary.
 */
export function generateLifePlan(profile: PlannerProfile): LifePlanSummary {
  const novatedLease = calculateNovatedLease({
    financialYear: profile.financialYear,
    grossSalary: profile.grossSalary,
    hasPrivateHospitalCover: profile.hasPrivateHospitalCover,
    hecsBalance: profile.hecsBalance,
    lease: profile.novatedLease,
  });

  const tax = calculateTax({
    financialYear: profile.financialYear,
    grossSalary: profile.grossSalary,
    partnerGrossSalary:
      profile.relationshipStatus === 'couple' ? profile.partnerGrossSalary : 0,
    relationshipStatus: profile.relationshipStatus,
    dependents: profile.dependents,
    salarySacrificeSuper: profile.salarySacrificeAnnual,
    preTaxDeductions: novatedLease.enabled ? novatedLease.preTaxDeductionAnnual : 0,
    reportableFringeBenefits: novatedLease.enabled ? novatedLease.rfbaAmount : 0,
    reportableEmployerSuper: profile.salarySacrificeAnnual,
    netInvestmentLosses: 0,
    hasPrivateHospitalCover: profile.hasPrivateHospitalCover,
    hecsBalance: profile.hecsBalance,
  });

  const partnerTax =
    profile.relationshipStatus === 'couple' && profile.partnerGrossSalary > 0
      ? calculateTax({
          financialYear: profile.financialYear,
          grossSalary: profile.partnerGrossSalary,
          partnerGrossSalary: profile.grossSalary,
          relationshipStatus: 'couple',
          dependents: profile.dependents,
          hasPrivateHospitalCover: profile.hasPrivateHospitalCover,
          hecsBalance: 0,
        })
      : null;

  const hecs = simulateHecsPayoff({
    financialYear: profile.financialYear,
    startingBalance: profile.hecsBalance,
    grossSalary: profile.grossSalary,
    salaryGrowthPct: profile.salaryGrowthPct,
    indexationRatePct: HECS_DEFAULT_INDEXATION_PCT,
    voluntaryExtraAnnual: profile.hecsVoluntaryExtraAnnual,
    reportableFringeBenefits: novatedLease.enabled ? novatedLease.rfbaAmount : 0,
    reportableEmployerSuper: profile.salarySacrificeAnnual,
  });

  const superSummary = calculateSuperAndFhsss({
    financialYear: profile.financialYear,
    age: profile.age,
    grossSalary: profile.grossSalary,
    superRatePct: profile.superRatePct,
    currentSuperBalance: profile.currentSuperBalance,
    salarySacrificeAnnual: profile.salarySacrificeAnnual,
    carryForwardUnusedCap: profile.carryForwardUnusedCap,
    investmentReturnPct: profile.investmentReturnPct,
    targetFhsssYears: Math.max(1, Math.min(4, Math.round(profile.targetHomeYears))),
    marginalTaxRateWithMedicare: tax.effectiveMarginalRateWithMedicare,
  });

  const postTaxLeaseMonthly = novatedLease.enabled
    ? novatedLease.postTaxEcmContributionAnnual / 12
    : 0;
  const effectiveMonthlyLiving =
    profile.currentMonthlyLivingExpenses + postTaxLeaseMonthly;

  const rentPass1 = calculateRentBudgetPlan({
    netMonthlyIncome: tax.netMonthlyIncome,
    partnerNetMonthlyIncome: partnerTax ? partnerTax.netMonthlyIncome : 0,
    weeklyRent: profile.currentWeeklyRent,
    monthlyLivingExpenses: effectiveMonthlyLiving,
    state: profile.state,
    cityLabel: profile.cityLabel,
    currentLiquidAssets: profile.currentCashSavings + profile.currentInvestments,
    investmentReturnPct: profile.investmentReturnPct,
    targetUpfrontCash: profile.targetPropertyPrice * 0.1,
  });

  const annualSavingsCapacity = Math.max(
    0,
    rentPass1.annualSavingsCapacity - profile.hecsVoluntaryExtraAnnual,
  );

  const householdGross =
    profile.grossSalary +
    (profile.relationshipStatus === 'couple' ? profile.partnerGrossSalary : 0);

  const houseDeposit = calculateHouseDepositPlan({
    state: profile.state,
    cityLabel: profile.cityLabel,
    propertyPrice: profile.targetPropertyPrice,
    isFirstHomeBuyer: profile.isFirstHomeBuyer,
    isNewHome: profile.isNewHome,
    depositStrategy: profile.depositStrategy,
    targetHomeYears: profile.targetHomeYears,
    targetMortgageRatePct: profile.targetMortgageRatePct,
    currentCashSavings: profile.currentCashSavings,
    currentInvestments: profile.currentInvestments,
    investmentReturnPct: profile.investmentReturnPct,
    annualSavingsCapacity,
    fhsssNetContribution: profile.isFirstHomeBuyer
      ? superSummary.fhsss.netFhsssReleaseAmount
      : 0,
    householdGrossIncome: householdGross,
    isCouple: profile.relationshipStatus === 'couple',
  });

  const rentBudget = calculateRentBudgetPlan({
    netMonthlyIncome: tax.netMonthlyIncome,
    partnerNetMonthlyIncome: partnerTax ? partnerTax.netMonthlyIncome : 0,
    weeklyRent: profile.currentWeeklyRent,
    monthlyLivingExpenses: effectiveMonthlyLiving,
    state: profile.state,
    cityLabel: profile.cityLabel,
    currentLiquidAssets: profile.currentCashSavings + profile.currentInvestments,
    investmentReturnPct: profile.investmentReturnPct,
    targetUpfrontCash: houseDeposit.totalUpfrontCashRequired,
  });

  const educationRoi = analyzeEducationRoi(profile);

  const requiredIncomeForGoals = solveRequiredGrossIncome({
    financialYear: profile.financialYear,
    state: profile.state,
    cityLabel: profile.cityLabel,
    propertyPrice: profile.targetPropertyPrice,
    isFirstHomeBuyer: profile.isFirstHomeBuyer,
    isNewHome: profile.isNewHome,
    depositStrategy: profile.depositStrategy,
    targetHomeYears: profile.targetHomeYears,
    targetMortgageRatePct: profile.targetMortgageRatePct,
    currentCashSavings: profile.currentCashSavings,
    currentInvestments: profile.currentInvestments,
    investmentReturnPct: profile.investmentReturnPct,
    fhsssNetContribution: profile.isFirstHomeBuyer
      ? superSummary.fhsss.netFhsssReleaseAmount
      : 0,
    monthlyLivingExpenses: effectiveMonthlyLiving,
    weeklyRent: profile.currentWeeklyRent,
    hecsBalance: profile.hecsBalance,
    hasPrivateHospitalCover: profile.hasPrivateHospitalCover,
  }).requiredGrossIncome;

  const careerPathway = analyzeCareerPathway(profile, requiredIncomeForGoals);

  const readiness = buildGoalReadiness(profile, {
    estimatedYearsToReady: houseDeposit.estimatedYearsToReady,
    mortgageStressPctOfNetIncome: houseDeposit.mortgageStressPctOfNetIncome,
    savingsRatePct: rentBudget.savingsRatePct,
    rentToNetIncomePct: rentBudget.rentToNetIncomePct,
    projectedSuperAt60: superSummary.projectedBalanceAt60WithSacrifice,
    hecsYearsToPayoff: hecs.yearsToPayoff,
    requiredIncome: requiredIncomeForGoals,
    householdGross,
  });

  const netWorthProjection = buildNetWorthProjection(
    profile,
    annualSavingsCapacity,
    superSummary.projectionSeries,
    hecs.projections,
    houseDeposit,
  );

  const actionPlan = buildActionPlan(profile, {
    profile,
    tax,
    partnerTax,
    hecs,
    superSummary,
    rentBudget,
    houseDeposit,
    novatedLease,
    educationRoi,
    careerPathway,
  });

  return {
    profile,
    tax,
    partnerTax,
    hecs,
    superSummary,
    rentBudget,
    houseDeposit,
    novatedLease,
    educationRoi,
    careerPathway,
    readiness,
    actionPlan,
    netWorthProjection,
  };
}
