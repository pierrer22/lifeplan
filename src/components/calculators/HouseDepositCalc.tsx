import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check, Home, RotateCcw } from 'lucide-react';
import { HGS_PRICE_CAPS, STATE_FHB_RULES } from '../../data/auConstants';
import { calculateHouseDepositPlan } from '../../engine';
import { usePlanner } from '../../context/PlannerContext';
import type { AuState, DepositStrategy } from '../../types/planner';
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

const AU_STATES: readonly AuState[] = [
  'NSW',
  'ACT',
  'VIC',
  'QLD',
  'WA',
  'SA',
  'TAS',
  'NT',
];

const STRATEGY_OPTIONS: ReadonlyArray<{ value: DepositStrategy; label: string; hint: string }> = [
  { value: '5_hgs', label: '5% HGS', hint: 'Home Guarantee Scheme (no LMI)' },
  { value: '10_lmi', label: '10% + LMI', hint: 'Standard low-deposit loan' },
  { value: '20_no_lmi', label: '20% No LMI', hint: 'Full 20% deposit' },
];

export const HouseDepositCalc: React.FC = () => {
  const { profile, patchProfile, lifePlan, isDark } = usePlanner();

  const [propertyPrice, setPropertyPrice] = useState(profile.targetPropertyPrice);
  const [state, setState] = useState<AuState>(profile.state);
  const [cityLabel, setCityLabel] = useState(profile.cityLabel);
  const [isFirstHomeBuyer, setIsFirstHomeBuyer] = useState(profile.isFirstHomeBuyer);
  const [isNewHome, setIsNewHome] = useState(profile.isNewHome);
  const [depositStrategy, setDepositStrategy] = useState<DepositStrategy>(profile.depositStrategy);
  const [targetHomeYears, setTargetHomeYears] = useState(profile.targetHomeYears);
  const [mortgageRatePct, setMortgageRatePct] = useState(profile.targetMortgageRatePct);

  useEffect(() => {
    setPropertyPrice(profile.targetPropertyPrice);
    setState(profile.state);
    setCityLabel(profile.cityLabel);
    setIsFirstHomeBuyer(profile.isFirstHomeBuyer);
    setIsNewHome(profile.isNewHome);
    setDepositStrategy(profile.depositStrategy);
    setTargetHomeYears(profile.targetHomeYears);
    setMortgageRatePct(profile.targetMortgageRatePct);
  }, [
    profile.id,
    profile.targetPropertyPrice,
    profile.state,
    profile.cityLabel,
    profile.isFirstHomeBuyer,
    profile.isNewHome,
    profile.depositStrategy,
    profile.targetHomeYears,
    profile.targetMortgageRatePct,
  ]);

  const householdGrossIncome =
    profile.grossSalary +
    (profile.relationshipStatus === 'couple' ? profile.partnerGrossSalary : 0);

  const summary = useMemo(
    () =>
      calculateHouseDepositPlan({
        state,
        cityLabel,
        propertyPrice,
        isFirstHomeBuyer,
        isNewHome,
        depositStrategy,
        targetHomeYears,
        targetMortgageRatePct: mortgageRatePct,
        currentCashSavings: profile.currentCashSavings,
        currentInvestments: profile.currentInvestments,
        investmentReturnPct: profile.investmentReturnPct,
        annualSavingsCapacity: lifePlan.rentBudget.annualSavingsCapacity,
        fhsssNetContribution: lifePlan.superSummary.fhsss.netFhsssReleaseAmount,
        householdGrossIncome,
        isCouple: profile.relationshipStatus === 'couple',
      }),
    [
      state,
      cityLabel,
      propertyPrice,
      isFirstHomeBuyer,
      isNewHome,
      depositStrategy,
      targetHomeYears,
      mortgageRatePct,
      profile.currentCashSavings,
      profile.currentInvestments,
      profile.investmentReturnPct,
      profile.relationshipStatus,
      lifePlan.rentBudget.annualSavingsCapacity,
      lifePlan.superSummary.fhsss.netFhsssReleaseAmount,
      householdGrossIncome,
    ]
  );

  // Required gross income based on 30% gross income threshold & APRA +3% buffer check
  const requiredGrossIncome = useMemo(() => {
    const annualRepayment = summary.monthlyMortgageRepayment * 12;
    return Math.round(annualRepayment / 0.3);
  }, [summary.monthlyMortgageRepayment]);

  const apraBufferMonthly = useMemo(() => {
    const r = (mortgageRatePct + 3) / 100 / 12;
    const n = 360;
    if (r <= 0 || summary.loanAmount <= 0) return 0;
    return Math.round(
      (summary.loanAmount * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1)
    );
  }, [mortgageRatePct, summary.loanAmount]);

  const incomeGap = requiredGrossIncome - householdGrossIncome;
  const fhbRule = STATE_FHB_RULES[state];
  const hgsCaps = HGS_PRICE_CAPS[state];

  const isDirty =
    propertyPrice !== profile.targetPropertyPrice ||
    state !== profile.state ||
    isFirstHomeBuyer !== profile.isFirstHomeBuyer ||
    isNewHome !== profile.isNewHome ||
    depositStrategy !== profile.depositStrategy ||
    targetHomeYears !== profile.targetHomeYears ||
    mortgageRatePct !== profile.targetMortgageRatePct;

  const handleStateChange = (nextState: AuState) => {
    setState(nextState);
    setCityLabel(HGS_PRICE_CAPS[nextState].metroLabel);
  };

  const handleApply = () => {
    patchProfile({
      targetPropertyPrice: propertyPrice,
      state,
      cityLabel,
      isFirstHomeBuyer,
      isNewHome,
      depositStrategy,
      targetHomeYears,
      targetMortgageRatePct: mortgageRatePct,
    });
  };

  const handleReset = () => {
    setPropertyPrice(profile.targetPropertyPrice);
    setState(profile.state);
    setCityLabel(profile.cityLabel);
    setIsFirstHomeBuyer(profile.isFirstHomeBuyer);
    setIsNewHome(profile.isNewHome);
    setDepositStrategy(profile.depositStrategy);
    setTargetHomeYears(profile.targetHomeYears);
    setMortgageRatePct(profile.targetMortgageRatePct);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Required Gross Income"
          value={formatAUD(requiredGrossIncome)}
          subtext={
            incomeGap <= 0
              ? `Surplus of ${formatAUD(Math.abs(incomeGap))}/yr vs current ${formatAUD(householdGrossIncome)}`
              : `${formatAUD(incomeGap)}/yr above current ${formatAUD(householdGrossIncome)} (30% rule)`
          }
          tone={incomeGap <= 0 ? 'positive' : 'warning'}
        />
        <StatCard
          label="Total Upfront Cash"
          value={formatAUD(summary.totalUpfrontCashRequired)}
          subtext={`Gap now: ${formatAUD(summary.fundingGapNow)} after ${formatAUD(summary.availableLiquidNow + summary.fhsssBoostApplied)} liquid + FHSSS`}
          tone={summary.fundingGapNow === 0 ? 'positive' : 'accent'}
        />
        <StatCard
          label="Estimated Ready"
          value={
            summary.fundingGapNow === 0
              ? 'Ready Now'
              : `${summary.estimatedYearsToReady.toFixed(1)} yrs`
          }
          subtext={
            summary.onTrackForTargetYears
              ? `On track for ${targetHomeYears}-yr goal`
              : `Exceeds ${targetHomeYears}-yr goal`
          }
          tone={summary.onTrackForTargetYears ? 'positive' : 'warning'}
        />
        <StatCard
          label="Monthly Repayment"
          value={formatAUD(summary.monthlyMortgageRepayment)}
          subtext={`APRA +3% buffer test: ${formatAUD(apraBufferMonthly)}/mo`}
          tone={summary.mortgageStressPctOfNetIncome > 35 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionCard
            title="Property & Loan Controls"
            subtitle="Local what-if explorer synced with your profile"
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
                label="Target Property Price"
                value={propertyPrice}
                onChange={setPropertyPrice}
                min={350000}
                max={2000000}
                step={10000}
                formatValue={(v) => formatAUD(v)}
              />

              <CurrencyInput
                label="Exact Property Price"
                value={propertyPrice}
                onChange={setPropertyPrice}
                min={200000}
                max={5000000}
                step={5000}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="house-state"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    State / Territory
                  </label>
                  <select
                    id="house-state"
                    value={state}
                    onChange={(e) => handleStateChange(e.target.value as AuState)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                  >
                    {AU_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st} ({HGS_PRICE_CAPS[st].metroLabel})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="house-years"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Target Years
                  </label>
                  <select
                    id="house-years"
                    value={targetHomeYears}
                    onChange={(e) => setTargetHomeYears(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums focus:border-blue-500 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 10].map((yr) => (
                      <option key={yr} value={yr}>
                        {yr} year{yr > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsFirstHomeBuyer((v) => !v)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                    isFirstHomeBuyer
                      ? 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div>First Home Buyer</div>
                  <div className="mt-0.5 text-[11px] opacity-80">
                    {isFirstHomeBuyer ? 'Eligible FHB' : 'Non-FHB'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewHome((v) => !v)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                    isNewHome
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div>Property Type</div>
                  <div className="mt-0.5 text-[11px] opacity-80">
                    {isNewHome ? 'New Build' : 'Established'}
                  </div>
                </button>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Deposit Strategy
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {STRATEGY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDepositStrategy(opt.value)}
                      title={opt.hint}
                      className={`rounded-lg border px-2 py-2 text-center text-xs font-semibold transition ${
                        depositStrategy === opt.value
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <SliderField
                label="Mortgage Interest Rate"
                value={mortgageRatePct}
                onChange={setMortgageRatePct}
                min={4.5}
                max={8.5}
                step={0.05}
                formatValue={(v) => formatPercent(v, 2)}
              />

              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
                  <Home className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  {fhbRule.schemeName}
                </div>
                <p className="mt-1 leading-relaxed">{fhbRule.summaryNote}</p>
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                  <span>HGS Cap ({hgsCaps.metroLabel})</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatAUD(summary.hgsCapForCity)}
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6 lg:col-span-8">
          <SectionCard
            title="Upfront Cash & Deposit Breakdown"
            subtitle={`${formatAUD(propertyPrice)} ${isNewHome ? 'new' : 'established'} property in ${state} (${formatPercent(summary.lvrPct, 0)} LVR)`}
            action={
              <Badge tone={summary.hgsEligible || depositStrategy !== '5_hgs' ? 'positive' : 'warning'}>
                {depositStrategy === '5_hgs'
                  ? summary.hgsEligible
                    ? 'HGS Eligible'
                    : 'Above HGS Cap'
                  : `LMI ${formatAUD(summary.lmiEstimate)}`}
              </Badge>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600 dark:text-slate-400">
                    Deposit ({formatPercent(summary.depositPct, 0)})
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatAUD(summary.depositRequired)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600 dark:text-slate-400">
                    Stamp Duty ({isFirstHomeBuyer ? 'with FHB relief' : 'standard'})
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatAUD(summary.stampDutyWithConcession)}
                    {summary.stampDutySaved > 0 ? (
                      <span className="ml-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        (-{formatAUD(summary.stampDutySaved)})
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600 dark:text-slate-400">Lenders Mortgage Insurance (LMI)</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatAUD(summary.lmiEstimate)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600 dark:text-slate-400">Conveyancing, Building & Pest</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatAUD(summary.legalAndMiscCosts)}
                  </span>
                </div>
                {summary.fhogGrantAmount > 0 ? (
                  <div className="flex items-center justify-between py-1 text-emerald-700 dark:text-emerald-400">
                    <span>First Home Owner Grant (FHOG)</span>
                    <span className="font-semibold tabular-nums">
                      -{formatAUD(summary.fhogGrantAmount)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-2.5 font-semibold text-slate-900 dark:text-slate-100">
                  <span>Total Upfront Cash Required</span>
                  <span className="text-base tabular-nums">
                    {formatAUD(summary.totalUpfrontCashRequired)}
                  </span>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 p-4 text-sm">
                <div className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                  Funding Sources & Serviceability
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Cash + Investments Now</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatAUD(summary.availableLiquidNow)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">FHSSS Net Release Boost</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    +{formatAUD(summary.fhsssBoostApplied)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Annual Savings Capacity</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatAUD(lifePlan.rentBudget.annualSavingsCapacity)}/yr
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Loan Principal</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatAUD(summary.loanAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Fortnightly Repayment</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatAUD(summary.fortnightlyMortgageRepayment)}/fn
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Deposit Growth Timeline"
            subtitle="Projected liquid savings (incl. FHSSS & investment returns) vs target upfront cash"
          >
            <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={summary.timelineSeries}
                  margin={{ top: 24, right: 20, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLES.gridStroke} />
                  <XAxis
                    dataKey="year"
                    tickFormatter={(v) => `Yr ${v}`}
                    tick={CHART_STYLES.axisTick}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
                    tick={CHART_STYLES.axisTick}
                    width={62}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatAUD(Number(value ?? 0)),
                      String(name),
                    ]}
                    labelFormatter={(label) => `Year ${label}`}
                    contentStyle={CHART_STYLES.tooltipContentStyle}
                    itemStyle={CHART_STYLES.tooltipItemStyle}
                    labelStyle={CHART_STYLES.tooltipLabelStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area
                    type="monotone"
                    dataKey="projectedSavings"
                    name="Projected Deposit Savings"
                    stroke="#2563EB"
                    fill="#2563EB"
                    fillOpacity={isDark ? 0.22 : 0.14}
                    strokeWidth={2.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="targetUpfrontRequired"
                    name="Upfront Cash Target"
                    stroke="#059669"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={false}
                  />
                  <ReferenceLine
                    x={targetHomeYears}
                    stroke="#D97706"
                    strokeDasharray="3 3"
                    label={{
                      value: `Goal Yr ${targetHomeYears}`,
                      position: 'insideTopRight',
                      fill: isDark ? '#FBBF24' : '#B45309',
                      fontSize: 11,
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard
            title="3-Strategy Comparison"
            subtitle="Compare 5% Home Guarantee Scheme vs 10% + LMI vs 20% Deposit"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase">
                    <th className="py-2.5 pr-3 font-semibold">Strategy</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Deposit</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Stamp Duty</th>
                    <th className="px-3 py-2.5 text-right font-semibold">LMI</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Total Upfront</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Monthly P&I</th>
                    <th className="pl-3 py-2.5 text-right font-semibold">ETA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                  {summary.strategyComparisons.map((row) => {
                    const selected = row.strategy === depositStrategy;
                    return (
                      <tr
                        key={row.strategy}
                        onClick={() => setDepositStrategy(row.strategy)}
                        className={`cursor-pointer transition ${
                          selected
                            ? 'bg-blue-50/70 dark:bg-blue-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <td className="py-3 pr-3 font-medium text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <span>{row.label}</span>
                            {selected ? <Badge tone="accent">Selected</Badge> : null}
                            {row.strategy === '5_hgs' && !row.hgsEligible ? (
                              <Badge tone="warning">Ineligible</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-300">
                          {formatAUD(row.depositAmount)}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-300">
                          {formatAUD(row.stampDuty)}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-300">
                          {formatAUD(row.lmiEstimate)}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                          {formatAUD(row.totalUpfrontCashRequired)}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-300">
                          {formatAUD(row.monthlyMortgageRepayment)}/mo
                        </td>
                        <td className="pl-3 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                          {row.yearsToReachTarget <= 0
                            ? 'Now'
                            : `${row.yearsToReachTarget.toFixed(1)} yrs`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {summary.notes.length > 0 ? (
            <AlertBanner
              tone={summary.hgsEligible || depositStrategy !== '5_hgs' ? 'info' : 'warning'}
              title="Australian Housing & Scheme Notes"
            >
              <ul className="list-disc space-y-1 pl-4">
                {summary.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </AlertBanner>
          ) : null}
        </div>
      </div>
    </div>
  );
};
