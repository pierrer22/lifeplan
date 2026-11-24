import {
  ANNUAL_TUITION_BY_FIELD,
  AUSTUDY_CONSTANTS,
  CITY_MARKET_BENCHMARKS,
  HECS_DEFAULT_INDEXATION_PCT,
  INDUSTRY_FIELD_LABELS,
  INDUSTRY_SALARY_BANDS,
  QUALIFICATION_LABELS,
  QUALIFICATION_SALARY_UPLIFT,
  QUALIFICATION_TUITION_MULTIPLIER,
} from '../data/auConstants';
import type {
  EducationEarningsPoint,
  EducationRoiSummary,
  EducationScenarioComparison,
  IndustryField,
  PlannerProfile,
  QualificationLevel,
  StudyPlan,
} from '../types/planner';
import { calculateTax } from './tax';

const SIMULATION_HORIZON_YEARS = 20;
const CHART_HORIZON_YEARS = 10;

function getCitySalaryMultiplier(profile: PlannerProfile): number {
  const cityMatch = CITY_MARKET_BENCHMARKS.find(
    (c) => c.city.toLowerCase() === profile.cityLabel.trim().toLowerCase(),
  );
  if (cityMatch) return cityMatch.salaryMultiplierVsNational;
  const stateMatch = CITY_MARKET_BENCHMARKS.find((c) => c.state === profile.state);
  return stateMatch ? stateMatch.salaryMultiplierVsNational : 1.0;
}

function estimateBaselineNoStudyIncome(profile: PlannerProfile): number {
  if (profile.employmentStatus !== 'studying_austudy' && profile.grossSalary >= 45000) {
    return Math.round(profile.grossSalary);
  }
  const band = INDUSTRY_SALARY_BANDS[profile.currentField];
  const uplift = QUALIFICATION_SALARY_UPLIFT[profile.currentQualification];
  const cityMult = getCitySalaryMultiplier(profile);
  return Math.round(band.entry.median * uplift * cityMult);
}

function estimatePostStudyIncome(
  profile: PlannerProfile,
  baselineNoStudy: number,
  plan: StudyPlan,
): number {
  if (plan.studyMode === 'none') {
    return baselineNoStudy;
  }
  if (plan.expectedGradIncomeOverride !== undefined && plan.expectedGradIncomeOverride > 0) {
    return Math.round(plan.expectedGradIncomeOverride);
  }
  const currentUplift = QUALIFICATION_SALARY_UPLIFT[profile.currentQualification] || 1;
  const targetUplift = QUALIFICATION_SALARY_UPLIFT[plan.targetQualification] || 1;
  const qualRatio = targetUplift / currentUplift;

  const fieldRatio =
    plan.field !== profile.currentField
      ? INDUSTRY_SALARY_BANDS[plan.field].mid.median /
        INDUSTRY_SALARY_BANDS[profile.currentField].mid.median
      : 1;

  const scaledFromBaseline = baselineNoStudy * qualRatio * fieldRatio;
  const entryFloor =
    INDUSTRY_SALARY_BANDS[plan.field].entry.median *
    targetUplift *
    getCitySalaryMultiplier(profile);

  return Math.round(Math.max(scaledFromBaseline, entryFloor));
}

function computeTuitionAnnual(
  qualification: QualificationLevel,
  field: IndustryField,
  isCsp: boolean,
  studyMode: 'full_time' | 'part_time' | 'none',
): number {
  if (studyMode === 'none') return 0;
  const band = ANNUAL_TUITION_BY_FIELD[field];
  const qualMult = QUALIFICATION_TUITION_MULTIPLIER[qualification];
  const baseAnnual = isCsp ? band.cspAnnual : band.fullFeeAnnual;
  return Math.round(baseAnnual * qualMult);
}

function computeStudyLivingIncome(
  profile: PlannerProfile,
  baselineNoStudy: number,
  studyMode: 'full_time' | 'part_time' | 'none',
  partTimeStudyIncome: number,
): { austudyEligible: boolean; annualStudyIncome: number } {
  if (studyMode === 'none') {
    return { austudyEligible: false, annualStudyIncome: baselineNoStudy };
  }

  if (studyMode === 'part_time') {
    const ptIncome =
      partTimeStudyIncome > 0 && profile.employmentStatus === 'studying_austudy'
        ? Math.max(partTimeStudyIncome, Math.round(baselineNoStudy * 0.7))
        : partTimeStudyIncome > 0
          ? partTimeStudyIncome
          : Math.round(baselineNoStudy * 0.85);
    return { austudyEligible: false, annualStudyIncome: Math.round(ptIncome) };
  }

  const austudyEligible = profile.age >= 25 || profile.employmentStatus === 'studying_austudy';
  if (
    profile.employmentStatus === 'studying_austudy' &&
    partTimeStudyIncome <= AUSTUDY_CONSTANTS.annualWithRentAssistanceEstimate
  ) {
    return {
      austudyEligible,
      annualStudyIncome: Math.round(
        Math.max(partTimeStudyIncome, AUSTUDY_CONSTANTS.annualBaselineSingleNoChildren),
      ),
    };
  }

  const freeAreaAnnual = AUSTUDY_CONSTANTS.fortnightlyIncomeFreeArea * 26;
  const austudyPayment = austudyEligible
    ? Math.max(
        0,
        AUSTUDY_CONSTANTS.annualBaselineSingleNoChildren -
          Math.max(0, partTimeStudyIncome - freeAreaAnnual) * 0.55,
      )
    : 0;

  return {
    austudyEligible,
    annualStudyIncome: Math.round(partTimeStudyIncome + austudyPayment),
  };
}

interface PathSimulationResult {
  cumulativeNetWealth: number[];
}

function simulateNetWealthPath(
  profile: PlannerProfile,
  baselineNoStudy: number,
  studyMode: 'full_time' | 'part_time' | 'none',
  durationYears: number,
  annualStudyIncome: number,
  tuitionTotal: number,
  expectedGradIncome: number,
): PathSimulationResult {
  const growthRate = Math.max(0, profile.salaryGrowthPct) / 100;
  const indexRate = HECS_DEFAULT_INDEXATION_PCT / 100;
  const cumulativeNetWealth: number[] = [0];

  let cumulativeCash = 0;
  let hecsBal = profile.hecsBalance;
  const startingHecs = profile.hecsBalance;

  for (let year = 1; year <= SIMULATION_HORIZON_YEARS; year++) {
    const yearStart = year - 1;
    const yearEnd = year;

    let studyFraction = 0;
    if (studyMode !== 'none' && durationYears > 0) {
      if (yearStart < durationYears) {
        studyFraction = Math.min(1, durationYears - yearStart);
      }
    }
    const workFraction = 1 - studyFraction;

    const yearsPostStudy = Math.max(0, yearEnd - durationYears - 0.5);
    const postStudyBase =
      studyMode === 'none'
        ? baselineNoStudy * Math.pow(1 + growthRate, year - 1)
        : expectedGradIncome * Math.pow(1 + growthRate, yearsPostStudy);

    const grossThisYear = studyFraction * annualStudyIncome + workFraction * postStudyBase;
    const tuitionAddedThisYear =
      durationYears > 0 ? tuitionTotal * (studyFraction / durationYears) : 0;

    hecsBal += tuitionAddedThisYear;

    const taxSummary = calculateTax({
      financialYear: profile.financialYear,
      grossSalary: grossThisYear,
      partnerGrossSalary:
        profile.relationshipStatus === 'couple' ? profile.partnerGrossSalary : 0,
      relationshipStatus: profile.relationshipStatus,
      dependents: profile.dependents,
      hasPrivateHospitalCover: profile.hasPrivateHospitalCover,
      hecsBalance: hecsBal,
    });

    const hecsRepaid = Math.min(hecsBal, taxSummary.hecsCompulsoryRepayment);
    hecsBal = Math.max(0, (hecsBal - hecsRepaid) * (1 + indexRate));

    cumulativeCash += taxSummary.netAnnualIncome;
    const netWealthGain = cumulativeCash - (hecsBal - startingHecs);
    cumulativeNetWealth.push(Math.round(netWealthGain));
  }

  return { cumulativeNetWealth };
}

function computeBreakEvenYears(
  studySeries: number[],
  noStudySeries: number[],
  studyMode: 'full_time' | 'part_time' | 'none',
  durationYears: number,
): number | null {
  if (studyMode === 'none' || durationYears <= 0) return null;

  let sawNegativeDelta = false;
  for (let y = 1; y < studySeries.length; y++) {
    const prevDelta = studySeries[y - 1] - noStudySeries[y - 1];
    const currDelta = studySeries[y] - noStudySeries[y];
    if (currDelta < 0) {
      sawNegativeDelta = true;
    }
    if (currDelta >= 0 && (prevDelta < 0 || (y === 1 && !sawNegativeDelta))) {
      if (prevDelta >= 0) return y;
      const fraction = -prevDelta / Math.max(1, currDelta - prevDelta);
      return Math.round((y - 1 + fraction) * 10) / 10;
    }
  }
  return null;
}

function buildScenarioComparison(
  id: string,
  label: string,
  profile: PlannerProfile,
  baselineNoStudy: number,
  qual: QualificationLevel,
  field: IndustryField,
  isCsp: boolean,
  studyMode: 'full_time' | 'part_time' | 'none',
  durationYears: number,
  partTimeStudyIncome: number,
  expectedGradIncome: number,
  noStudyPath: PathSimulationResult,
): { comparison: EducationScenarioComparison; path: PathSimulationResult } {
  const effectiveDuration = studyMode === 'none' ? 0 : Math.max(0, durationYears);
  const tuitionPerYearFullLoad = computeTuitionAnnual(qual, field, isCsp, studyMode);
  const baseFtDuration = ANNUAL_TUITION_BY_FIELD[field].defaultDurationYears;
  const tuitionTotal =
    studyMode === 'none'
      ? 0
      : studyMode === 'part_time'
        ? Math.round(tuitionPerYearFullLoad * Math.min(effectiveDuration, baseFtDuration))
        : Math.round(tuitionPerYearFullLoad * effectiveDuration);

  const { annualStudyIncome } = computeStudyLivingIncome(
    profile,
    baselineNoStudy,
    studyMode,
    partTimeStudyIncome,
  );

  const opportunityCostTotal =
    studyMode === 'none'
      ? 0
      : Math.round(Math.max(0, baselineNoStudy - annualStudyIncome) * effectiveDuration);

  const totalEconomicCost = tuitionTotal + opportunityCostTotal;
  const path = simulateNetWealthPath(
    profile,
    baselineNoStudy,
    studyMode,
    effectiveDuration,
    annualStudyIncome,
    tuitionTotal,
    expectedGradIncome,
  );

  const breakEvenYears = computeBreakEvenYears(
    path.cumulativeNetWealth,
    noStudyPath.cumulativeNetWealth,
    studyMode,
    effectiveDuration,
  );

  const tenYearNetWealthDelta =
    path.cumulativeNetWealth[CHART_HORIZON_YEARS] -
    noStudyPath.cumulativeNetWealth[CHART_HORIZON_YEARS];

  return {
    comparison: {
      id,
      label,
      qualification: qual,
      field,
      isCsp,
      studyMode,
      durationYears: effectiveDuration,
      tuitionTotal,
      opportunityCostTotal,
      totalEconomicCost,
      expectedGradIncome,
      incomeUpliftAnnual: Math.max(0, expectedGradIncome - baselineNoStudy),
      breakEvenYears,
      tenYearNetWealthDelta,
    },
    path,
  };
}

/**
 * Analyze Australian higher education / postgrad ROI comparing CSP vs Full-Fee,
 * Full-Time vs Part-Time vs No Further Study, including Austudy offset and 10-yr net wealth.
 */
export function analyzeEducationRoi(
  profile: PlannerProfile,
  override?: Partial<StudyPlan>,
): EducationRoiSummary {
  const plan: StudyPlan = {
    ...profile.studyPlan,
    ...override,
  };

  const baselineNoStudyIncome = estimateBaselineNoStudyIncome(profile);
  const expectedPostStudyGrossIncome = estimatePostStudyIncome(
    profile,
    baselineNoStudyIncome,
    plan,
  );

  const defaultFtDuration =
    plan.durationYears > 0
      ? plan.studyMode === 'part_time'
        ? plan.durationYears / 2
        : plan.durationYears
      : ANNUAL_TUITION_BY_FIELD[plan.field].defaultDurationYears;

  const noStudySim = simulateNetWealthPath(
    profile,
    baselineNoStudyIncome,
    'none',
    0,
    baselineNoStudyIncome,
    0,
    baselineNoStudyIncome,
  );

  const noStudyScenario: EducationScenarioComparison = {
    id: 'no-study',
    label: 'No Further Study (Enter / Stay in Workforce)',
    qualification: profile.currentQualification,
    field: profile.currentField,
    isCsp: true,
    studyMode: 'none',
    durationYears: 0,
    tuitionTotal: 0,
    opportunityCostTotal: 0,
    totalEconomicCost: 0,
    expectedGradIncome: baselineNoStudyIncome,
    incomeUpliftAnnual: 0,
    breakEvenYears: null,
    tenYearNetWealthDelta: 0,
  };

  const qualLabel = QUALIFICATION_LABELS[plan.targetQualification];
  const cspFt = buildScenarioComparison(
    'csp-full-time',
    `${qualLabel} — CSP Full-Time`,
    profile,
    baselineNoStudyIncome,
    plan.targetQualification,
    plan.field,
    true,
    'full_time',
    defaultFtDuration,
    plan.partTimeStudyIncome,
    expectedPostStudyGrossIncome,
    noStudySim,
  );

  const cspPt = buildScenarioComparison(
    'csp-part-time',
    `${qualLabel} — CSP Part-Time (Work & Study)`,
    profile,
    baselineNoStudyIncome,
    plan.targetQualification,
    plan.field,
    true,
    'part_time',
    Math.round(defaultFtDuration * 2 * 10) / 10,
    plan.partTimeStudyIncome > 0 && profile.employmentStatus !== 'studying_austudy'
      ? plan.partTimeStudyIncome
      : Math.round(baselineNoStudyIncome * 0.85),
    expectedPostStudyGrossIncome,
    noStudySim,
  );

  const fullFeeFt = buildScenarioComparison(
    'full-fee-full-time',
    `${qualLabel} — Full-Fee Full-Time`,
    profile,
    baselineNoStudyIncome,
    plan.targetQualification,
    plan.field,
    false,
    'full_time',
    defaultFtDuration,
    plan.partTimeStudyIncome,
    expectedPostStudyGrossIncome,
    noStudySim,
  );

  const selectedBuild =
    plan.studyMode === 'none'
      ? { comparison: noStudyScenario, path: noStudySim }
      : buildScenarioComparison(
          'selected',
          `${qualLabel} (${plan.isCsp ? 'CSP' : 'Full-Fee'}, ${
            plan.studyMode === 'full_time' ? 'Full-Time' : 'Part-Time'
          })`,
          profile,
          baselineNoStudyIncome,
          plan.targetQualification,
          plan.field,
          plan.isCsp,
          plan.studyMode,
          plan.durationYears > 0 ? plan.durationYears : defaultFtDuration,
          plan.partTimeStudyIncome,
          expectedPostStudyGrossIncome,
          noStudySim,
        );

  const { austudyEligible, annualStudyIncome } = computeStudyLivingIncome(
    profile,
    baselineNoStudyIncome,
    plan.studyMode,
    plan.partTimeStudyIncome,
  );

  const effectiveDuration = plan.studyMode === 'none' ? 0 : Math.max(0, plan.durationYears || defaultFtDuration);
  const tuitionAnnual = computeTuitionAnnual(
    plan.targetQualification,
    plan.field,
    plan.isCsp,
    plan.studyMode,
  );
  const tuitionTotalAddedToHecs = selectedBuild.comparison.tuitionTotal;
  const foregoneIncomeDuringStudy = selectedBuild.comparison.opportunityCostTotal;

  const fiveYearNetWealthDelta =
    selectedBuild.path.cumulativeNetWealth[5] - noStudySim.cumulativeNetWealth[5];
  const tenYearNetWealthDelta =
    selectedBuild.path.cumulativeNetWealth[CHART_HORIZON_YEARS] -
    noStudySim.cumulativeNetWealth[CHART_HORIZON_YEARS];

  const cspTuitionRef =
    computeTuitionAnnual(plan.targetQualification, plan.field, true, 'full_time') *
    defaultFtDuration;
  const fullFeeTuitionRef =
    computeTuitionAnnual(plan.targetQualification, plan.field, false, 'full_time') *
    defaultFtDuration;
  const cspVsFullFeeSavings = Math.max(0, Math.round(fullFeeTuitionRef - cspTuitionRef));

  const cumulativeEarningsSeries: EducationEarningsPoint[] = [];
  for (let year = 0; year <= CHART_HORIZON_YEARS; year++) {
    cumulativeEarningsSeries.push({
      year,
      noStudyCumulative: noStudySim.cumulativeNetWealth[year],
      selectedStudyCumulative: selectedBuild.path.cumulativeNetWealth[year],
      fullFeeAlternativeCumulative: fullFeeFt.path.cumulativeNetWealth[year],
    });
  }

  const notes: string[] = [];
  if (plan.studyMode === 'none') {
    notes.push(
      `No further study modeled: continuing in ${INDUSTRY_FIELD_LABELS[profile.currentField]} at $${baselineNoStudyIncome.toLocaleString('en-AU')}/yr avoids additional HECS debt and foregone earnings.`,
    );
  } else {
    notes.push(
      `${plan.isCsp ? 'Commonwealth Supported Place (CSP)' : 'Full-Fee place'} adds ~$${tuitionTotalAddedToHecs.toLocaleString('en-AU')} to HECS-HELP over ${effectiveDuration} yrs (CSP saves $${cspVsFullFeeSavings.toLocaleString('en-AU')} vs Full-Fee).`,
    );
    if (austudyEligible) {
      notes.push(
        `Austudy eligible during full-time study (~$${AUSTUDY_CONSTANTS.annualBaselineSingleNoChildren.toLocaleString('en-AU')}/yr baseline single), offsetting part of the $${foregoneIncomeDuringStudy.toLocaleString('en-AU')} foregone salary.`,
      );
    }
    if (tenYearNetWealthDelta < 0) {
      notes.push(
        `10-year net wealth delta is negative (-$${Math.abs(tenYearNetWealthDelta).toLocaleString('en-AU')}) because short-term opportunity cost outweighs the immediate $${(expectedPostStudyGrossIncome - baselineNoStudyIncome).toLocaleString('en-AU')}/yr uplift; consider part-time study or verifying senior-band progression.`,
      );
    } else if (selectedBuild.comparison.breakEvenYears !== null) {
      notes.push(
        `Breaks even in ~${selectedBuild.comparison.breakEvenYears} years and delivers +$${tenYearNetWealthDelta.toLocaleString('en-AU')} net wealth over 10 years.`,
      );
    }
  }

  return {
    selectedScenario: selectedBuild.comparison,
    baselineNoStudyIncome,
    austudyEligibleDuringStudy: austudyEligible,
    annualStudyLivingIncome: annualStudyIncome,
    tuitionAnnual,
    tuitionTotalAddedToHecs,
    foregoneIncomeDuringStudy,
    expectedPostStudyGrossIncome,
    breakEvenYears: selectedBuild.comparison.breakEvenYears,
    fiveYearNetWealthDelta,
    tenYearNetWealthDelta,
    cspVsFullFeeSavings,
    scenarios: [noStudyScenario, cspFt.comparison, cspPt.comparison, fullFeeFt.comparison],
    cumulativeEarningsSeries,
    notes,
  };
}
