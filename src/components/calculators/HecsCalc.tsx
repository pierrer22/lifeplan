import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check, GraduationCap, RotateCcw } from 'lucide-react';
import {
  ANNUAL_TUITION_BY_FIELD,
  CSP_STUDENT_CONTRIBUTION_BANDS_2026,
  HECS_DEFAULT_INDEXATION_PCT,
  HECS_THRESHOLDS,
  SSAF_2026,
  STUDENT_STARTUP_LOAN_2026,
} from '../../data/auConstants';
import { simulateHecsPayoff } from '../../engine';
import { usePlanner } from '../../context/PlannerContext';
import type { HecsFutureStudyInput, PlannerProfile } from '../../types/planner';
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

function buildDefaultFutureStudy(profile: PlannerProfile): HecsFutureStudyInput {
  if (profile.hecsFutureStudy) {
    return {
      ...profile.hecsFutureStudy,
      includeSsl: profile.hecsFutureStudy.includeSsl ?? true,
      sslInstalments: profile.hecsFutureStudy.sslInstalments ?? 1,
      sslAmountPerInstalment:
        profile.hecsFutureStudy.sslAmountPerInstalment ??
        STUDENT_STARTUP_LOAN_2026.perPeriod,
    };
  }
  const unitsPerTerm = 1;
  const termsPerYear: 2 | 3 = 3;
  const unitsPerEftsl = 8;
  const isPartTimeLoad = unitsPerTerm * termsPerYear < unitsPerEftsl * 0.75;
  return {
    enabled: profile.studyPlan.studyMode !== 'none',
    unitsPerTerm,
    termsPerYear,
    totalUnitsRemaining: 12,
    unitsPerEftsl,
    annualFeePerEftsl:
      profile.studyPlan.annualStudentContributionOverride ??
      (profile.studyPlan.isCsp
        ? ANNUAL_TUITION_BY_FIELD[profile.studyPlan.field].cspAnnual
        : ANNUAL_TUITION_BY_FIELD[profile.studyPlan.field].fullFeeAnnual),
    includeSsaf: profile.studyPlan.includeSsaf ?? true,
    ssafAnnualAmount: isPartTimeLoad
      ? SSAF_2026.partTimeAnnual
      : SSAF_2026.fullTimeAnnual,
    includeSsl: true,
    sslInstalments: 1,
    sslAmountPerInstalment: STUDENT_STARTUP_LOAN_2026.perPeriod,
  };
}

function futureStudyEqual(
  a: HecsFutureStudyInput,
  b: HecsFutureStudyInput,
): boolean {
  return (
    a.enabled === b.enabled &&
    a.unitsPerTerm === b.unitsPerTerm &&
    a.termsPerYear === b.termsPerYear &&
    a.totalUnitsRemaining === b.totalUnitsRemaining &&
    a.unitsPerEftsl === b.unitsPerEftsl &&
    a.annualFeePerEftsl === b.annualFeePerEftsl &&
    a.includeSsaf === b.includeSsaf &&
    a.ssafAnnualAmount === b.ssafAnnualAmount &&
    Boolean(a.includeSsl) === Boolean(b.includeSsl) &&
    (a.sslInstalments ?? 0) === (b.sslInstalments ?? 0) &&
    (a.sslAmountPerInstalment ?? STUDENT_STARTUP_LOAN_2026.perPeriod) ===
      (b.sslAmountPerInstalment ?? STUDENT_STARTUP_LOAN_2026.perPeriod)
  );
}

export const HecsCalc: React.FC = () => {
  const { profile, patchProfile, lifePlan, isDark } = usePlanner();

  const syncedFutureStudy = useMemo(
    () => buildDefaultFutureStudy(profile),
    [profile],
  );

  const [balance, setBalance] = useState(profile.hecsBalance);
  const [grossSalary, setGrossSalary] = useState(profile.grossSalary);
  const [salaryGrowthPct, setSalaryGrowthPct] = useState(profile.salaryGrowthPct);
  const [indexationRatePct, setIndexationRatePct] = useState<number>(
    HECS_DEFAULT_INDEXATION_PCT
  );
  const [voluntaryExtraAnnual, setVoluntaryExtraAnnual] = useState(
    profile.hecsVoluntaryExtraAnnual
  );
  const [rescAddBack, setRescAddBack] = useState(profile.salarySacrificeAnnual);
  const [rfbaAddBack, setRfbaAddBack] = useState(
    lifePlan.novatedLease.rfbaAmount
  );
  const [futureStudy, setFutureStudy] =
    useState<HecsFutureStudyInput>(syncedFutureStudy);

  useEffect(() => {
    setBalance(profile.hecsBalance);
    setGrossSalary(profile.grossSalary);
    setSalaryGrowthPct(profile.salaryGrowthPct);
    setVoluntaryExtraAnnual(profile.hecsVoluntaryExtraAnnual);
    setRescAddBack(profile.salarySacrificeAnnual);
    setRfbaAddBack(lifePlan.novatedLease.rfbaAmount);
    setFutureStudy(syncedFutureStudy);
  }, [
    profile.id,
    profile.hecsBalance,
    profile.grossSalary,
    profile.salaryGrowthPct,
    profile.hecsVoluntaryExtraAnnual,
    profile.salarySacrificeAnnual,
    lifePlan.novatedLease.rfbaAmount,
    syncedFutureStudy,
  ]);

  const updateFutureStudy = (patch: Partial<HecsFutureStudyInput>) => {
    setFutureStudy((prev) => {
      const next: HecsFutureStudyInput = { ...prev, ...patch };
      if (
        patch.unitsPerTerm !== undefined ||
        patch.termsPerYear !== undefined ||
        patch.unitsPerEftsl !== undefined
      ) {
        const isPartTimeLoad =
          next.unitsPerTerm * next.termsPerYear < next.unitsPerEftsl * 0.75;
        if (
          prev.ssafAnnualAmount === SSAF_2026.partTimeAnnual ||
          prev.ssafAnnualAmount === SSAF_2026.fullTimeAnnual
        ) {
          next.ssafAnnualAmount = isPartTimeLoad
            ? SSAF_2026.partTimeAnnual
            : SSAF_2026.fullTimeAnnual;
        }
      }
      return next;
    });
  };

  const taxableSalary = Math.max(0, grossSalary - rescAddBack);

  const summary = useMemo(
    () =>
      simulateHecsPayoff({
        financialYear: profile.financialYear,
        startingBalance: balance,
        grossSalary: taxableSalary,
        salaryGrowthPct,
        indexationRatePct,
        voluntaryExtraAnnual,
        reportableFringeBenefits: rfbaAddBack,
        reportableEmployerSuper: rescAddBack,
        maxYears: 25,
        futureStudy,
      }),
    [
      profile.financialYear,
      balance,
      taxableSalary,
      salaryGrowthPct,
      indexationRatePct,
      voluntaryExtraAnnual,
      rfbaAddBack,
      rescAddBack,
      futureStudy,
    ]
  );

  const tiers = HECS_THRESHOLDS[profile.financialYear];
  const repaymentIncome = summary.yearOneRepaymentIncome;

  const bracketBreakdown = useMemo(() => {
    const isFlatTop =
      tiers[tiers.length - 1].mode === 'flat_total' &&
      repaymentIncome >= tiers[tiers.length - 1].min;

    return tiers.map((tier) => {
      const upper = tier.max ?? repaymentIncome;
      const inBand =
        repaymentIncome >= tier.min
          ? Math.max(0, Math.min(repaymentIncome, upper) - tier.over)
          : 0;

      let sliceRepayment = 0;
      if (isFlatTop) {
        sliceRepayment =
          tier.mode === 'flat_total' ? repaymentIncome * tier.rate : 0;
      } else if (tier.mode === 'marginal' && inBand > 0) {
        sliceRepayment = inBand * tier.rate;
      }

      const active =
        repaymentIncome >= tier.min &&
        (tier.max === null || repaymentIncome <= tier.max);

      return {
        tier,
        inBand,
        sliceRepayment: Math.round(sliceRepayment),
        active,
      };
    });
  }, [tiers, repaymentIncome]);

  const isDirty =
    balance !== profile.hecsBalance ||
    grossSalary !== profile.grossSalary ||
    salaryGrowthPct !== profile.salaryGrowthPct ||
    voluntaryExtraAnnual !== profile.hecsVoluntaryExtraAnnual ||
    !futureStudyEqual(futureStudy, syncedFutureStudy);

  const handleApply = () => {
    patchProfile({
      hecsBalance: balance,
      grossSalary,
      salaryGrowthPct,
      hecsVoluntaryExtraAnnual: voluntaryExtraAnnual,
      hecsFutureStudy: futureStudy,
    });
  };

  const handleReset = () => {
    setBalance(profile.hecsBalance);
    setGrossSalary(profile.grossSalary);
    setSalaryGrowthPct(profile.salaryGrowthPct);
    setIndexationRatePct(HECS_DEFAULT_INDEXATION_PCT);
    setVoluntaryExtraAnnual(profile.hecsVoluntaryExtraAnnual);
    setRescAddBack(profile.salarySacrificeAnnual);
    setRfbaAddBack(lifePlan.novatedLease.rfbaAmount);
    setFutureStudy(syncedFutureStudy);
  };

  const unitsPerYearPreview = futureStudy.unitsPerTerm * futureStudy.termsPerYear;
  const eftslPerYearPreview = unitsPerYearPreview / Math.max(1, futureStudy.unitsPerEftsl);
  const perUnitFeePreview =
    futureStudy.annualFeePerEftsl / Math.max(1, futureStudy.unitsPerEftsl);
  const annualStudyCostPreview =
    unitsPerYearPreview * perUnitFeePreview +
    (futureStudy.includeSsaf ? futureStudy.ssafAnnualAmount : 0);
  const isPaidOffNow = balance <= 0 && summary.totalNewStudyDebtAdded <= 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Year 1 Compulsory"
          value={formatAUD(summary.yearOneCompulsoryRepayment)}
          subtext={`On Repayment Income ${formatAUD(repaymentIncome)}`}
          tone="accent"
        />
        <StatCard
          label="Payoff Timeline"
          value={
            isPaidOffNow
              ? 'Paid Off'
              : summary.yearsToPayoff !== null
                ? `${summary.yearsToPayoff} yrs`
                : '25+ yrs'
          }
          subtext={
            summary.yearsSavedWithExtra > 0
              ? `Saves ${summary.yearsSavedWithExtra} yr(s) vs minimum`
              : `Baseline: ${summary.baselineYearsToPayoff ?? '25+'} yrs`
          }
          tone={
            isPaidOffNow || summary.yearsSavedWithExtra > 0
              ? 'positive'
              : 'neutral'
          }
        />
        {summary.totalNewStudyDebtAdded > 0 ? (
          <StatCard
            label="New Study Debt Added"
            value={`+${formatAUD(summary.totalNewStudyDebtAdded)}`}
            subtext={`Peak balance: ${formatAUD(summary.peakBalance)} (${summary.peakBalanceCalendarYear ?? '—'})`}
            tone="warning"
          />
        ) : (
          <StatCard
            label="Year 1 Indexation"
            value={formatAUD(summary.yearOneIndexation)}
            subtext={`At ${formatPercent(indexationRatePct, 1)} on 1 June`}
            tone="warning"
          />
        )}
        <StatCard
          label="Total Indexation Paid"
          value={formatAUD(summary.totalInterestIndexationPaid)}
          subtext={
            summary.indexationSavedWithExtra > 0
              ? `Extra payments save ${formatAUD(summary.indexationSavedWithExtra)}`
              : `Total repaid: ${formatAUD(summary.totalPaid)}`
          }
          tone={summary.indexationSavedWithExtra > 0 ? 'positive' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <SectionCard
            title="HECS-HELP Parameters"
            subtitle={`FY${profile.financialYear} ATO marginal repayment model`}
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
              <CurrencyInput
                label="Current HECS-HELP Balance"
                value={balance}
                onChange={setBalance}
                min={0}
                max={250000}
                step={1000}
              />

              <CurrencyInput
                label="Gross Salary"
                value={grossSalary}
                onChange={setGrossSalary}
                min={0}
                max={500000}
                step={2000}
              />

              <SliderField
                label="Annual Salary Growth"
                value={salaryGrowthPct}
                onChange={setSalaryGrowthPct}
                min={0}
                max={10}
                step={0.5}
                formatValue={(v) => formatPercent(v, 1)}
              />

              <SliderField
                label="1 June Indexation Rate"
                value={indexationRatePct}
                onChange={setIndexationRatePct}
                min={1}
                max={7}
                step={0.1}
                formatValue={(v) => formatPercent(v, 1)}
              />

              <CurrencyInput
                label="Voluntary Extra Repayment"
                value={voluntaryExtraAnnual}
                onChange={setVoluntaryExtraAnnual}
                min={0}
                max={50000}
                step={500}
                suffix="/yr"
              />

              <div className="grid grid-cols-2 gap-3">
                <CurrencyInput
                  label="RESC Add-Back"
                  value={rescAddBack}
                  onChange={setRescAddBack}
                  min={0}
                  max={60000}
                  step={500}
                />
                <CurrencyInput
                  label="RFBA Add-Back"
                  value={rfbaAddBack}
                  onChange={setRfbaAddBack}
                  min={0}
                  max={60000}
                  step={500}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Future Study / Masters Debt"
            subtitle="Unit-by-trimester HECS & SSAF accumulation"
            action={
              <button
                type="button"
                role="switch"
                aria-checked={futureStudy.enabled}
                onClick={() => updateFutureStudy({ enabled: !futureStudy.enabled })}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  futureStudy.enabled
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                {futureStudy.enabled ? 'On' : 'Off'}
              </button>
            }
          >
            {!futureStudy.enabled ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Toggle <strong>On</strong> to project ongoing Masters or degree
                fees (e.g. 1 unit/trimester × 3/yr + SSAF) onto your HECS-HELP
                trajectory.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Academic Calendar
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Trimesters (3/yr)', value: 3 as const },
                      { label: 'Semesters (2/yr)', value: 2 as const },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          updateFutureStudy({ termsPerYear: opt.value })
                        }
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          futureStudy.termsPerYear === opt.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-300'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Units / Term
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      step={1}
                      value={futureStudy.unitsPerTerm}
                      onChange={(e) =>
                        updateFutureStudy({
                          unitsPerTerm: Math.max(
                            1,
                            Math.min(4, Number(e.target.value) || 1),
                          ),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Total Units
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={32}
                      step={1}
                      value={futureStudy.totalUnitsRemaining}
                      onChange={(e) =>
                        updateFutureStudy({
                          totalUnitsRemaining: Math.max(
                            0,
                            Math.min(32, Number(e.target.value) || 0),
                          ),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Units / EFTSL
                    </span>
                    <input
                      type="number"
                      min={4}
                      max={12}
                      step={1}
                      value={futureStudy.unitsPerEftsl}
                      onChange={(e) =>
                        updateFutureStudy({
                          unitsPerEftsl: Math.max(
                            4,
                            Math.min(12, Number(e.target.value) || 8),
                          ),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    2026 CSP Student Contribution Band
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {CSP_STUDENT_CONTRIBUTION_BANDS_2026.map((b) => {
                      const active =
                        Math.abs(
                          futureStudy.annualFeePerEftsl - b.annualPerEftsl,
                        ) < 5;
                      return (
                        <button
                          key={b.band}
                          type="button"
                          title={b.label}
                          onClick={() =>
                            updateFutureStudy({
                              annualFeePerEftsl: b.annualPerEftsl,
                            })
                          }
                          className={`rounded-lg border px-1.5 py-1.5 text-center text-[11px] font-medium transition-colors ${
                            active
                              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          <div>B{b.band}</div>
                          <div className="text-[10px] opacity-80">
                            ${(b.annualPerEftsl / 1000).toFixed(1)}k
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <CurrencyInput
                  label="Annual Fee (per 1.0 EFTSL)"
                  value={futureStudy.annualFeePerEftsl}
                  onChange={(v) =>
                    updateFutureStudy({ annualFeePerEftsl: v })
                  }
                  min={0}
                  max={70000}
                  step={500}
                />

                <div className="space-y-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3">
                  <label className="flex cursor-pointer items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span>Include SSAF (deferred to SA-HELP)</span>
                    <input
                      type="checkbox"
                      checked={futureStudy.includeSsaf}
                      onChange={(e) =>
                        updateFutureStudy({ includeSsaf: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                  {futureStudy.includeSsaf ? (
                    <CurrencyInput
                      label="Annual SSAF"
                      value={futureStudy.ssafAnnualAmount}
                      onChange={(v) =>
                        updateFutureStudy({ ssafAnnualAmount: v })
                      }
                      min={0}
                      max={1000}
                      step={10}
                      suffix="/yr"
                    />
                  ) : null}
                </div>

                <div className="space-y-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3">
                  <label className="flex cursor-pointer items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span>Include Student Start-up Loan (SSL — Jan 2027)</span>
                    <input
                      type="checkbox"
                      checked={Boolean(futureStudy.includeSsl)}
                      onChange={(e) =>
                        updateFutureStudy({ includeSsl: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                  {futureStudy.includeSsl ? (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                            SSL Lots (max 2/yr)
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={6}
                            step={1}
                            value={futureStudy.sslInstalments ?? 1}
                            onChange={(e) =>
                              updateFutureStudy({
                                sslInstalments: Math.max(
                                  1,
                                  Math.min(6, Number(e.target.value) || 1),
                                ),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums focus:border-blue-500 focus:outline-none"
                          />
                        </label>
                        <CurrencyInput
                          label="Amount / Lot"
                          value={
                            futureStudy.sslAmountPerInstalment ??
                            STUDENT_STARTUP_LOAN_2026.perPeriod
                          }
                          onChange={(v) =>
                            updateFutureStudy({ sslAmountPerInstalment: v })
                          }
                          min={0}
                          max={3000}
                          step={10}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        0% real interest (indexed 1 June at lower of CPI/WPI);
                        repaid after HECS-HELP. Requires full-time study &amp;
                        ≥$1 Austudy.
                      </p>
                    </>
                  ) : null}
                </div>

                <div className="rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 p-2.5 text-xs text-amber-900 dark:text-amber-200 tabular-nums">
                  <div className="font-semibold">
                    {unitsPerYearPreview} units/yr ({eftslPerYearPreview.toFixed(2)}{' '}
                    EFTSL) · {summary.studyCompletionYears} yr(s)
                  </div>
                  <div className="mt-0.5 text-[11px] opacity-90">
                    {formatAUD(perUnitFeePreview)}/unit · +
                    {formatAUD(annualStudyCostPreview)}/yr study · +
                    {formatAUD(summary.totalNewStudyDebtAdded)} total
                    {summary.totalNewSslAdded > 0
                      ? ` (incl. +${formatAUD(summary.totalNewSslAdded)} SSL)`
                      : ''}
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6 lg:col-span-8">
          <SectionCard
            title={
              voluntaryExtraAnnual > 0
                ? 'Payoff Trajectory: Minimum vs Voluntary Extra'
                : 'Payoff Trajectory: Minimum Compulsory Only'
            }
            subtitle={
              summary.totalNewStudyDebtAdded > 0
                ? 'Includes future study debt additions, 1 June indexation & compulsory repayments'
                : 'Projected year-end balance after 1 June indexation & compulsory repayments'
            }
          >
            <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={summary.projections}
                  margin={{ top: 10, right: 16, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLES.gridStroke} />
                  <XAxis
                    dataKey="calendarYear"
                    tick={CHART_STYLES.axisTick}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
                    tick={CHART_STYLES.axisTick}
                    width={54}
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
                  <Area
                    type="monotone"
                    dataKey="baselineClosingBalance"
                    name="Minimum Compulsory Only"
                    stroke="#64748B"
                    fill="#64748B"
                    fillOpacity={isDark ? 0.18 : 0.1}
                    strokeWidth={2}
                  />
                  {voluntaryExtraAnnual > 0 ? (
                    <Area
                      type="monotone"
                      dataKey="closingBalance"
                      name="With Voluntary Extra"
                      stroke="#059669"
                      fill="#059669"
                      fillOpacity={isDark ? 0.24 : 0.16}
                      strokeWidth={2.5}
                    />
                  ) : null}
                  {summary.totalNewStudyDebtAdded > 0 ? (
                    <Bar
                      dataKey="newDebtAdded"
                      name="New Study Debt (Tuition + SSAF + SSL)"
                      fill="#F59E0B"
                      fillOpacity={isDark ? 0.72 : 0.65}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
                    />
                  ) : null}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="md:col-span-5">
              <SectionCard
                title="Repayment Income"
                subtitle="ATO assessment base"
              >
                <div className="space-y-2.5 text-sm tabular-nums">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Taxable Income</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatAUD(taxableSalary)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">+ RESC (Salary Sac.)</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatAUD(rescAddBack)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">+ RFBA (Lease/Fringe)</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatAUD(rfbaAddBack)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-2.5 font-semibold text-slate-900 dark:text-slate-100">
                    <span>Total Repayment Income</span>
                    <span>{formatAUD(repaymentIncome)}</span>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="md:col-span-7">
              <SectionCard
                title={`FY${profile.financialYear} Marginal Brackets`}
                subtitle="Compulsory repayment only applies above threshold"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase">
                        <th className="py-2 pr-2 font-semibold">RI Bracket</th>
                        <th className="px-2 py-2 text-right font-semibold">Rate</th>
                        <th className="pl-2 py-2 text-right font-semibold">
                          Your Slice
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                      {bracketBreakdown.map(({ tier, sliceRepayment, active }) => (
                        <tr
                          key={tier.min}
                          className={active ? 'bg-blue-50/70 dark:bg-blue-950/40 font-semibold' : ''}
                        >
                          <td className="py-2 pr-2 text-slate-800 dark:text-slate-200">
                            {tier.max === null
                              ? `${formatAUD(tier.min)}+`
                              : `${formatAUD(tier.min)} – ${formatAUD(tier.max)}`}
                            {active ? (
                              <span className="ml-1.5 text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                                ACTIVE
                              </span>
                            ) : null}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-600 dark:text-slate-400">
                            {tier.mode === 'nil'
                              ? 'Nil'
                              : tier.mode === 'flat_total'
                                ? `${formatPercent(tier.rate * 100, 0)} total`
                                : `${(tier.rate * 100).toFixed(0)}c/$`}
                          </td>
                          <td className="pl-2 py-2 text-right text-slate-900 dark:text-slate-100">
                            {formatAUD(sliceRepayment)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </div>

          {summary.projections.length > 0 ? (
            <SectionCard
              title="Year-by-Year Debt & Study Additions Schedule"
              subtitle="Same-year tuition, SSAF & SSL additions are exempt from 1 June indexation until aged 11+ months"
            >
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase">
                      <th className="py-2 pr-2 font-semibold">Year</th>
                      <th className="px-2 py-2 text-right font-semibold">Units</th>
                      <th className="px-2 py-2 text-right font-semibold">New Debt</th>
                      <th className="px-2 py-2 text-right font-semibold">Indexation</th>
                      <th className="px-2 py-2 text-right font-semibold">Compulsory</th>
                      <th className="px-2 py-2 text-right font-semibold">Extra</th>
                      <th className="pl-2 py-2 text-right font-semibold">Closing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                    {summary.projections.map((row) => (
                      <tr key={row.calendarYear}>
                        <td className="py-2 pr-2 font-medium text-slate-900 dark:text-slate-100">
                          {row.calendarYear}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-600 dark:text-slate-400">
                          {row.unitsCompletedThisYear > 0 ? row.unitsCompletedThisYear : '—'}
                        </td>
                        <td className="px-2 py-2 text-right text-amber-700 dark:text-amber-400 font-medium">
                          {row.newDebtAdded > 0
                            ? `+${formatAUD(row.newDebtAdded)}`
                            : '$0'}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-600 dark:text-slate-400">
                          {formatAUD(row.indexationAdded)}
                        </td>
                        <td className="px-2 py-2 text-right text-emerald-700 dark:text-emerald-400">
                          -{formatAUD(row.compulsoryRepayment)}
                        </td>
                        <td className="px-2 py-2 text-right text-blue-700 dark:text-blue-400">
                          {row.voluntaryExtra > 0
                            ? `-${formatAUD(row.voluntaryExtra)}`
                            : '$0'}
                        </td>
                        <td className="pl-2 py-2 text-right font-semibold text-slate-900 dark:text-slate-100">
                          {formatAUD(row.closingBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : null}

          <AlertBanner
            tone="info"
            title="1 June Indexation Timing Rule"
          >
            ATO applies HECS-HELP indexation on <strong>1 June</strong> each
            year only to unpaid debt aged <strong>11+ months</strong> — newly
            incurred HECS-HELP tuition, SA-HELP (SSAF), and Student Start-up Loan
            (SSL) amounts are exempt from indexation in the calendar year they
            are added. Employer PAYG withheld repayments are credited after your
            tax return is lodged, so voluntary extra repayments aimed at beating
            1 June indexation should be paid via BPAY in <strong>mid-May</strong>.
          </AlertBanner>
        </div>
      </div>
    </div>
  );
};
