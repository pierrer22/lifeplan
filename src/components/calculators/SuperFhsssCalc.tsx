import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check, RotateCcw, Sparkles } from 'lucide-react';
import { SUPER_CONSTANTS } from '../../data/auConstants';
import { calculateSuperAndFhsss, calculateTax } from '../../engine';
import { usePlanner } from '../../context/PlannerContext';
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

export const SuperFhsssCalc: React.FC = () => {
  const { profile, patchProfile, isDark } = usePlanner();

  const [salarySacrificeAnnual, setSalarySacrificeAnnual] = useState(
    profile.salarySacrificeAnnual
  );
  const [carryForwardUnusedCap, setCarryForwardUnusedCap] = useState(
    profile.carryForwardUnusedCap
  );
  const [fhsssEnabled, setFhsssEnabled] = useState(true);
  const [fhsssYears, setFhsssYears] = useState(
    Math.min(4, Math.max(1, Math.round(profile.targetHomeYears)))
  );

  useEffect(() => {
    setSalarySacrificeAnnual(profile.salarySacrificeAnnual);
    setCarryForwardUnusedCap(profile.carryForwardUnusedCap);
    setFhsssYears(Math.min(4, Math.max(1, Math.round(profile.targetHomeYears))));
  }, [
    profile.id,
    profile.salarySacrificeAnnual,
    profile.carryForwardUnusedCap,
    profile.targetHomeYears,
  ]);

  const taxBaseline = useMemo(
    () =>
      calculateTax({
        financialYear: profile.financialYear,
        grossSalary: profile.grossSalary,
        partnerGrossSalary: profile.partnerGrossSalary,
        relationshipStatus: profile.relationshipStatus,
        dependents: profile.dependents,
        salarySacrificeSuper: 0,
        reportableEmployerSuper: 0,
        hasPrivateHospitalCover: profile.hasPrivateHospitalCover,
        hecsBalance: profile.hecsBalance,
      }),
    [profile]
  );

  const taxWithSacrifice = useMemo(
    () =>
      calculateTax({
        financialYear: profile.financialYear,
        grossSalary: profile.grossSalary,
        partnerGrossSalary: profile.partnerGrossSalary,
        relationshipStatus: profile.relationshipStatus,
        dependents: profile.dependents,
        salarySacrificeSuper: salarySacrificeAnnual,
        reportableEmployerSuper: salarySacrificeAnnual,
        hasPrivateHospitalCover: profile.hasPrivateHospitalCover,
        hecsBalance: profile.hecsBalance,
      }),
    [profile, salarySacrificeAnnual]
  );

  const summary = useMemo(
    () =>
      calculateSuperAndFhsss({
        financialYear: profile.financialYear,
        age: profile.age,
        grossSalary: profile.grossSalary,
        superRatePct: profile.superRatePct,
        currentSuperBalance: profile.currentSuperBalance,
        salarySacrificeAnnual,
        carryForwardUnusedCap,
        investmentReturnPct: profile.investmentReturnPct,
        targetFhsssYears: fhsssEnabled ? fhsssYears : 0,
        marginalTaxRateWithMedicare: taxBaseline.effectiveMarginalRateWithMedicare,
      }),
    [
      profile.financialYear,
      profile.age,
      profile.grossSalary,
      profile.superRatePct,
      profile.currentSuperBalance,
      profile.investmentReturnPct,
      salarySacrificeAnnual,
      carryForwardUnusedCap,
      fhsssEnabled,
      fhsssYears,
      taxBaseline.effectiveMarginalRateWithMedicare,
    ]
  );

  const baseCap = SUPER_CONSTANTS.concessionalCap[profile.financialYear];
  const maxSliderSacrifice = Math.max(
    15000,
    Math.round(summary.effectiveMaxCap - summary.employerSgAnnual + 5000)
  );

  const capUsedPct =
    summary.effectiveMaxCap > 0
      ? Math.min(
          100,
          (summary.totalConcessionalAnnual / summary.effectiveMaxCap) * 100
        )
      : 0;
  const sgPctOfCap =
    summary.effectiveMaxCap > 0
      ? Math.min(100, (summary.employerSgAnnual / summary.effectiveMaxCap) * 100)
      : 0;

  // FHSSS vs HISA comparison bar data
  const fhsssComparisonData = useMemo(() => {
    const netFhsss = summary.fhsss.netFhsssReleaseAmount;
    const hisaEquivalent = Math.max(
      0,
      netFhsss - summary.fhsss.taxSavedVsCashSaving
    );
    return [
      {
        name: 'Taxed HISA Saving',
        amount: Math.round(hisaEquivalent),
        fill: '#94A3B8',
      },
      {
        name: 'FHSSS Net Release',
        amount: Math.round(netFhsss),
        fill: '#059669',
      },
    ];
  }, [summary.fhsss]);

  // Optimal contribution suggestion
  const optimalSuggestion = useMemo(() => {
    const headroom = Math.max(
      0,
      summary.effectiveMaxCap - summary.employerSgAnnual
    );
    if (taxBaseline.marginalTaxRate <= 0.15) {
      return {
        recommended: 0,
        reason:
          'Your current taxable income is in the 0%–15% bracket, so concessional super tax (15%) gives minimal or negative immediate tax arbitrage. Focus on liquid savings until income rises above $45,000.',
      };
    }
    const fhsssTarget = fhsssEnabled ? Math.min(15000, headroom) : headroom;
    return {
      recommended: Math.round(fhsssTarget),
      reason: fhsssEnabled
        ? `Sacrificing ${formatAUD(fhsssTarget)}/yr maximises the $15,000/yr FHSSS cap inside your ${formatAUD(summary.effectiveMaxCap)} concessional limit, saving ~${formatPercent((taxBaseline.effectiveMarginalRateWithMedicare - 0.15) * 100, 0)} net tax arbitrage.`
        : `You have ${formatAUD(headroom)} of concessional cap headroom (including eligible carry-forward).`,
    };
  }, [
    summary.effectiveMaxCap,
    summary.employerSgAnnual,
    taxBaseline.marginalTaxRate,
    taxBaseline.effectiveMarginalRateWithMedicare,
    fhsssEnabled,
  ]);

  const isDirty =
    salarySacrificeAnnual !== profile.salarySacrificeAnnual ||
    carryForwardUnusedCap !== profile.carryForwardUnusedCap;

  const handleApply = () => {
    patchProfile({
      salarySacrificeAnnual,
      carryForwardUnusedCap,
    });
  };

  const handleReset = () => {
    setSalarySacrificeAnnual(profile.salarySacrificeAnnual);
    setCarryForwardUnusedCap(profile.carryForwardUnusedCap);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Annual Tax Saved"
          value={formatAUD(summary.incomeTaxSavedThisYear)}
          subtext={`Super 15% tax: ${formatAUD(summary.contributionsTax15Pct)}`}
          tone={summary.incomeTaxSavedThisYear > 0 ? 'positive' : 'neutral'}
        />
        <StatCard
          label="Take-Home Pay Impact"
          value={`-${formatAUD(summary.takeHomePayReductionAnnual)}/yr`}
          subtext={`-${formatAUD(summary.takeHomePayReductionAnnual / 26)}/fortnight`}
          tone="neutral"
        />
        <StatCard
          label="FHSSS Net Deposit"
          value={fhsssEnabled ? formatAUD(summary.fhsss.netFhsssReleaseAmount) : '$0'}
          subtext={
            fhsssEnabled
              ? `Boost vs HISA: +${formatAUD(summary.fhsss.taxSavedVsCashSaving)}`
              : 'FHSSS toggle disabled'
          }
          tone={fhsssEnabled && summary.fhsss.taxSavedVsCashSaving > 0 ? 'positive' : 'neutral'}
        />
        <StatCard
          label="Projected Super @ 60"
          value={formatAUD(summary.projectedBalanceAt60WithSacrifice)}
          subtext={`Baseline SG only: ${formatAUD(summary.projectedBalanceAt60Baseline)}`}
          tone="accent"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionCard
            title="Super & FHSSS Controls"
            subtitle={`FY${profile.financialYear} concessional cap: ${formatAUD(baseCap)}`}
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
              <SliderField
                label="Annual Salary Sacrifice"
                value={salarySacrificeAnnual}
                onChange={setSalarySacrificeAnnual}
                min={0}
                max={maxSliderSacrifice}
                step={500}
                formatValue={(v) => `${formatAUD(v)}/yr`}
              />

              <CurrencyInput
                label="Carry-Forward Unused Cap"
                value={carryForwardUnusedCap}
                onChange={setCarryForwardUnusedCap}
                min={0}
                max={150000}
                step={1000}
                hint={
                  profile.currentSuperBalance < SUPER_CONSTANTS.carryForwardTsbLimit
                    ? 'TSB < $500k eligible'
                    : 'TSB >= $500k ineligible'
                }
              />

              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    FHSSS Mode ($15k/yr, $50k max)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    First Home Super Saver Scheme
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFhsssEnabled((v) => !v)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                    fhsssEnabled
                      ? 'bg-emerald-600 text-white'
                      : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {fhsssEnabled ? 'Enabled' : 'Off'}
                </button>
              </div>

              {fhsssEnabled ? (
                <SliderField
                  label="FHSSS Contribution Years"
                  value={fhsssYears}
                  onChange={setFhsssYears}
                  min={1}
                  max={4}
                  step={1}
                  formatValue={(v) => `${v} year${v > 1 ? 's' : ''}`}
                />
              ) : null}

              {/* Optimal Contribution Suggestion */}
              <div className="rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/70 dark:bg-blue-950/40 p-3.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-blue-900 dark:text-blue-300">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    Optimal Suggestion
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSalarySacrificeAnnual(optimalSuggestion.recommended)
                    }
                    className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                  >
                    Set {formatAUD(optimalSuggestion.recommended)}
                  </button>
                </div>
                <p className="mt-1.5 leading-relaxed text-slate-700 dark:text-slate-300">
                  {optimalSuggestion.reason}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6 lg:col-span-8">
          <SectionCard
            title="Concessional Cap Progress"
            subtitle={`Employer SG (${formatPercent(profile.superRatePct, 1)}) + Salary Sacrifice vs Effective Cap`}
            action={
              <Badge
                tone={
                  summary.excessConcessionalAmount > 0 ? 'danger' : 'positive'
                }
              >
                {summary.excessConcessionalAmount > 0
                  ? `Excess ${formatAUD(summary.excessConcessionalAmount)}`
                  : `${formatAUD(summary.remainingCapSpace)} headroom left`}
              </Badge>
            }
          >
            <div className="space-y-3">
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="flex h-full w-full">
                  <div
                    className="h-full bg-slate-500 transition-all"
                    style={{ width: `${sgPctOfCap}%` }}
                    title={`Employer SG: ${formatAUD(summary.employerSgAnnual)}`}
                  />
                  <div
                    className={`h-full transition-all ${
                      summary.excessConcessionalAmount > 0
                        ? 'bg-rose-500'
                        : 'bg-blue-600'
                    }`}
                    style={{
                      width: `${Math.max(0, capUsedPct - sgPctOfCap)}%`,
                    }}
                    title={`Salary Sacrifice: ${formatAUD(summary.salarySacrificeAnnual)}`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 tabular-nums">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Employer SG</span>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatAUD(summary.employerSgAnnual)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Salary Sacrifice</span>
                  <div className="font-semibold text-blue-700 dark:text-blue-400">
                    {formatAUD(summary.salarySacrificeAnnual)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Base Cap (FY{profile.financialYear})</span>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatAUD(summary.concessionalCap)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Effective Cap (+Carry-Fwd)</span>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatAUD(summary.effectiveMaxCap)}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <AlertBanner
            tone="warning"
            title="HECS-HELP & MLS Repayment Income Impact (RESC Add-Back)"
          >
            Salary sacrifice lowers your taxable income (saving{' '}
            <strong className="tabular-nums">
              {formatAUD(summary.incomeTaxSavedThisYear)}
            </strong>{' '}
            in income tax),{' '}
            <strong>
              but it is added back as Reportable Employer Super Contributions
              (RESC)
            </strong>{' '}
            when assessing HECS-HELP and the Medicare Levy Surcharge. Your
            Repayment Income remains{' '}
            <strong className="tabular-nums">
              {formatAUD(taxWithSacrifice.repaymentIncome)}
            </strong>{' '}
            (HECS compulsory:{' '}
            <strong className="tabular-nums">
              {formatAUD(taxWithSacrifice.hecsCompulsoryRepayment)}/yr
            </strong>
            ; MLS:{' '}
            <strong className="tabular-nums">
              {formatAUD(taxWithSacrifice.medicareLevySurcharge)}/yr
            </strong>
            ).
          </AlertBanner>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <SectionCard
              title="FHSSS vs Taxed HISA Boost"
              subtitle={
                fhsssEnabled
                  ? `${fhsssYears}-yr net releasable deposit after exit tax`
                  : 'Enable FHSSS to model deposit boost'
              }
            >
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={fhsssComparisonData}
                    margin={{ top: 10, right: 16, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLES.gridStroke} />
                    <XAxis
                      dataKey="name"
                      tick={CHART_STYLES.axisTick}
                    />
                    <YAxis
                      tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
                      tick={CHART_STYLES.axisTick}
                      width={52}
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatAUD(Number(value ?? 0)),
                        'Net Deposit Cash',
                      ]}
                      contentStyle={CHART_STYLES.tooltipContentStyle}
                      itemStyle={CHART_STYLES.tooltipItemStyle}
                      labelStyle={CHART_STYLES.tooltipLabelStyle}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={72}>
                      {fhsssComparisonData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {fhsssEnabled ? (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs tabular-nums">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Deemed SIC Earnings</span>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatAUD(summary.fhsss.deemedEarningsSic)}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">
                      Exit Tax ({formatPercent(summary.fhsss.withdrawalTaxRatePct, 1)})
                    </span>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      -{formatAUD(summary.fhsss.estimatedWithdrawalTax)}
                    </div>
                  </div>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard
              title="Super Balance to Age 60"
              subtitle="Baseline Employer SG vs SG + Salary Sacrifice"
            >
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={summary.projectionSeries}
                    margin={{ top: 10, right: 16, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLES.gridStroke} />
                    <XAxis
                      dataKey="age"
                      tickFormatter={(v) => `Age ${v}`}
                      tick={CHART_STYLES.axisTick}
                    />
                    <YAxis
                      tickFormatter={(v) =>
                        v >= 1000000
                          ? `$${(Number(v) / 1000000).toFixed(1)}M`
                          : `$${Math.round(Number(v) / 1000)}k`
                      }
                      tick={CHART_STYLES.axisTick}
                      width={56}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatAUD(Number(value ?? 0)),
                        name === 'balanceWithSacrifice'
                          ? 'With Sacrifice'
                          : 'Baseline SG Only',
                      ]}
                      labelFormatter={(age) => `Age ${age}`}
                      contentStyle={CHART_STYLES.tooltipContentStyle}
                      itemStyle={CHART_STYLES.tooltipItemStyle}
                      labelStyle={CHART_STYLES.tooltipLabelStyle}
                    />
                    <Area
                      type="monotone"
                      dataKey="balanceWithSacrifice"
                      name="balanceWithSacrifice"
                      stroke="#2563EB"
                      fill="#2563EB"
                      fillOpacity={isDark ? 0.22 : 0.14}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="balanceBaseline"
                      name="balanceBaseline"
                      stroke="#64748B"
                      fill="#64748B"
                      fillOpacity={isDark ? 0.16 : 0.1}
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
};
