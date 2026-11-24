import {
  CITY_MARKET_BENCHMARKS,
  INDUSTRY_FIELD_LABELS,
  INDUSTRY_SALARY_BANDS,
  QUALIFICATION_LABELS,
  QUALIFICATION_SALARY_UPLIFT,
  SUPER_CONSTANTS,
} from '../data/auConstants';
import type {
  CareerMilestone,
  CareerPathwaySummary,
  CityCareerComparison,
  PlannerProfile,
} from '../types/planner';
import { calculateStampDuty } from './housing';
import { calculateTax } from './tax';

function buildMilestones(
  field: PlannerProfile['currentField'],
  qualification: PlannerProfile['currentQualification'],
): CareerMilestone[] {
  const bands = INDUSTRY_SALARY_BANDS[field];
  const uplift = QUALIFICATION_SALARY_UPLIFT[qualification];
  const isApsField = field === 'public_policy_gov';

  const defs: Array<{
    stage: CareerMilestone['stage'];
    label: string;
    typicalYearsExp: string;
    band: { min: number; median: number; max: number };
  }> = [
    {
      stage: 'entry',
      label: isApsField ? 'APS 4–5 / Graduate' : 'Graduate / Entry',
      typicalYearsExp: '0–2 yrs',
      band: bands.entry,
    },
    {
      stage: 'mid',
      label: isApsField ? 'APS 6 / Policy Specialist' : 'Mid-Level / Specialist',
      typicalYearsExp: '3–6 yrs',
      band: bands.mid,
    },
    {
      stage: 'senior',
      label: isApsField ? 'EL1 / Senior Analyst' : 'Senior / Manager',
      typicalYearsExp: '6–10 yrs',
      band: bands.senior,
    },
    {
      stage: 'lead',
      label: isApsField ? 'EL2 / SES Band 1' : 'Lead / Principal / Director',
      typicalYearsExp: '10+ yrs',
      band: bands.lead,
    },
  ];

  return defs.map((d) => ({
    stage: d.stage,
    label: d.label,
    typicalYearsExp: d.typicalYearsExp,
    salaryMin: Math.round((d.band.min * uplift) / 500) * 500,
    salaryMedian: Math.round((d.band.median * uplift) / 500) * 500,
    salaryMax: Math.round((d.band.max * uplift) / 500) * 500,
  }));
}

function findCurrentBand(
  salary: number,
  milestones: CareerMilestone[],
): CareerMilestone {
  for (let i = milestones.length - 1; i >= 0; i--) {
    if (salary >= milestones[i].salaryMin) {
      return milestones[i];
    }
  }
  return milestones[0];
}

function estimateYearsToRequiredIncome(
  profile: PlannerProfile,
  requiredHouseholdIncome: number,
): number | null {
  const partnerIncome =
    profile.relationshipStatus === 'couple' ? profile.partnerGrossSalary : 0;
  const currentHousehold = profile.grossSalary + partnerIncome;
  if (currentHousehold >= requiredHouseholdIncome) return 0;

  const growthRate = Math.max(profile.salaryGrowthPct, 3.0) / 100;
  const studyDuration =
    profile.studyPlan.studyMode !== 'none' ? profile.studyPlan.durationYears : 0;

  let primary = profile.grossSalary;
  let partner = partnerIncome;

  const postGradJump =
    profile.studyPlan.expectedGradIncomeOverride &&
    profile.studyPlan.expectedGradIncomeOverride > 0
      ? profile.studyPlan.expectedGradIncomeOverride
      : INDUSTRY_SALARY_BANDS[profile.studyPlan.field].entry.median *
        QUALIFICATION_SALARY_UPLIFT[profile.studyPlan.targetQualification];

  let jumped = studyDuration === 0;

  for (let year = 1; year <= 30; year++) {
    if (!jumped && year >= Math.ceil(studyDuration)) {
      primary = Math.max(primary, postGradJump);
      jumped = true;
    } else {
      primary = primary * (1 + growthRate);
    }
    partner = partner * (1 + growthRate);
    if (primary + partner >= requiredHouseholdIncome) {
      return year;
    }
  }
  return null;
}

function computeSydneyVsCanberraComparison(
  profile: PlannerProfile,
): {
  comparison: CityCareerComparison;
  stampDutySaving: number;
  apsSuperEquivalentExtra: number;
} {
  const sydney = CITY_MARKET_BENCHMARKS.find((c) => c.city === 'Sydney')!;
  const canberra = CITY_MARKET_BENCHMARKS.find((c) => c.city === 'Canberra')!;

  const currentCity =
    CITY_MARKET_BENCHMARKS.find(
      (c) => c.city.toLowerCase() === profile.cityLabel.trim().toLowerCase(),
    ) ??
    CITY_MARKET_BENCHMARKS.find((c) => c.state === profile.state) ??
    sydney;

  const referenceSalary =
    profile.employmentStatus === 'studying_austudy' &&
    profile.studyPlan.expectedGradIncomeOverride
      ? profile.studyPlan.expectedGradIncomeOverride
      : Math.max(profile.grossSalary, 85000);

  const nationalBase = referenceSalary / currentCity.salaryMultiplierVsNational;
  const sydneySalary = Math.round(nationalBase * sydney.salaryMultiplierVsNational);
  const canberraSalary = Math.round(nationalBase * canberra.salaryMultiplierVsNational);

  const sydneyTax = calculateTax({
    financialYear: profile.financialYear,
    grossSalary: sydneySalary,
    hasPrivateHospitalCover: profile.hasPrivateHospitalCover,
    hecsBalance: profile.hecsBalance,
  });

  const canberraTax = calculateTax({
    financialYear: profile.financialYear,
    grossSalary: canberraSalary,
    hasPrivateHospitalCover: profile.hasPrivateHospitalCover,
    hecsBalance: profile.hecsBalance,
  });

  const annualRentSavings =
    (sydney.medianUnitWeeklyRent - canberra.medianUnitWeeklyRent) * 52;
  const netAfterTaxDelta = canberraTax.netAnnualIncome - sydneyTax.netAnnualIncome;
  const netDisposableDeltaCanberraVsSydneyAnnual = Math.round(
    netAfterTaxDelta + annualRentSavings,
  );

  const nswDuty = calculateStampDuty(
    profile.targetPropertyPrice,
    'NSW',
    profile.isFirstHomeBuyer,
    profile.isNewHome,
  );
  const actDuty = calculateStampDuty(
    profile.targetPropertyPrice,
    'ACT',
    profile.isFirstHomeBuyer,
    profile.isNewHome,
  );
  const stampDutySaving = Math.max(0, Math.round(nswDuty - actDuty));

  const apsSuperEquivalentExtra = Math.round(
    referenceSalary * (SUPER_CONSTANTS.apsSuperRate - SUPER_CONSTANTS.sgRate),
  );

  return {
    comparison: {
      sydneyMedianSalaryMultiplier: sydney.salaryMultiplierVsNational,
      canberraMedianSalaryMultiplier: canberra.salaryMultiplierVsNational,
      sydneyMedianRentWeekly: sydney.medianUnitWeeklyRent,
      canberraMedianRentWeekly: canberra.medianUnitWeeklyRent,
      netDisposableDeltaCanberraVsSydneyAnnual,
    },
    stampDutySaving,
    apsSuperEquivalentExtra,
  };
}

/**
 * Build Australian career salary ladder, goal income gap, APS 15.4% super package uplift,
 * and Sydney vs Canberra relocation net financial comparison.
 */
export function analyzeCareerPathway(
  profile: PlannerProfile,
  requiredIncomeForGoals: number,
): CareerPathwaySummary {
  const targetField =
    profile.studyPlan.studyMode !== 'none' ? profile.studyPlan.field : profile.currentField;
  const targetQual =
    profile.studyPlan.studyMode !== 'none'
      ? profile.studyPlan.targetQualification
      : profile.currentQualification;

  const milestones = buildMilestones(targetField, targetQual);
  const currentEstimatedBand = findCurrentBand(profile.grossSalary, milestones);

  const partnerIncome =
    profile.relationshipStatus === 'couple' ? profile.partnerGrossSalary : 0;
  const householdGross = profile.grossSalary + partnerIncome;
  const incomeGapToGoals = Math.max(0, Math.round(requiredIncomeForGoals - householdGross));
  const projectedYearsToRequiredIncome = estimateYearsToRequiredIncome(
    profile,
    requiredIncomeForGoals,
  );

  const apsTotalPkgMultiplier = 1 + SUPER_CONSTANTS.apsSuperRate;
  const standardTotalPkgMultiplier = 1 + SUPER_CONSTANTS.sgRate;
  const privateEquivalentForCurrent = Math.round(
    profile.grossSalary * (apsTotalPkgMultiplier / standardTotalPkgMultiplier),
  );

  let currentSalaryPercentileNote: string;
  if (profile.employmentStatus === 'studying_austudy') {
    currentSalaryPercentileNote = `Currently studying on Austudy ($${profile.grossSalary.toLocaleString('en-AU')}/yr); targeting ${currentEstimatedBand.label} ($${currentEstimatedBand.salaryMin.toLocaleString('en-AU')}–$${currentEstimatedBand.salaryMax.toLocaleString('en-AU')}).`;
  } else {
    const position =
      profile.grossSalary >= currentEstimatedBand.salaryMedian
        ? 'above median'
        : 'below median';
    currentSalaryPercentileNote = `Sits in ${currentEstimatedBand.label} (${position} vs $${currentEstimatedBand.salaryMedian.toLocaleString('en-AU')} median for ${QUALIFICATION_LABELS[targetQual]} in ${INDUSTRY_FIELD_LABELS[targetField]}).`;
  }

  const { comparison, stampDutySaving, apsSuperEquivalentExtra } =
    computeSydneyVsCanberraComparison(profile);

  const notes: string[] = [];
  notes.push(
    `APS / Public-Sector 15.4% super adds +$${apsSuperEquivalentExtra.toLocaleString('en-AU')}/yr vs 12% SG (a $${profile.grossSalary.toLocaleString('en-AU')} APS base equals ~$${privateEquivalentForCurrent.toLocaleString('en-AU')} private-sector base on total package).`,
  );

  if (incomeGapToGoals > 0) {
    notes.push(
      `Household income gap to target goals is $${incomeGapToGoals.toLocaleString('en-AU')}/yr (${
        projectedYearsToRequiredIncome !== null
          ? `projected to close in ~${projectedYearsToRequiredIncome} yrs`
          : 'requires career/field step-up'
      }).`,
    );
  } else {
    notes.push(
      `Current household income ($${householdGross.toLocaleString('en-AU')}/yr) already meets the ~$${Math.round(requiredIncomeForGoals).toLocaleString('en-AU')}/yr required for your target goals.`,
    );
  }

  const medianSydneyVsCbrDutyDiff = Math.round(
    calculateStampDuty(1250000, 'NSW', true, false) -
      calculateStampDuty(880000, 'ACT', true, false),
  );
  notes.push(
    `Canberra vs Sydney: unit rent savings ($${comparison.canberraMedianRentWeekly}/wk vs $${comparison.sydneyMedianRentWeekly}/wk) yield ${
      comparison.netDisposableDeltaCanberraVsSydneyAnnual >= 0 ? '+' : '-'
    }$${Math.abs(comparison.netDisposableDeltaCanberraVsSydneyAnnual).toLocaleString('en-AU')}/yr net cashflow, plus ${
      stampDutySaving > 0
        ? `$${stampDutySaving.toLocaleString('en-AU')} FHB stamp duty saved on your $${profile.targetPropertyPrice.toLocaleString('en-AU')} target`
        : `$0 ACT FHB stamp duty (saving ~$${medianSydneyVsCbrDutyDiff.toLocaleString('en-AU')} on median FHB houses)`
    }.`,
  );

  return {
    currentField: profile.currentField,
    targetField,
    currentEstimatedBand,
    milestones,
    currentSalaryPercentileNote,
    requiredIncomeForGoals: Math.round(requiredIncomeForGoals),
    incomeGapToGoals,
    projectedYearsToRequiredIncome,
    cityComparison: comparison,
    notes,
  };
}
