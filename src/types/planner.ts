export type FinancialYear = '2026-27' | '2025-26';

export type AuState = 'NSW' | 'ACT' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'NT';

export type QualificationLevel =
  | 'high_school'
  | 'cert_diploma'
  | 'bachelor'
  | 'honours_grad_dip'
  | 'masters'
  | 'phd';

export type IndustryField =
  | 'tech_data'
  | 'public_policy_gov'
  | 'engineering'
  | 'finance_commerce'
  | 'health'
  | 'trades'
  | 'education';

export type EmploymentStatus = 'full_time' | 'part_time' | 'studying_austudy' | 'casual';

export type DepositStrategy = '5_hgs' | '10_lmi' | '20_no_lmi';

export type TabId =
  | 'overview'
  | 'housing'
  | 'mortgage'
  | 'rent'
  | 'rent_vs_buy'
  | 'super'
  | 'hecs'
  | 'novated'
  | 'career';

export type ActionHorizon = 'Immediate' | '1-12 Months' | '1-3 Years' | '3+ Years';

export interface StudyPlan {
  targetQualification: QualificationLevel;
  field: IndustryField;
  isCsp: boolean;
  studyMode: 'full_time' | 'part_time' | 'none';
  durationYears: number;
  partTimeStudyIncome: number;
  expectedGradIncomeOverride?: number;
  partTimeWorkFullTime?: boolean;
  annualStudentContributionOverride?: number;
  includeSsaf?: boolean;
}

export interface NovatedLeaseInput {
  enabled: boolean;
  vehiclePrice: number;
  isEv: boolean;
  leaseTermYears: 1 | 2 | 3 | 4 | 5;
  annualRunningCosts: number;
  financeRatePct: number;
  annualKm: number;
}

export interface PlannerProfile {
  id: string;
  name: string;
  financialYear: FinancialYear;
  state: AuState;
  cityLabel: string;
  age: number;
  relationshipStatus: 'single' | 'couple';
  dependents: number;
  employmentStatus: EmploymentStatus;
  grossSalary: number;
  partnerGrossSalary: number;
  salaryGrowthPct: number;
  superRatePct: number;
  currentSuperBalance: number;
  salarySacrificeAnnual: number;
  carryForwardUnusedCap: number;
  hasPrivateHospitalCover: boolean;
  currentCashSavings: number;
  currentInvestments: number;
  investmentReturnPct: number;
  currentMonthlyLivingExpenses: number;
  currentWeeklyRent: number;
  hecsBalance: number;
  hecsVoluntaryExtraAnnual: number;
  hecsFutureStudy?: HecsFutureStudyInput;
  currentQualification: QualificationLevel;
  currentField: IndustryField;
  studyPlan: StudyPlan;
  targetPropertyPrice: number;
  isFirstHomeBuyer: boolean;
  isNewHome: boolean;
  depositStrategy: DepositStrategy;
  targetHomeYears: number;
  targetMortgageRatePct: number;
  novatedLease: NovatedLeaseInput;
}

// ============================================================================
// Tax Engine Types
// ============================================================================

export interface TaxInput {
  financialYear: FinancialYear;
  grossSalary: number;
  partnerGrossSalary?: number;
  relationshipStatus?: 'single' | 'couple';
  dependents?: number;
  salarySacrificeSuper?: number;
  preTaxDeductions?: number;
  reportableFringeBenefits?: number;
  reportableEmployerSuper?: number;
  netInvestmentLosses?: number;
  hasPrivateHospitalCover: boolean;
  hecsBalance: number;
}

export interface TaxBracketBreakdownItem {
  label: string;
  min: number;
  max: number | null;
  rate: number;
  taxableInBracket: number;
  taxPaid: number;
}

export interface TaxSummary {
  financialYear: FinancialYear;
  grossIncome: number;
  taxableIncome: number;
  repaymentIncome: number;
  mlsIncome: number;
  incomeTax: number;
  litoOffset: number;
  medicareLevy: number;
  medicareLevySurcharge: number;
  mlsRatePct: number;
  hecsCompulsoryRepayment: number;
  totalTaxAndHecs: number;
  netAnnualIncome: number;
  netMonthlyIncome: number;
  netFortnightlyIncome: number;
  marginalTaxRate: number;
  effectiveMarginalRateWithMedicare: number;
  effectiveTaxRatePct: number;
  bracketBreakdown: TaxBracketBreakdownItem[];
  alerts: string[];
}

// ============================================================================
// HECS-HELP Engine Types
// ============================================================================

export interface HecsFutureStudyInput {
  enabled: boolean;
  unitsPerTerm: number;
  termsPerYear: 2 | 3;
  totalUnitsRemaining: number;
  unitsPerEftsl: number;
  annualFeePerEftsl: number;
  includeSsaf: boolean;
  ssafAnnualAmount: number;
  includeSsl?: boolean;
  sslInstalments?: number;
  sslAmountPerInstalment?: number;
}

export interface HecsSimulationInput {
  financialYear: FinancialYear;
  startingBalance: number;
  grossSalary: number;
  salaryGrowthPct: number;
  indexationRatePct: number;
  voluntaryExtraAnnual: number;
  reportableFringeBenefits?: number;
  reportableEmployerSuper?: number;
  maxYears?: number;
  futureStudy?: HecsFutureStudyInput;
}

export interface HecsProjectionYear {
  yearIndex: number;
  calendarYear: number;
  salary: number;
  repaymentIncome: number;
  openingBalance: number;
  unitsCompletedThisYear: number;
  tuitionAddedThisYear: number;
  ssafAddedThisYear: number;
  sslAddedThisYear: number;
  newDebtAdded: number;
  indexationAdded: number;
  compulsoryRepayment: number;
  voluntaryExtra: number;
  closingBalance: number;
  cumulativeRepaid: number;
  baselineClosingBalance: number;
}

export interface HecsSummary {
  startingBalance: number;
  yearOneCompulsoryRepayment: number;
  yearOneRepaymentIncome: number;
  yearOneIndexation: number;
  yearsToPayoff: number | null;
  baselineYearsToPayoff: number | null;
  yearsSavedWithExtra: number;
  totalInterestIndexationPaid: number;
  totalPaid: number;
  indexationSavedWithExtra: number;
  totalNewStudyDebtAdded: number;
  totalNewTuitionAdded: number;
  totalNewSsafAdded: number;
  totalNewSslAdded: number;
  peakBalance: number;
  peakBalanceCalendarYear: number | null;
  studyCompletionYears: number;
  projections: HecsProjectionYear[];
  notes: string[];
}

// ============================================================================
// Super & FHSSS Engine Types
// ============================================================================

export interface SuperInput {
  financialYear: FinancialYear;
  age: number;
  grossSalary: number;
  superRatePct: number;
  currentSuperBalance: number;
  salarySacrificeAnnual: number;
  carryForwardUnusedCap: number;
  investmentReturnPct: number;
  targetFhsssYears: number;
  marginalTaxRateWithMedicare: number;
}

export interface FhsssProjection {
  annualEligibleContribution: number;
  yearsContributed: number;
  totalEligibleContributions: number;
  netContributionsAfter15PctTax: number;
  deemedEarningsSic: number;
  grossReleasableAmount: number;
  withdrawalTaxRatePct: number;
  estimatedWithdrawalTax: number;
  netFhsssReleaseAmount: number;
  taxSavedVsCashSaving: number;
}

export interface SuperProjectionPoint {
  year: number;
  age: number;
  balanceBaseline: number;
  balanceWithSacrifice: number;
  annualConcessionalTotal: number;
}

export interface SuperSummary {
  financialYear: FinancialYear;
  employerSgAnnual: number;
  salarySacrificeAnnual: number;
  totalConcessionalAnnual: number;
  concessionalCap: number;
  carryForwardAvailable: number;
  effectiveMaxCap: number;
  remainingCapSpace: number;
  excessConcessionalAmount: number;
  div293Triggered: boolean;
  div293Tax: number;
  contributionsTax15Pct: number;
  netSuperAddedThisYear: number;
  incomeTaxSavedThisYear: number;
  takeHomePayReductionAnnual: number;
  projectedBalanceAt60Baseline: number;
  projectedBalanceAt60WithSacrifice: number;
  fhsss: FhsssProjection;
  projectionSeries: SuperProjectionPoint[];
  alerts: string[];
}

// ============================================================================
// Housing Deposit & Rent Budget Engine Types
// ============================================================================

export interface HouseDepositInput {
  state: AuState;
  cityLabel: string;
  propertyPrice: number;
  isFirstHomeBuyer: boolean;
  isNewHome: boolean;
  depositStrategy: DepositStrategy;
  targetHomeYears: number;
  targetMortgageRatePct: number;
  currentCashSavings: number;
  currentInvestments: number;
  investmentReturnPct: number;
  annualSavingsCapacity: number;
  fhsssNetContribution: number;
  householdGrossIncome: number;
  isCouple: boolean;
}

export interface DepositScenarioComparison {
  strategy: DepositStrategy;
  label: string;
  depositPct: number;
  depositAmount: number;
  lmiEstimate: number;
  stampDuty: number;
  totalUpfrontCashRequired: number;
  loanAmount: number;
  monthlyMortgageRepayment: number;
  yearsToReachTarget: number;
  hgsEligible: boolean;
}

export interface HouseDepositTimelinePoint {
  year: number;
  projectedSavings: number;
  targetUpfrontRequired: number;
}

export interface HouseDepositSummary {
  state: AuState;
  propertyPrice: number;
  depositStrategy: DepositStrategy;
  depositPct: number;
  depositRequired: number;
  stampDutyStandard: number;
  stampDutyWithConcession: number;
  stampDutySaved: number;
  fhogGrantAmount: number;
  lmiEstimate: number;
  legalAndMiscCosts: number;
  totalUpfrontCashRequired: number;
  loanAmount: number;
  lvrPct: number;
  monthlyMortgageRepayment: number;
  fortnightlyMortgageRepayment: number;
  mortgageStressPctOfNetIncome: number;
  hgsCapForCity: number;
  hgsEligible: boolean;
  availableLiquidNow: number;
  fhsssBoostApplied: number;
  fundingGapNow: number;
  estimatedYearsToReady: number;
  onTrackForTargetYears: boolean;
  strategyComparisons: DepositScenarioComparison[];
  timelineSeries: HouseDepositTimelinePoint[];
  notes: string[];
}

export interface RentBudgetInput {
  netMonthlyIncome: number;
  partnerNetMonthlyIncome?: number;
  weeklyRent: number;
  monthlyLivingExpenses: number;
  state: AuState;
  cityLabel: string;
  currentLiquidAssets: number;
  investmentReturnPct: number;
  targetUpfrontCash: number;
}

export interface RentBudgetBreakdownItem {
  category: string;
  monthlyAmount: number;
  pctOfNet: number;
}

export interface RentVsBuyComparison {
  city: string;
  medianUnitWeeklyRent: number;
  medianHouseWeeklyRent: number;
  annualRentCost: number;
  estimatedMonthlyMortgageOnTarget: number;
}

export interface RentBudgetSummary {
  householdNetMonthlyIncome: number;
  monthlyRent: number;
  annualRent: number;
  monthlyLivingExpenses: number;
  monthlyTotalOutgoings: number;
  monthlySurplus: number;
  annualSavingsCapacity: number;
  rentToNetIncomePct: number;
  savingsRatePct: number;
  rentStressLevel: 'comfortable' | 'moderate' | 'stressed';
  budgetBreakdown: RentBudgetBreakdownItem[];
  cityRentComparisons: RentVsBuyComparison[];
  notes: string[];
}

// ============================================================================
// Novated Lease Engine Types
// ============================================================================

export interface NovatedLeaseCalcInput {
  financialYear: FinancialYear;
  grossSalary: number;
  hasPrivateHospitalCover: boolean;
  hecsBalance: number;
  lease: NovatedLeaseInput;
}

export interface NovatedLeaseComparisonPoint {
  label: string;
  cashCost: number;
  novatedCost: number;
}

export interface NovatedLeaseSummary {
  enabled: boolean;
  vehiclePrice: number;
  isEv: boolean;
  gstSavedOnPurchase: number;
  financedAmountExGst: number;
  residualPct: number;
  residualValueIncGst: number;
  annualFinancePayment: number;
  annualRunningCosts: number;
  totalAnnualLeasePackageCost: number;
  fbtExemptUnderCurrentRules: boolean;
  postApril2027EvTransitionNote: string;
  preTaxDeductionAnnual: number;
  postTaxEcmContributionAnnual: number;
  rfbaAmount: number;
  incomeTaxAndMedicareSavedAnnual: number;
  hecsImpactAnnual: number;
  mlsImpactAnnual: number;
  netTakeHomePayReductionAnnual: number;
  netTakeHomePayReductionFortnightly: number;
  cashPurchaseTotalCostOverTerm: number;
  novatedLeaseNetCostOverTerm: number;
  netSavingsVsCashOverTerm: number;
  effectiveDiscountPct: number;
  comparisonChart: NovatedLeaseComparisonPoint[];
  alerts: string[];
}

// ============================================================================
// Education & Career Engine Types
// ============================================================================

export interface EducationScenarioComparison {
  id: string;
  label: string;
  qualification: QualificationLevel;
  field: IndustryField;
  isCsp: boolean;
  studyMode: 'full_time' | 'part_time' | 'none';
  durationYears: number;
  tuitionTotal: number;
  opportunityCostTotal: number;
  totalEconomicCost: number;
  expectedGradIncome: number;
  incomeUpliftAnnual: number;
  breakEvenYears: number | null;
  tenYearNetWealthDelta: number;
}

export interface EducationEarningsPoint {
  year: number;
  noStudyCumulative: number;
  selectedStudyCumulative: number;
  fullFeeAlternativeCumulative: number;
}

export interface EducationRoiSummary {
  selectedScenario: EducationScenarioComparison;
  baselineNoStudyIncome: number;
  austudyEligibleDuringStudy: boolean;
  annualStudyLivingIncome: number;
  partTimeWorkFullTimeActive: boolean;
  studentContributionAnnualPerEftsl: number;
  courseEftsl: number;
  studentContributionTotal: number;
  ssafTotal: number;
  tuitionAnnual: number;
  tuitionTotalAddedToHecs: number;
  foregoneIncomeDuringStudy: number;
  expectedPostStudyGrossIncome: number;
  breakEvenYears: number | null;
  fiveYearNetWealthDelta: number;
  tenYearNetWealthDelta: number;
  cspVsFullFeeSavings: number;
  scenarios: EducationScenarioComparison[];
  cumulativeEarningsSeries: EducationEarningsPoint[];
  notes: string[];
}

export interface CareerMilestone {
  stage: 'entry' | 'mid' | 'senior' | 'lead';
  label: string;
  typicalYearsExp: string;
  salaryMin: number;
  salaryMedian: number;
  salaryMax: number;
}

export interface CityCareerComparison {
  sydneyMedianSalaryMultiplier: number;
  canberraMedianSalaryMultiplier: number;
  sydneyMedianRentWeekly: number;
  canberraMedianRentWeekly: number;
  netDisposableDeltaCanberraVsSydneyAnnual: number;
}

export interface CareerPathwaySummary {
  currentField: IndustryField;
  targetField: IndustryField;
  currentEstimatedBand: CareerMilestone;
  milestones: CareerMilestone[];
  currentSalaryPercentileNote: string;
  requiredIncomeForGoals: number;
  incomeGapToGoals: number;
  projectedYearsToRequiredIncome: number | null;
  cityComparison: CityCareerComparison;
  notes: string[];
}

// ============================================================================
// Integrated LifePlan Summary
// ============================================================================

export interface ActionStep {
  id: string;
  horizon: ActionHorizon;
  category: 'tax' | 'housing' | 'super' | 'hecs' | 'novated' | 'career' | 'budget';
  title: string;
  description: string;
  estimatedAnnualImpactAud: number;
  priority: 'high' | 'medium' | 'low';
}

export interface GoalReadiness {
  overallScore: number;
  statusLabel: 'On Track' | 'Needs Adjustment' | 'Stretch Goal';
  housingReadinessPct: number;
  cashflowHealthPct: number;
  retirementTrajectoryPct: number;
  hecsTrajectoryPct: number;
  summaryHeadline: string;
}

export interface NetWorthProjectionPoint {
  year: number;
  age: number;
  liquidAndInvestments: number;
  superBalance: number;
  homeEquityEstimated: number;
  hecsDebt: number;
  netWorth: number;
}

export interface LifePlanSummary {
  profile: PlannerProfile;
  tax: TaxSummary;
  partnerTax: TaxSummary | null;
  hecs: HecsSummary;
  superSummary: SuperSummary;
  rentBudget: RentBudgetSummary;
  houseDeposit: HouseDepositSummary;
  novatedLease: NovatedLeaseSummary;
  educationRoi: EducationRoiSummary;
  careerPathway: CareerPathwaySummary;
  readiness: GoalReadiness;
  actionPlan: ActionStep[];
  netWorthProjection: NetWorthProjectionPoint[];
}

// ============================================================================
// Mortgage Loan Approval Engine Types
// ============================================================================

export type CreditScoreBand = 'excellent' | 'very_good' | 'good' | 'fair';

export interface MortgageApprovalInput {
  financialYear: FinancialYear;
  state: AuState;
  cityLabel: string;
  relationshipStatus: 'single' | 'couple';
  dependents: number;
  employmentStatus: EmploymentStatus;
  grossSalary: number;
  partnerGrossSalary: number;
  bonusOrOtherIncomeAnnual: number;
  hasPrivateHospitalCover: boolean;
  hecsBalance: number;
  monthlyLivingExpenses: number;
  creditCardLimitsTotal: number;
  existingMonthlyDebtRepayments: number;
  novatedLeaseAnnualPreTax: number;
  propertyPrice: number;
  depositAmount: number;
  isFirstHomeBuyer: boolean;
  isNewHome: boolean;
  interestRatePct: number;
  apraBufferPct: number;
  loanTermYears: number;
  creditScoreBand: CreditScoreBand;
}

export interface UnderwritingGate {
  id: 'serviceability' | 'lvr' | 'dti' | 'profile';
  label: string;
  status: 'pass' | 'borderline' | 'fail';
  actualDisplay: string;
  benchmarkDisplay: string;
  detail: string;
}

export interface BorrowingImpactItem {
  name: string;
  amount: number;
  color: string;
}

export interface RateStressPoint {
  rateLabel: string;
  ratePct: number;
  monthlyRepayment: number;
  monthlySurplus: number;
  isAssessmentRate: boolean;
}

export interface MortgageApprovalSummary {
  verdict: 'Likely Approved' | 'Conditional / Borderline' | 'Unlikely / Declined';
  approvalScore: number;
  requestedLoanAmount: number;
  maxBorrowingPower: number;
  borrowingSurplusOrShortfall: number;
  lvrPct: number;
  hgsEligible: boolean;
  lmiEstimate: number;
  stampDuty: number;
  totalCashNeeded: number;
  dtiRatio: number;
  assessmentRatePct: number;
  actualMonthlyRepayment: number;
  stressedMonthlyRepayment: number;
  assessedNetMonthlyIncome: number;
  assessedLivingMonthly: number;
  hemFloorMonthly: number;
  creditCardMonthlyAssessment: number;
  hecsMonthlyImpact: number;
  totalMonthlyCommitments: number;
  netMonthlySurplusAtStress: number;
  borrowingPowerWithoutCards: number;
  borrowingPowerWithoutHecs: number;
  borrowingLostToCards: number;
  borrowingLostToHecs: number;
  gates: UnderwritingGate[];
  borrowingBreakdown: BorrowingImpactItem[];
  rateStressSeries: RateStressPoint[];
  unlockActions: string[];
}

// ============================================================================
// Rent vs Buy (Mortgage) Comparison Types
// ============================================================================

export interface RentVsBuyInput {
  state: AuState;
  cityLabel: string;
  propertyPrice: number;
  depositPct: number;
  isFirstHomeBuyer: boolean;
  isNewHome: boolean;
  mortgageRatePct: number;
  loanTermYears: number;
  capitalGrowthPct: number;
  inflationRatePct: number;
  weeklyRent: number;
  annualRentIncreasePct: number;
  rentersInsuranceAnnual: number;
  investmentReturnPct: number;
  marginalTaxRatePct: number;
  strataAnnual: number;
  councilRatesAnnual: number;
  waterRatesAnnual: number;
  homeInsuranceAnnual: number;
  maintenancePctOfValue: number;
  buyingCostsFixed: number;
  sellingCostsPct: number;
  horizonYears: number;
  offsetBalanceInitial?: number;
  offsetMonthlyContribution?: number;
  annualOffsetFee?: number;
}

export interface RentVsBuyYearPoint {
  year: number;
  propertyValue: number;
  loanBalance: number;
  buyerNetWealthNominal: number;
  buyerNetWealthReal: number;
  renterNetWealthNominal: number;
  renterNetWealthReal: number;
  annualRentCost: number;
  annualOwnershipTotalCost: number;
  annualMortgageInterest: number;
  annualOwnershipRunningCosts: number;
  cumulativeRentUnrecoverable: number;
  cumulativeBuyUnrecoverable: number;
}

export interface RentVsBuyCostItem {
  label: string;
  amount: number;
  side: 'rent' | 'buy';
  color: string;
}

export interface RentVsBuySummary {
  horizonYears: number;
  winner: 'buy' | 'rent' | 'tie';
  winnerReal: 'buy' | 'rent' | 'tie';
  initialCashRequired: number;
  depositAmount: number;
  stampDuty: number;
  lmiEstimate: number;
  buyingCostsFixed: number;
  initialLoanAmount: number;
  buyerNetWealthNominal: number;
  renterNetWealthNominal: number;
  netWealthDiffNominal: number;
  buyerNetWealthReal: number;
  renterNetWealthReal: number;
  netWealthDiffReal: number;
  breakEvenYearNominal: number | null;
  breakEvenYearReal: number | null;
  yearOneMonthlyRent: number;
  yearOneMonthlyMortgagePI: number;
  yearOneMonthlyMortgageInterest: number;
  yearOneMonthlyRunningCosts: number;
  yearOneMonthlyOwnTotal: number;
  totalRentPaid: number;
  totalRentersInsurance: number;
  totalRentUnrecoverable: number;
  totalMortgageInterest: number;
  totalPrincipalRepaid: number;
  totalStrata: number;
  totalCouncil: number;
  totalWater: number;
  totalHomeInsurance: number;
  totalMaintenance: number;
  upfrontSunkCosts: number;
  estimatedSellingCosts: number;
  totalBuyUnrecoverable: number;
  offsetBalanceInitial: number;
  offsetMonthlyContribution: number;
  finalOffsetBalance: number;
  totalOffsetInterestSaved: number;
  offsetTaxFreeEquivalentRatePct: number;
  offsetTaxFreeEquivalentEtfRatePct: number;
  costBreakdown: RentVsBuyCostItem[];
  yearlySeries: RentVsBuyYearPoint[];
  insights: string[];
}

// ============================================================================
// Mortgage Offset Account Engine Types
// ============================================================================

export interface MortgageOffsetInput {
  loanAmount: number;
  annualRatePct: number;
  loanTermYears: number;
  initialOffsetBalance: number;
  monthlyOffsetContribution: number;
  annualOffsetFee?: number;
  marginalTaxRateWithMedicarePct: number;
  hisaRatePct?: number;
}

export interface MortgageOffsetYearPoint {
  year: number;
  baselineLoanBalance: number;
  offsetLoanBalance: number;
  offsetCashBalance: number;
  netDebtWithOffset: number;
  cumulativeInterestSaved: number;
}

export interface MortgageOffsetSummary {
  loanAmount: number;
  annualRatePct: number;
  loanTermYears: number;
  scheduledMonthlyRepayment: number;
  baselineTotalInterest: number;
  offsetTotalInterest: number;
  grossInterestSaved: number;
  totalOffsetFeesPaid: number;
  netInterestSavedAfterFees: number;
  baselineMonths: number;
  offsetMonths: number;
  monthsSavedPayoff: number;
  yearsSavedPayoff: number;
  monthsToFullOffset: number | null;
  yearsToFullOffset: number | null;
  yearOneInterestSaved: number;
  yearOneHisaAfterTaxInterest: number;
  yearOneNetAdvantageVsHisa: number;
  taxFreeEquivalentHisaRatePct: number;
  taxFreeEquivalentEtfRatePct: number;
  breakEvenOffsetBalanceForFee: number;
  finalOffsetCashBalance: number;
  yearlySeries: MortgageOffsetYearPoint[];
}
