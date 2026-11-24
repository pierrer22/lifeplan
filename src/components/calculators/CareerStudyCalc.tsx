import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRightLeft, Check, GraduationCap, RotateCcw } from 'lucide-react';
import {
  ANNUAL_TUITION_BY_FIELD,
  CSP_STUDENT_CONTRIBUTION_BANDS_2026,
  INDUSTRY_FIELD_LABELS,
  QUALIFICATION_LABELS,
  QUALIFICATION_TUITION_MULTIPLIER,
  SSAF_2026,
  STATE_FHB_RULES,
  SUPER_CONSTANTS,
} from '../../data/auConstants';
import { analyzeCareerPathway, analyzeEducationRoi } from '../../engine';
import { usePlanner } from '../../context/PlannerContext';
import type { IndustryField, QualificationLevel } from '../../types/planner';
import {
  AlertBanner,
  Badge,
  CHART_STYLES,
  CurrencyInput,
  SectionCard,
  SliderField,
  StatCard,
  formatAUD,
  formatPercent,
} from '../SharedPrimitives';

const QUALIFICATIONS: readonly QualificationLevel[] = [
  'high_school',
  'cert_diploma',
  'bachelor',
  'honours_grad_dip',
  'masters',
  'phd',
];

const FIELDS: readonly IndustryField[] = [
  'public_policy_gov',
  'tech_data',
  'engineering',
  'finance_commerce',
  'health',
  'trades',
  'education',
];

export const CareerStudyCalc: React.FC = () => {
  const { profile, patchProfile, lifePlan } = usePlanner();

  const [targetQualification, setTargetQualification] =
    useState<QualificationLevel>(profile.studyPlan.targetQualification);
  const [field, setField] = useState<IndustryField>(profile.studyPlan.field);
  const [isCsp, setIsCsp] = useState(profile.studyPlan.isCsp);
  const [studyMode, setStudyMode] = useState<'full_time' | 'part_time' | 'none'>(
    profile.studyPlan.studyMode
  );
  const [durationYears, setDurationYears] = useState(
    profile.studyPlan.durationYears
  );
  const [partTimeStudyIncome, setPartTimeStudyIncome] = useState(
    profile.studyPlan.partTimeStudyIncome
  );
  const [partTimeWorkFullTime, setPartTimeWorkFullTime] = useState<boolean>(
    profile.studyPlan.partTimeWorkFullTime ?? true
  );
  const [annualStudentContributionOverride, setAnnualStudentContributionOverride] =
    useState<number | undefined>(profile.studyPlan.annualStudentContributionOverride);
  const [includeSsaf, setIncludeSsaf] = useState<boolean>(
    profile.studyPlan.includeSsaf ?? true
  );

  useEffect(() => {
    setTargetQualification(profile.studyPlan.targetQualification);
    setField(profile.studyPlan.field);
    setIsCsp(profile.studyPlan.isCsp);
    setStudyMode(profile.studyPlan.studyMode);
    setDurationYears(profile.studyPlan.durationYears);
    setPartTimeStudyIncome(profile.studyPlan.partTimeStudyIncome);
    setPartTimeWorkFullTime(profile.studyPlan.partTimeWorkFullTime ?? true);
    setAnnualStudentContributionOverride(
      profile.studyPlan.annualStudentContributionOverride
    );
    setIncludeSsaf(profile.studyPlan.includeSsaf ?? true);
  }, [
    profile.id,
    profile.studyPlan.targetQualification,
    profile.studyPlan.field,
    profile.studyPlan.isCsp,
    profile.studyPlan.studyMode,
    profile.studyPlan.durationYears,
    profile.studyPlan.partTimeStudyIncome,
    profile.studyPlan.partTimeWorkFullTime,
    profile.studyPlan.annualStudentContributionOverride,
    profile.studyPlan.includeSsaf,
  ]);

  const defaultStudentContributionPerEftsl = useMemo(() => {
    const band = ANNUAL_TUITION_BY_FIELD[field];
    const mult = QUALIFICATION_TUITION_MULTIPLIER[targetQualification];
    return Math.round((isCsp ? band.cspAnnual : band.fullFeeAnnual) * mult);
  }, [field, targetQualification, isCsp]);

  const displayedStudentContributionPerEftsl =
    annualStudentContributionOverride ?? defaultStudentContributionPerEftsl;

  const eduSummary = useMemo(
    () =>
      analyzeEducationRoi(profile, {
        targetQualification,
        field,
        isCsp,
        studyMode,
        durationYears,
        partTimeStudyIncome,
        partTimeWorkFullTime,
        annualStudentContributionOverride,
        includeSsaf,
      }),
    [
      profile,
      targetQualification,
      field,
      isCsp,
      studyMode,
      durationYears,
      partTimeStudyIncome,
      partTimeWorkFullTime,
      annualStudentContributionOverride,
      includeSsaf,
    ]
  );

  const requiredIncomeForGoals = useMemo(() => {
    const annualMortgage =
      lifePlan.houseDeposit.monthlyMortgageRepayment * 12;
    return Math.max(65000, Math.round(annualMortgage / 0.3));
  }, [lifePlan.houseDeposit.monthlyMortgageRepayment]);

  const simulatedProfile = useMemo(
    () => ({
      ...profile,
      studyPlan: {
        ...profile.studyPlan,
        targetQualification,
        field,
        isCsp,
        studyMode,
        durationYears,
        partTimeStudyIncome,
        partTimeWorkFullTime,
        annualStudentContributionOverride,
        includeSsaf,
      },
    }),
    [
      profile,
      targetQualification,
      field,
      isCsp,
      studyMode,
      durationYears,
      partTimeStudyIncome,
      partTimeWorkFullTime,
      annualStudentContributionOverride,
      includeSsaf,
    ]
  );

  const careerSummary = useMemo(
    () => analyzeCareerPathway(simulatedProfile, requiredIncomeForGoals),
    [simulatedProfile, requiredIncomeForGoals]
  );

  const ladderMax = useMemo(() => {
    const maxMilestone = Math.max(
      ...careerSummary.milestones.map((m) => m.salaryMax),
      requiredIncomeForGoals,
      eduSummary.expectedPostStudyGrossIncome,
      profile.grossSalary
    );
    return Math.max(150000, maxMilestone);
  }, [
    careerSummary.milestones,
    requiredIncomeForGoals,
    eduSummary.expectedPostStudyGrossIncome,
    profile.grossSalary,
  ]);

  const isDirty =
    targetQualification !== profile.studyPlan.targetQualification ||
    field !== profile.studyPlan.field ||
    isCsp !== profile.studyPlan.isCsp ||
    studyMode !== profile.studyPlan.studyMode ||
    durationYears !== profile.studyPlan.durationYears ||
    partTimeStudyIncome !== profile.studyPlan.partTimeStudyIncome ||
    partTimeWorkFullTime !== (profile.studyPlan.partTimeWorkFullTime ?? true) ||
    annualStudentContributionOverride !==
      profile.studyPlan.annualStudentContributionOverride ||
    includeSsaf !== (profile.studyPlan.includeSsaf ?? true);

  const handleApply = () => {
    patchProfile({
      studyPlan: {
        ...profile.studyPlan,
        targetQualification,
        field,
        isCsp,
        studyMode,
        durationYears,
        partTimeStudyIncome,
        partTimeWorkFullTime,
        annualStudentContributionOverride,
        includeSsaf,
      },
    });
  };

  const handleReset = () => {
    setTargetQualification(profile.studyPlan.targetQualification);
    setField(profile.studyPlan.field);
    setIsCsp(profile.studyPlan.isCsp);
    setStudyMode(profile.studyPlan.studyMode);
    setDurationYears(profile.studyPlan.durationYears);
    setPartTimeStudyIncome(profile.studyPlan.partTimeStudyIncome);
    setPartTimeWorkFullTime(profile.studyPlan.partTimeWorkFullTime ?? true);
    setAnnualStudentContributionOverride(
      profile.studyPlan.annualStudentContributionOverride
    );
    setIncludeSsaf(profile.studyPlan.includeSsaf ?? true);
  };

  const cityCmp = careerSummary.cityComparison;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="10-Yr Net Worth Delta"
          value={`${eduSummary.tenYearNetWealthDelta >= 0 ? '+' : ''}${formatAUD(eduSummary.tenYearNetWealthDelta)}`}
          subtext={`vs no-study baseline (${formatAUD(eduSummary.baselineNoStudyIncome)}/yr)`}
          tone={eduSummary.tenYearNetWealthDelta >= 0 ? 'positive' : 'warning'}
        />
        <StatCard
          label="Payback Period"
          value={
            studyMode === 'none'
              ? 'No Study'
              : eduSummary.breakEvenYears !== null
                ? `${eduSummary.breakEvenYears.toFixed(1)} yrs`
                : '10+ yrs'
          }
          subtext={`Expected grad pay: ${formatAUD(eduSummary.expectedPostStudyGrossIncome)}/yr`}
          tone={
            eduSummary.breakEvenYears !== null && eduSummary.breakEvenYears <= 5
              ? 'positive'
              : 'neutral'
          }
        />
        <StatCard
          label="HECS Debt Added"
          value={formatAUD(eduSummary.tuitionTotalAddedToHecs)}
          subtext={
            eduSummary.cspVsFullFeeSavings > 0
              ? `CSP saves ${formatAUD(eduSummary.cspVsFullFeeSavings)} vs Full-Fee`
              : `${isCsp ? 'CSP' : 'Full-Fee'} total tuition`
          }
          tone={isCsp ? 'accent' : 'warning'}
        />
        <StatCard
          label="Goal-Required Income"
          value={formatAUD(careerSummary.requiredIncomeForGoals)}
          subtext={
            careerSummary.incomeGapToGoals <= 0
              ? 'Current income covers housing goal'
              : `Gap: ${formatAUD(careerSummary.incomeGapToGoals)}/yr`
          }
          tone={careerSummary.incomeGapToGoals <= 0 ? 'positive' : 'accent'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionCard
            title="Study & Career Controls"
            subtitle="Compare CSP vs Full-Fee and Full-Time vs Part-Time"
            action={
              isDirty ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <Check className="h-3 w-3" />
                    Apply
                  </button>
                </div>
              ) : (
                <Badge tone="neutral">Synced</Badge>
              )
            }
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="target-qual"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Target Qualification
                </label>
                <select
                  id="target-qual"
                  value={targetQualification}
                  onChange={(e) => {
                    setTargetQualification(e.target.value as QualificationLevel);
                    setAnnualStudentContributionOverride(undefined);
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  {QUALIFICATIONS.map((q) => (
                    <option key={q} value={q}>
                      {QUALIFICATION_LABELS[q]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="target-field"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Industry / Field
                </label>
                <select
                  id="target-field"
                  value={field}
                  onChange={(e) => {
                    setField(e.target.value as IndustryField);
                    setAnnualStudentContributionOverride(undefined);
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  {FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {INDUSTRY_FIELD_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCsp(true);
                    setAnnualStudentContributionOverride(undefined);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                    isCsp
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div>CSP Place</div>
                  <div className="mt-0.5 text-[11px] font-normal opacity-80">
                    Subsidised HECS
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCsp(false);
                    setAnnualStudentContributionOverride(undefined);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                    !isCsp
                      ? 'border-amber-600 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/50 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div>Full-Fee</div>
                  <div className="mt-0.5 text-[11px] font-normal opacity-80">
                    Domestic FEE-HELP
                  </div>
                </button>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Study Mode
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { value: 'full_time', label: 'Full-Time' },
                      { value: 'part_time', label: 'Part-Time' },
                      { value: 'none', label: 'Skip Study' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => {
                        setStudyMode(mode.value);
                        if (mode.value !== 'none' && durationYears <= 0) {
                          setDurationYears(
                            mode.value === 'part_time'
                              ? ANNUAL_TUITION_BY_FIELD[field].defaultDurationYears * 2
                              : ANNUAL_TUITION_BY_FIELD[field].defaultDurationYears
                          );
                        }
                      }}
                      className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                        studyMode === mode.value
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {studyMode !== 'none' ? (
                <>
                  {studyMode === 'part_time' ? (
                    <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                            Work Full-Time During Study
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            100% full-time pay + normal annual raises
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={partTimeWorkFullTime}
                          aria-label="Work Full-Time During Study"
                          onClick={() => setPartTimeWorkFullTime((v) => !v)}
                          className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                            partTimeWorkFullTime
                              ? 'bg-emerald-600 text-white'
                              : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {partTimeWorkFullTime ? 'Full-Time Pay' : 'Reduced Pay'}
                        </button>
                      </div>
                      {partTimeWorkFullTime ? (
                        <div className="rounded-lg border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/40 px-2.5 py-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 tabular-nums">
                          Keeping {formatAUD(eduSummary.baselineNoStudyIncome)}/yr +{' '}
                          {profile.salaryGrowthPct}%/yr raises ($0 foregone salary)
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <SliderField
                    label="Study Duration"
                    value={durationYears}
                    onChange={setDurationYears}
                    min={0.5}
                    max={6}
                    step={0.5}
                    formatValue={(v) => `${v} yr${v > 1 ? 's' : ''}`}
                  />

                  {studyMode !== 'part_time' || !partTimeWorkFullTime ? (
                    <CurrencyInput
                      label="Income During Study"
                      value={partTimeStudyIncome}
                      onChange={setPartTimeStudyIncome}
                      min={0}
                      max={150000}
                      step={1000}
                      suffix="/yr"
                      hint={
                        eduSummary.austudyEligibleDuringStudy
                          ? 'Austudy eligible'
                          : 'Part-time / Austudy'
                      }
                    />
                  ) : null}

                  <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 p-3">
                    <CurrencyInput
                      label="Student Contribution (per EFTSL)"
                      value={displayedStudentContributionPerEftsl}
                      onChange={(val) => setAnnualStudentContributionOverride(val)}
                      min={0}
                      max={65000}
                      step={100}
                      suffix="/yr"
                      hint={isCsp ? '2026 CSP band' : 'Full-Fee'}
                    />
                    {isCsp ? (
                      <div className="grid grid-cols-4 gap-1">
                        {CSP_STUDENT_CONTRIBUTION_BANDS_2026.map((b) => {
                          const active =
                            displayedStudentContributionPerEftsl === b.annualPerEftsl;
                          return (
                            <button
                              key={b.band}
                              type="button"
                              title={b.label}
                              onClick={() =>
                                setAnnualStudentContributionOverride(b.annualPerEftsl)
                              }
                              className={`rounded-md border px-1.5 py-1 text-[11px] font-semibold tabular-nums transition ${
                                active
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              B{b.band} {formatAUD(b.annualPerEftsl)}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    <label className="flex cursor-pointer items-center justify-between pt-1 text-xs text-slate-700 dark:text-slate-300">
                      <span>
                        Include 2026 SSAF (
                        {formatAUD(
                          studyMode === 'part_time'
                            ? SSAF_2026.partTimeAnnual
                            : SSAF_2026.fullTimeAnnual
                        )}
                        /yr)
                      </span>
                      <input
                        type="checkbox"
                        checked={includeSsaf}
                        onChange={(e) => setIncludeSsaf(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                </>
              ) : null}

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
                  <GraduationCap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Study Cost &amp; Cashflow Summary
                </div>
                <div className="mt-2 space-y-1 tabular-nums">
                  <div className="flex justify-between">
                    <span>
                      Student Contribution ({eduSummary.courseEftsl.toFixed(1)} EFTSL)
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatAUD(eduSummary.studentContributionTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>SSAF (SA-HELP)</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatAUD(eduSummary.ssafTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Foregone Income</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatAUD(eduSummary.foregoneIncomeDuringStudy)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Annual Study Income</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatAUD(eduSummary.annualStudyLivingIncome)}/yr
                      {eduSummary.partTimeWorkFullTimeActive ? ' (+ raises)' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6 lg:col-span-8">
          <SectionCard
            title="10-Year Cumulative Earnings Trajectory"
            subtitle="Selected study path vs No-Study baseline vs Full-Fee alternative"
          >
            <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={eduSummary.cumulativeEarningsSeries}
                  margin={{ top: 10, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLES.gridStroke} />
                  <XAxis
                    dataKey="year"
                    tickFormatter={(v) => `Yr ${v}`}
                    tick={CHART_STYLES.axisTick}
                  />
                  <YAxis
                    tickFormatter={(v) =>
                      Math.abs(Number(v)) >= 1000000
                        ? `$${(Number(v) / 1000000).toFixed(1)}M`
                        : `$${Math.round(Number(v) / 1000)}k`
                    }
                    tick={CHART_STYLES.axisTick}
                    width={58}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatAUD(Number(value ?? 0)),
                      String(name),
                    ]}
                    labelFormatter={(yr) => `Year ${yr}`}
                    contentStyle={CHART_STYLES.tooltipContentStyle}
                    itemStyle={CHART_STYLES.tooltipItemStyle}
                    labelStyle={CHART_STYLES.tooltipLabelStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line
                    type="monotone"
                    dataKey="selectedStudyCumulative"
                    name="Selected Path"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="noStudyCumulative"
                    name="No Study Baseline"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="fullFeeAlternativeCumulative"
                    name="Full-Fee Alternative"
                    stroke="#D97706"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* Australian Salary Ladder */}
            <div className="md:col-span-7">
              <SectionCard
                title={`Australian Salary Ladder: ${INDUSTRY_FIELD_LABELS[field]}`}
                subtitle={careerSummary.currentSalaryPercentileNote}
              >
                <div className="space-y-4">
                  {careerSummary.milestones.map((m) => {
                    const leftPct = (m.salaryMin / ladderMax) * 100;
                    const widthPct =
                      ((m.salaryMax - m.salaryMin) / ladderMax) * 100;
                    const medianPct = (m.salaryMedian / ladderMax) * 100;
                    return (
                      <div key={m.stage} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {m.label}{' '}
                            <span className="font-normal text-slate-400 dark:text-slate-500">
                              ({m.typicalYearsExp})
                            </span>
                          </span>
                          <span className="text-slate-600 dark:text-slate-400 tabular-nums">
                            {formatAUD(m.salaryMin)} – {formatAUD(m.salaryMax)}
                          </span>
                        </div>
                        <div className="relative h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="absolute top-0 bottom-0 rounded-full bg-blue-200 dark:bg-blue-900/70"
                            style={{
                              left: `${leftPct}%`,
                              width: `${Math.max(4, widthPct)}%`,
                            }}
                          />
                          <div
                            className="absolute top-0 bottom-0 w-1 rounded-full bg-blue-600 dark:bg-blue-400"
                            style={{ left: `${medianPct}%` }}
                            title={`Median: ${formatAUD(m.salaryMedian)}`}
                          />
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs tabular-nums">
                    <Badge tone="neutral">
                      Current: {formatAUD(profile.grossSalary)}
                    </Badge>
                    <Badge tone="accent">
                      Post-Study:{' '}
                      {formatAUD(eduSummary.expectedPostStudyGrossIncome)}
                    </Badge>
                    <Badge tone="positive">
                      Housing Goal Target:{' '}
                      {formatAUD(careerSummary.requiredIncomeForGoals)}
                    </Badge>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Sydney vs Canberra Relocation Comparison Card */}
            <div className="md:col-span-5">
              <SectionCard
                title="Sydney vs Canberra Relocation"
                subtitle="Rent, FHB stamp duty & APS super differential"
                action={<ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
              >
                <div className="space-y-3 text-xs tabular-nums">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Sydney Median Unit Rent</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatAUD(cityCmp.sydneyMedianRentWeekly)}/wk
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Canberra Median Unit Rent</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatAUD(cityCmp.canberraMedianRentWeekly)}/wk
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2">
                    <span className="text-slate-600 dark:text-slate-400">
                      Canberra Net Disposable Delta
                    </span>
                    <span
                      className={`font-semibold ${
                        cityCmp.netDisposableDeltaCanberraVsSydneyAnnual >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {cityCmp.netDisposableDeltaCanberraVsSydneyAnnual >= 0
                        ? '+'
                        : ''}
                      {formatAUD(
                        cityCmp.netDisposableDeltaCanberraVsSydneyAnnual
                      )}
                      /yr
                    </span>
                  </div>
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/40 p-2.5 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                    <div>
                      <strong>ACT FHB Stamp Duty:</strong>{' '}
                      {STATE_FHB_RULES.ACT.summaryNote}
                    </div>
                    <div className="mt-1">
                      <strong>APS Super Advantage:</strong>{' '}
                      {formatPercent(SUPER_CONSTANTS.apsSuperRate * 100, 1)} vs{' '}
                      {formatPercent(SUPER_CONSTANTS.sgRate * 100, 0)} standard SG.
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>

          {eduSummary.notes.length > 0 ? (
            <AlertBanner tone="info" title="Education & Career Pathway Notes">
              <ul className="list-disc space-y-1 pl-4">
                {eduSummary.notes.map((n, idx) => (
                  <li key={idx}>{n}</li>
                ))}
              </ul>
            </AlertBanner>
          ) : null}
        </div>
      </div>
    </div>
  );
};
