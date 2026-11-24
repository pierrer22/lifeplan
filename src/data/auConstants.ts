import type {
  AuState,
  FinancialYear,
  IndustryField,
  QualificationLevel,
} from '../types/planner';

// ============================================================================
// ATO Income Tax Brackets (Resident, excluding 2% Medicare Levy)
// ============================================================================

export interface TaxBracket {
  min: number;
  max: number | null;
  baseTax: number;
  rate: number;
  over: number;
  label: string;
}

export const RESIDENT_TAX_BRACKETS: Record<FinancialYear, readonly TaxBracket[]> = {
  '2026-27': [
    { min: 0, max: 18200, baseTax: 0, rate: 0, over: 0, label: '$0 – $18,200 (0%)' },
    {
      min: 18201,
      max: 45000,
      baseTax: 0,
      rate: 0.15,
      over: 18200,
      label: '$18,201 – $45,000 (15%)',
    },
    {
      min: 45001,
      max: 135000,
      baseTax: 4020,
      rate: 0.3,
      over: 45000,
      label: '$45,001 – $135,000 (30%)',
    },
    {
      min: 135001,
      max: 190000,
      baseTax: 31020,
      rate: 0.37,
      over: 135000,
      label: '$135,001 – $190,000 (37%)',
    },
    {
      min: 190001,
      max: null,
      baseTax: 51370,
      rate: 0.45,
      over: 190000,
      label: '$190,001+ (45%)',
    },
  ],
  '2025-26': [
    { min: 0, max: 18200, baseTax: 0, rate: 0, over: 0, label: '$0 – $18,200 (0%)' },
    {
      min: 18201,
      max: 45000,
      baseTax: 0,
      rate: 0.16,
      over: 18200,
      label: '$18,201 – $45,000 (16%)',
    },
    {
      min: 45001,
      max: 135000,
      baseTax: 4288,
      rate: 0.3,
      over: 45000,
      label: '$45,001 – $135,000 (30%)',
    },
    {
      min: 135001,
      max: 190000,
      baseTax: 31288,
      rate: 0.37,
      over: 135000,
      label: '$135,001 – $190,000 (37%)',
    },
    {
      min: 190001,
      max: null,
      baseTax: 51638,
      rate: 0.45,
      over: 190000,
      label: '$190,001+ (45%)',
    },
  ],
};

// Low Income Tax Offset (LITO)
export const LITO_CONSTANTS = {
  maxOffset: 700,
  fullThreshold: 37500,
  midThreshold: 45000,
  zeroThreshold: 66667,
  firstTaperRate: 0.05,
  secondTaperRate: 0.015,
} as const;

// Medicare Levy
export const MEDICARE_LEVY_CONSTANTS = {
  standardRate: 0.02,
  singleLowIncomeThreshold: 27222,
  singleShadeInUpper: 34027,
  shadeInRate: 0.1,
} as const;

// ============================================================================
// Medicare Levy Surcharge (MLS) Tiers
// ============================================================================

export interface MlsTier {
  min: number;
  max: number | null;
  rate: number;
}

export interface MlsConfig {
  singles: readonly MlsTier[];
  families: readonly MlsTier[];
  dependentChildIncrement: number;
}

export const MLS_TIERS: Record<FinancialYear, MlsConfig> = {
  '2026-27': {
    singles: [
      { min: 0, max: 105000, rate: 0 },
      { min: 105001, max: 123000, rate: 0.01 },
      { min: 123001, max: 164000, rate: 0.0125 },
      { min: 164001, max: null, rate: 0.015 },
    ],
    families: [
      { min: 0, max: 210000, rate: 0 },
      { min: 210001, max: 246000, rate: 0.01 },
      { min: 246001, max: 328000, rate: 0.0125 },
      { min: 328001, max: null, rate: 0.015 },
    ],
    dependentChildIncrement: 1500,
  },
  '2025-26': {
    singles: [
      { min: 0, max: 101000, rate: 0 },
      { min: 101001, max: 118000, rate: 0.01 },
      { min: 118001, max: 158000, rate: 0.0125 },
      { min: 158001, max: null, rate: 0.015 },
    ],
    families: [
      { min: 0, max: 202000, rate: 0 },
      { min: 202001, max: 236000, rate: 0.01 },
      { min: 236001, max: 316000, rate: 0.0125 },
      { min: 316001, max: null, rate: 0.015 },
    ],
    dependentChildIncrement: 1500,
  },
};

// ============================================================================
// HECS-HELP Marginal Repayment Thresholds
// ============================================================================

export interface HecsMarginalTier {
  min: number;
  max: number | null;
  mode: 'nil' | 'marginal' | 'flat_total';
  baseAmount: number;
  rate: number;
  over: number;
}

export const HECS_THRESHOLDS: Record<FinancialYear, readonly HecsMarginalTier[]> = {
  '2026-27': [
    { min: 0, max: 69528, mode: 'nil', baseAmount: 0, rate: 0, over: 0 },
    { min: 69529, max: 129717, mode: 'marginal', baseAmount: 0, rate: 0.15, over: 69528 },
    { min: 129718, max: 186050, mode: 'marginal', baseAmount: 9028, rate: 0.17, over: 129717 },
    { min: 186051, max: null, mode: 'flat_total', baseAmount: 0, rate: 0.1, over: 0 },
  ],
  '2025-26': [
    { min: 0, max: 67000, mode: 'nil', baseAmount: 0, rate: 0, over: 0 },
    { min: 67001, max: 125000, mode: 'marginal', baseAmount: 0, rate: 0.15, over: 67000 },
    { min: 125001, max: 179285, mode: 'marginal', baseAmount: 8700, rate: 0.17, over: 125000 },
    { min: 179286, max: null, mode: 'flat_total', baseAmount: 0, rate: 0.1, over: 0 },
  ],
};

export const HECS_DEFAULT_INDEXATION_PCT = 3.2;

// ============================================================================
// Superannuation & FHSSS Constants
// ============================================================================

export const SUPER_CONSTANTS = {
  sgRate: 0.12,
  apsSuperRate: 0.154,
  concessionalCap: {
    '2026-27': 32500,
    '2025-26': 30000,
  } as Record<FinancialYear, number>,
  carryForwardTsbLimit: 500000,
  contributionsTaxRate: 0.15,
  div293Threshold: 250000,
  div293AdditionalTaxRate: 0.15,
  preservationAge: 60,
  fhsss: {
    annualCap: 15000,
    lifetimeCap: 50000,
    deemedSicRate: 0.071,
    withdrawalTaxOffset: 0.3,
  },
} as const;

// ============================================================================
// Novated Lease & EV FBT Constants
// ============================================================================

export const NOVATED_LEASE_CONSTANTS = {
  fuelEfficientLct: {
    '2026-27': 91661,
    '2025-26': 91387,
  } as Record<FinancialYear, number>,
  standardLct: {
    '2026-27': 80809,
    '2025-26': 80567,
  } as Record<FinancialYear, number>,
  gstCarLimit: 69674,
  maxGstCredit: 6334,
  gstRate: 0.1,
  rfbaStatutoryRate: 0.2,
  rfbaType2GrossUp: 1.8868,
  rfbaType1GrossUp: 2.0802,
  evTransitionApril2027: {
    effectiveDate: '2027-04-01',
    fullExemptionPriceCap: 75000,
    discountedStatutoryRate: 0.15,
    discountedFbtDiscountPct: 0.25,
  },
  atoResidualsByTerm: {
    1: 0.6563,
    2: 0.5625,
    3: 0.4688,
    4: 0.375,
    5: 0.2813,
  } as Record<1 | 2 | 3 | 4 | 5, number>,
} as const;

// ============================================================================
// Stamp Duty, First Home Buyer Concessions & HGS Caps (2026)
// ============================================================================

export interface StampDutyBracket {
  min: number;
  max: number | null;
  baseDuty: number;
  ratePer100: number;
  over: number;
}

export const STATE_STAMP_DUTY_BRACKETS: Record<AuState, readonly StampDutyBracket[]> = {
  NSW: [
    { min: 0, max: 17000, baseDuty: 0, ratePer100: 1.25, over: 0 },
    { min: 17001, max: 36000, baseDuty: 212, ratePer100: 1.5, over: 17000 },
    { min: 36001, max: 97000, baseDuty: 497, ratePer100: 1.75, over: 36000 },
    { min: 97001, max: 364000, baseDuty: 1565, ratePer100: 3.5, over: 97000 },
    { min: 364001, max: 1212000, baseDuty: 10910, ratePer100: 4.5, over: 364000 },
    { min: 1212001, max: 3636000, baseDuty: 49070, ratePer100: 5.5, over: 1212000 },
    { min: 3636001, max: null, baseDuty: 182390, ratePer100: 7.0, over: 3636000 },
  ],
  ACT: [
    { min: 0, max: 260000, baseDuty: 0, ratePer100: 0.49, over: 0 },
    { min: 260001, max: 300000, baseDuty: 1274, ratePer100: 2.2, over: 260000 },
    { min: 300001, max: 500000, baseDuty: 2154, ratePer100: 3.4, over: 300000 },
    { min: 500001, max: 750000, baseDuty: 8954, ratePer100: 4.32, over: 500000 },
    { min: 750001, max: 1000000, baseDuty: 19754, ratePer100: 5.9, over: 750000 },
    { min: 1000001, max: 1455000, baseDuty: 34504, ratePer100: 6.4, over: 1000000 },
    { min: 1455001, max: null, baseDuty: 63624, ratePer100: 4.54, over: 0 },
  ],
  VIC: [
    { min: 0, max: 25000, baseDuty: 0, ratePer100: 1.4, over: 0 },
    { min: 25001, max: 130000, baseDuty: 350, ratePer100: 2.4, over: 25000 },
    { min: 130001, max: 960000, baseDuty: 2870, ratePer100: 6.0, over: 130000 },
    { min: 960001, max: 2000000, baseDuty: 52670, ratePer100: 5.5, over: 0 },
    { min: 2000001, max: null, baseDuty: 110000, ratePer100: 6.5, over: 2000000 },
  ],
  QLD: [
    { min: 0, max: 5000, baseDuty: 0, ratePer100: 0, over: 0 },
    { min: 5001, max: 75000, baseDuty: 0, ratePer100: 1.5, over: 5000 },
    { min: 75001, max: 540000, baseDuty: 1050, ratePer100: 3.5, over: 75000 },
    { min: 540001, max: 1000000, baseDuty: 17325, ratePer100: 4.5, over: 540000 },
    { min: 1000001, max: null, baseDuty: 38025, ratePer100: 5.75, over: 1000000 },
  ],
  WA: [
    { min: 0, max: 120000, baseDuty: 0, ratePer100: 1.9, over: 0 },
    { min: 120001, max: 150000, baseDuty: 2280, ratePer100: 2.85, over: 120000 },
    { min: 150001, max: 360000, baseDuty: 3135, ratePer100: 3.8, over: 150000 },
    { min: 360001, max: 725000, baseDuty: 11115, ratePer100: 4.75, over: 360000 },
    { min: 725001, max: null, baseDuty: 28453, ratePer100: 5.15, over: 725000 },
  ],
  SA: [
    { min: 0, max: 12000, baseDuty: 0, ratePer100: 1.0, over: 0 },
    { min: 12001, max: 30000, baseDuty: 120, ratePer100: 2.0, over: 12000 },
    { min: 30001, max: 50000, baseDuty: 480, ratePer100: 3.0, over: 30000 },
    { min: 50001, max: 100000, baseDuty: 1080, ratePer100: 3.5, over: 50000 },
    { min: 100001, max: 200000, baseDuty: 2830, ratePer100: 4.0, over: 100000 },
    { min: 200001, max: 250000, baseDuty: 6830, ratePer100: 4.25, over: 200000 },
    { min: 250001, max: 300000, baseDuty: 8955, ratePer100: 4.75, over: 250000 },
    { min: 300001, max: 500000, baseDuty: 11330, ratePer100: 5.0, over: 300000 },
    { min: 500001, max: null, baseDuty: 21330, ratePer100: 5.5, over: 500000 },
  ],
  TAS: [
    { min: 0, max: 3000, baseDuty: 50, ratePer100: 0, over: 0 },
    { min: 3001, max: 25000, baseDuty: 50, ratePer100: 1.75, over: 3000 },
    { min: 25001, max: 75000, baseDuty: 435, ratePer100: 2.25, over: 25000 },
    { min: 75001, max: 200000, baseDuty: 1560, ratePer100: 3.5, over: 75000 },
    { min: 200001, max: 375000, baseDuty: 5935, ratePer100: 4.0, over: 200000 },
    { min: 375001, max: 725000, baseDuty: 12935, ratePer100: 4.25, over: 375000 },
    { min: 725001, max: null, baseDuty: 27810, ratePer100: 4.5, over: 725000 },
  ],
  NT: [
    { min: 0, max: 525000, baseDuty: 0, ratePer100: 3.1, over: 0 },
    { min: 525001, max: 3000000, baseDuty: 0, ratePer100: 4.95, over: 0 },
    { min: 3000001, max: 5000000, baseDuty: 0, ratePer100: 5.75, over: 0 },
    { min: 5000001, max: null, baseDuty: 0, ratePer100: 5.95, over: 0 },
  ],
};

export interface StateFhbRule {
  schemeName: string;
  exemptCapEstablished: number;
  concessionUpperCapEstablished: number;
  exemptCapNewHome: number | null; // null = no price cap for eligible FHB new home
  fhogNewHomeGrant: number;
  fhogNewHomeCap: number | null;
  summaryNote: string;
}

export const STATE_FHB_RULES: Record<AuState, StateFhbRule> = {
  NSW: {
    schemeName: 'First Home Buyers Assistance Scheme (FHBAS)',
    exemptCapEstablished: 800000,
    concessionUpperCapEstablished: 1000000,
    exemptCapNewHome: 800000,
    fhogNewHomeGrant: 10000,
    fhogNewHomeCap: 600000,
    summaryNote: '$0 duty up to $800k, tapered concession $800,001–$999,999, standard at $1M+.',
  },
  ACT: {
    schemeName: 'Home Buyer Concession Scheme (HBCS)',
    exemptCapEstablished: Number.MAX_SAFE_INTEGER,
    concessionUpperCapEstablished: Number.MAX_SAFE_INTEGER,
    exemptCapNewHome: null,
    fhogNewHomeGrant: 0,
    fhogNewHomeCap: null,
    summaryNote: '$0 FHB stamp duty with no property price cap from 1 July 2026 (subject to income test).',
  },
  VIC: {
    schemeName: 'VIC First Home Buyer Duty Exemption',
    exemptCapEstablished: 600000,
    concessionUpperCapEstablished: 750000,
    exemptCapNewHome: 600000,
    fhogNewHomeGrant: 10000,
    fhogNewHomeCap: 750000,
    summaryNote: '$0 duty up to $600k, tapered concession $600,001–$750,000, standard above $750k.',
  },
  QLD: {
    schemeName: 'QLD First Home Concession',
    exemptCapEstablished: 700000,
    concessionUpperCapEstablished: 800000,
    exemptCapNewHome: null,
    fhogNewHomeGrant: 30000,
    fhogNewHomeCap: 750000,
    summaryNote: 'New FHB homes $0 duty (no cap); established $0 up to $700k, tapered $700,001–$799,999.',
  },
  WA: {
    schemeName: 'WA First Home Owner Rate of Duty',
    exemptCapEstablished: 450000,
    concessionUpperCapEstablished: 600000,
    exemptCapNewHome: 450000,
    fhogNewHomeGrant: 10000,
    fhogNewHomeCap: 750000,
    summaryNote: '$0 duty up to $450k, tapered concession $450,001–$600,000.',
  },
  SA: {
    schemeName: 'SA First Home Buyer Stamp Duty Relief',
    exemptCapEstablished: 0,
    concessionUpperCapEstablished: 0,
    exemptCapNewHome: null,
    fhogNewHomeGrant: 15000,
    fhogNewHomeCap: null,
    summaryNote: '$0 duty on eligible new FHB homes (no cap); established homes pay standard duty.',
  },
  TAS: {
    schemeName: 'TAS First Home Buyer Duty Relief',
    exemptCapEstablished: 750000,
    concessionUpperCapEstablished: 750000,
    exemptCapNewHome: 750000,
    fhogNewHomeGrant: 10000,
    fhogNewHomeCap: null,
    summaryNote: '$0 duty on established/new FHB homes up to $750k.',
  },
  NT: {
    schemeName: 'NT HomeGrown Territory',
    exemptCapEstablished: 0,
    concessionUpperCapEstablished: 0,
    exemptCapNewHome: null,
    fhogNewHomeGrant: 50000,
    fhogNewHomeCap: null,
    summaryNote: 'Up to $50k grant on new builds; standard duty applies to established homes.',
  },
};

// Home Guarantee Scheme (HGS) 5% Deposit Price Caps
export const HGS_PRICE_CAPS: Record<AuState, { metroCap: number; regionalCap: number; metroLabel: string }> = {
  NSW: { metroCap: 1500000, regionalCap: 800000, metroLabel: 'Sydney' },
  ACT: { metroCap: 1000000, regionalCap: 1000000, metroLabel: 'Canberra' },
  VIC: { metroCap: 950000, regionalCap: 650000, metroLabel: 'Melbourne' },
  QLD: { metroCap: 1000000, regionalCap: 700000, metroLabel: 'Brisbane' },
  WA: { metroCap: 850000, regionalCap: 600000, metroLabel: 'Perth' },
  SA: { metroCap: 900000, regionalCap: 600000, metroLabel: 'Adelaide' },
  TAS: { metroCap: 700000, regionalCap: 550000, metroLabel: 'Hobart' },
  NT: { metroCap: 600000, regionalCap: 600000, metroLabel: 'Darwin' },
};

// ============================================================================
// Education & Career Datasets (Australian CSP/Full-Fee, Austudy, Salary Bands)
// ============================================================================

export const AUSTUDY_CONSTANTS = {
  annualBaselineSingleNoChildren: 18500,
  annualWithRentAssistanceEstimate: 22800,
  fortnightlyIncomeFreeArea: 528,
} as const;

export const QUALIFICATION_LABELS: Record<QualificationLevel, string> = {
  high_school: 'Year 12 / High School',
  cert_diploma: 'Certificate / Diploma',
  bachelor: 'Bachelor Degree',
  honours_grad_dip: 'Honours / GradDip',
  masters: 'Masters Degree',
  phd: 'PhD / Doctorate',
};

export const INDUSTRY_FIELD_LABELS: Record<IndustryField, string> = {
  tech_data: 'Tech, Software & Data',
  public_policy_gov: 'Public Policy & Government',
  engineering: 'Engineering & Infrastructure',
  finance_commerce: 'Finance, Accounting & Commerce',
  health: 'Health & Allied Clinical',
  trades: 'Skilled Trades & Construction',
  education: 'Education & Teaching',
};

export interface TuitionBand {
  cspAnnual: number;
  fullFeeAnnual: number;
  defaultDurationYears: number;
}

export const CSP_STUDENT_CONTRIBUTION_BANDS_2026 = [
  { band: 1, label: 'Band 1 — Education, Maths, Nursing, Languages', annualPerEftsl: 4738 },
  { band: 2, label: 'Band 2 — IT/Computing, Engineering, Science, Health', annualPerEftsl: 9537 },
  { band: 3, label: 'Band 3 — Medicine, Dentistry, Vet Science', annualPerEftsl: 13558 },
  { band: 4, label: 'Band 4 — Law, Commerce, Economics, Policy/Society', annualPerEftsl: 17399 },
] as const;

export const SSAF_2026 = {
  fullTimeAnnual: 373,
  partTimeAnnual: 280,
} as const;

export const STUDENT_STARTUP_LOAN_2026 = {
  perPeriod: 1349,
  maxPeriodsPerYear: 2,
} as const;

export const ANNUAL_TUITION_BY_FIELD: Record<IndustryField, TuitionBand> = {
  tech_data: { cspAnnual: 9537, fullFeeAnnual: 42000, defaultDurationYears: 2 },
  public_policy_gov: { cspAnnual: 17399, fullFeeAnnual: 36000, defaultDurationYears: 1.5 },
  engineering: { cspAnnual: 9537, fullFeeAnnual: 44000, defaultDurationYears: 2 },
  finance_commerce: { cspAnnual: 17399, fullFeeAnnual: 45000, defaultDurationYears: 2 },
  health: { cspAnnual: 9537, fullFeeAnnual: 48000, defaultDurationYears: 2 },
  trades: { cspAnnual: 4738, fullFeeAnnual: 12000, defaultDurationYears: 2 },
  education: { cspAnnual: 4738, fullFeeAnnual: 28000, defaultDurationYears: 2 },
};

export const QUALIFICATION_TUITION_MULTIPLIER: Record<QualificationLevel, number> = {
  high_school: 0,
  cert_diploma: 0.55,
  bachelor: 1.0,
  honours_grad_dip: 1.0,
  masters: 1.05,
  phd: 0, // RTP / research scholarship typically covers tuition
};

export interface FieldSalaryProgression {
  entry: { min: number; median: number; max: number };
  mid: { min: number; median: number; max: number };
  senior: { min: number; median: number; max: number };
  lead: { min: number; median: number; max: number };
}

export const INDUSTRY_SALARY_BANDS: Record<IndustryField, FieldSalaryProgression> = {
  tech_data: {
    entry: { min: 72000, median: 85000, max: 105000 },
    mid: { min: 105000, median: 128000, max: 155000 },
    senior: { min: 150000, median: 175000, max: 210000 },
    lead: { min: 195000, median: 225000, max: 280000 },
  },
  public_policy_gov: {
    entry: { min: 72000, median: 82000, max: 92000 },
    mid: { min: 95000, median: 112000, max: 128000 },
    senior: { min: 125000, median: 142000, max: 165000 },
    lead: { min: 158000, median: 178000, max: 215000 },
  },
  engineering: {
    entry: { min: 75000, median: 84000, max: 96000 },
    mid: { min: 100000, median: 120000, max: 142000 },
    senior: { min: 140000, median: 162000, max: 190000 },
    lead: { min: 180000, median: 208000, max: 250000 },
  },
  finance_commerce: {
    entry: { min: 68000, median: 78000, max: 95000 },
    mid: { min: 95000, median: 118000, max: 145000 },
    senior: { min: 140000, median: 168000, max: 205000 },
    lead: { min: 190000, median: 230000, max: 300000 },
  },
  health: {
    entry: { min: 70000, median: 80000, max: 92000 },
    mid: { min: 92000, median: 108000, max: 126000 },
    senior: { min: 120000, median: 142000, max: 170000 },
    lead: { min: 155000, median: 185000, max: 240000 },
  },
  trades: {
    entry: { min: 62000, median: 74000, max: 88000 },
    mid: { min: 88000, median: 104000, max: 125000 },
    senior: { min: 118000, median: 135000, max: 165000 },
    lead: { min: 145000, median: 170000, max: 210000 },
  },
  education: {
    entry: { min: 76000, median: 82000, max: 88000 },
    mid: { min: 90000, median: 105000, max: 118000 },
    senior: { min: 115000, median: 125000, max: 138000 },
    lead: { min: 135000, median: 152000, max: 175000 },
  },
};

export const QUALIFICATION_SALARY_UPLIFT: Record<QualificationLevel, number> = {
  high_school: 0.84,
  cert_diploma: 0.93,
  bachelor: 1.0,
  honours_grad_dip: 1.05,
  masters: 1.12,
  phd: 1.16,
};

// ============================================================================
// City Cost-of-Living, Rent & FHB Comparison Data (Sydney vs Canberra & Peers)
// ============================================================================

export interface CityMarketBenchmark {
  city: string;
  state: AuState;
  medianUnitWeeklyRent: number;
  medianHouseWeeklyRent: number;
  medianFhbUnitPrice: number;
  medianFhbHousePrice: number;
  salaryMultiplierVsNational: number;
  monthlyTransportAndLivingIndex: number;
}

export const CITY_MARKET_BENCHMARKS: readonly CityMarketBenchmark[] = [
  {
    city: 'Sydney',
    state: 'NSW',
    medianUnitWeeklyRent: 720,
    medianHouseWeeklyRent: 880,
    medianFhbUnitPrice: 780000,
    medianFhbHousePrice: 1250000,
    salaryMultiplierVsNational: 1.08,
    monthlyTransportAndLivingIndex: 1.15,
  },
  {
    city: 'Canberra',
    state: 'ACT',
    medianUnitWeeklyRent: 575,
    medianHouseWeeklyRent: 690,
    medianFhbUnitPrice: 610000,
    medianFhbHousePrice: 880000,
    salaryMultiplierVsNational: 1.05,
    monthlyTransportAndLivingIndex: 1.02,
  },
  {
    city: 'Melbourne',
    state: 'VIC',
    medianUnitWeeklyRent: 560,
    medianHouseWeeklyRent: 630,
    medianFhbUnitPrice: 620000,
    medianFhbHousePrice: 890000,
    salaryMultiplierVsNational: 1.02,
    monthlyTransportAndLivingIndex: 1.04,
  },
  {
    city: 'Brisbane',
    state: 'QLD',
    medianUnitWeeklyRent: 610,
    medianHouseWeeklyRent: 690,
    medianFhbUnitPrice: 640000,
    medianFhbHousePrice: 870000,
    salaryMultiplierVsNational: 0.99,
    monthlyTransportAndLivingIndex: 1.0,
  },
  {
    city: 'Perth',
    state: 'WA',
    medianUnitWeeklyRent: 620,
    medianHouseWeeklyRent: 685,
    medianFhbUnitPrice: 580000,
    medianFhbHousePrice: 780000,
    salaryMultiplierVsNational: 1.01,
    monthlyTransportAndLivingIndex: 0.99,
  },
  {
    city: 'Adelaide',
    state: 'SA',
    medianUnitWeeklyRent: 530,
    medianHouseWeeklyRent: 620,
    medianFhbUnitPrice: 560000,
    medianFhbHousePrice: 760000,
    salaryMultiplierVsNational: 0.96,
    monthlyTransportAndLivingIndex: 0.96,
  },
];
