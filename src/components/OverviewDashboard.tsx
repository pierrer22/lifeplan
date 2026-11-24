import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePlanner } from '../context/PlannerContext';
import { ActionRoadmapView } from './ActionRoadmapView';
import {
  AlertBanner,
  Badge,
  CHART_STYLES,
  SectionCard,
  StatCard,
  formatAUD,
  formatPercent,
  type StatTone,
} from './SharedPrimitives';

function compactAUD(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

export const OverviewDashboard: React.FC = () => {
  const { profile, lifePlan, setActiveTab, isDark } = usePlanner();
  const {
    readiness,
    tax,
    partnerTax,
    hecs,
    superSummary,
    rentBudget,
    houseDeposit,
    careerPathway,
    novatedLease,
    netWorthProjection,
  } = lifePlan;

  const householdGross =
    profile.grossSalary +
    (profile.relationshipStatus === 'couple' ? profile.partnerGrossSalary : 0);

  const maxSafeWeeklyRent = Math.round(
    (rentBudget.householdNetMonthlyIncome * 0.3 * 12) / 52
  );

  const combinedTaxAndFhsssSaving =
    superSummary.incomeTaxSavedThisYear + superSummary.fhsss.taxSavedVsCashSaving;

  const readinessTone: StatTone =
    readiness.statusLabel === 'On Track'
      ? 'positive'
      : readiness.statusLabel === 'Needs Adjustment'
        ? 'warning'
        : 'danger';

  const incomeTone: StatTone =
    careerPathway.incomeGapToGoals <= 0 ? 'positive' : 'warning';

  const depositTone: StatTone = houseDeposit.onTrackForTargetYears
    ? 'positive'
    : 'warning';

  const rentTone: StatTone =
    rentBudget.rentStressLevel === 'comfortable'
      ? 'positive'
      : rentBudget.rentStressLevel === 'moderate'
        ? 'warning'
        : 'danger';

  // Monthly cashflow allocation series
  const monthlyCashflowData = useMemo(() => {
    const monthlyIncomeTaxAndMedicare =
      (tax.incomeTax +
        tax.medicareLevy +
        tax.medicareLevySurcharge -
        tax.litoOffset +
        (partnerTax
          ? partnerTax.incomeTax +
            partnerTax.medicareLevy +
            partnerTax.medicareLevySurcharge -
            partnerTax.litoOffset
          : 0)) /
      12;
    const monthlyHecs = tax.hecsCompulsoryRepayment / 12;
    const monthlySalSacrifice = profile.salarySacrificeAnnual / 12;
    const monthlySurplus = Math.max(0, rentBudget.monthlySurplus);

    return [
      {
        name: 'Tax & Medicare',
        amount: Math.max(0, Math.round(monthlyIncomeTaxAndMedicare)),
        color: '#64748B',
      },
      {
        name: 'HECS Compulsory',
        amount: Math.max(0, Math.round(monthlyHecs)),
        color: '#D97706',
      },
      {
        name: 'Salary Sacrifice',
        amount: Math.max(0, Math.round(monthlySalSacrifice)),
        color: '#7C3AED',
      },
      {
        name: 'Rent',
        amount: Math.max(0, Math.round(rentBudget.monthlyRent)),
        color: '#2563EB',
      },
      {
        name: 'Living Costs',
        amount: Math.max(0, Math.round(rentBudget.monthlyLivingExpenses)),
        color: '#0EA5E9',
      },
      {
        name: 'Net Savings',
        amount: Math.round(monthlySurplus),
        color: '#059669',
      },
    ].filter((item) => item.amount > 0);
  }, [tax, partnerTax, profile.salarySacrificeAnnual, rentBudget]);

  const hecsValue =
    profile.hecsBalance <= 0
      ? 'Debt Free'
      : hecs.yearsToPayoff !== null
        ? `${hecs.yearsToPayoff} yrs`
        : '30+ yrs';

  const hecsSubtext =
    profile.hecsBalance <= 0
      ? 'No HECS-HELP balance'
      : `${formatAUD(hecs.yearOneCompulsoryRepayment)}/yr compulsory · ${formatAUD(profile.hecsBalance)} bal`;

  const depositValue =
    houseDeposit.estimatedYearsToReady <= 0
      ? 'Ready Now'
      : `${houseDeposit.estimatedYearsToReady.toFixed(1)} yrs`;

  const subScores = [
    { label: 'Housing', pct: readiness.housingReadinessPct },
    { label: 'Cashflow', pct: readiness.cashflowHealthPct },
    { label: 'Retirement', pct: readiness.retirementTrajectoryPct },
    { label: 'HECS', pct: readiness.hecsTrajectoryPct },
  ];

  return (
    <div className="space-y-6">
      {/* Goal Readiness Hero Strip */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                Goal Readiness Score
              </span>
              <Badge tone={readinessTone}>{readiness.statusLabel}</Badge>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                {Math.round(readiness.overallScore)}
                <span className="text-base font-medium text-slate-400 dark:text-slate-500">/100</span>
              </span>
              <p className="text-sm text-slate-600 dark:text-slate-300">{readiness.summaryHeadline}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:w-[500px] lg:shrink-0">
            {subScores.map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <span className="truncate">{s.label}</span>
                  <span className="shrink-0 font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    {Math.round(s.pct)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, s.pct))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6 Top Goal Readiness KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Required vs Current Income"
          value={`${formatAUD(householdGross)} / ${formatAUD(careerPathway.requiredIncomeForGoals)}`}
          subtext={
            careerPathway.incomeGapToGoals > 0
              ? `${formatAUD(careerPathway.incomeGapToGoals)}/yr gap to hit all goals on schedule`
              : 'Current household income supports target property & savings'
          }
          tone={incomeTone}
        />

        <StatCard
          label="House Deposit ETA"
          value={depositValue}
          subtext={`Target ${profile.targetHomeYears} yrs · Need ${formatAUD(
            houseDeposit.totalUpfrontCashRequired
          )} upfront (${formatAUD(houseDeposit.availableLiquidNow)} now)`}
          tone={depositTone}
        />

        <StatCard
          label="Max Safe Rent (30% Rule)"
          value={`${formatAUD(maxSafeWeeklyRent)}/wk`}
          subtext={`Current rent ${formatAUD(profile.currentWeeklyRent)}/wk (${formatPercent(
            rentBudget.rentToNetIncomePct
          )} of net pay)`}
          tone={rentTone}
        />

        <StatCard
          label="Super & FHSSS Tax Saving"
          value={formatAUD(combinedTaxAndFhsssSaving)}
          subtext={`Yr-1 tax saved ${formatAUD(
            superSummary.incomeTaxSavedThisYear
          )} · FHSSS boost ${formatAUD(superSummary.fhsss.taxSavedVsCashSaving)}`}
          tone={combinedTaxAndFhsssSaving > 0 ? 'positive' : 'accent'}
        />

        <StatCard
          label="HECS-HELP Payoff ETA"
          value={hecsValue}
          subtext={hecsSubtext}
          tone={profile.hecsBalance <= 0 ? 'positive' : 'neutral'}
        />

        <StatCard
          label="Monthly Cashflow Surplus"
          value={`${formatAUD(rentBudget.monthlySurplus)}/mo`}
          subtext={`Net income ${formatAUD(
            rentBudget.householdNetMonthlyIncome
          )}/mo · Savings rate ${formatPercent(rentBudget.savingsRatePct)}`}
          tone={rentBudget.monthlySurplus > 0 ? 'positive' : 'danger'}
        />
      </div>

      {/* Contextual Alerts */}
      {(tax.medicareLevySurcharge > 0 ||
        (novatedLease.enabled && novatedLease.hecsImpactAnnual > 0) ||
        houseDeposit.stampDutySaved > 0) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {tax.medicareLevySurcharge > 0 ? (
            <AlertBanner
              tone="warning"
              title={`Medicare Levy Surcharge: ${formatAUD(tax.medicareLevySurcharge)}/yr`}
            >
              Without private hospital cover, MLS ({formatPercent(tax.mlsRatePct, 2)}) applies on your{' '}
              {formatAUD(tax.mlsIncome)} MLS income. Compare hospital cover vs MLS or salary sacrifice in{' '}
              <button
                type="button"
                onClick={() => setActiveTab('super')}
                className="font-semibold text-amber-900 dark:text-amber-300 underline"
              >
                Super &amp; FHSSS
              </button>
              .
            </AlertBanner>
          ) : null}

          {novatedLease.enabled && novatedLease.hecsImpactAnnual > 0 ? (
            <AlertBanner
              tone="info"
              title={`EV Lease RFBA HECS Knock-On: +${formatAUD(novatedLease.hecsImpactAnnual)}/yr`}
            >
              Even FBT-exempt EV leases generate {formatAUD(novatedLease.rfbaAmount)} RFBA, increasing HECS
              repayments. Review net lease savings in{' '}
              <button
                type="button"
                onClick={() => setActiveTab('novated')}
                className="font-semibold text-blue-900 dark:text-blue-300 underline"
              >
                Novated Lease
              </button>
              .
            </AlertBanner>
          ) : null}

          {houseDeposit.stampDutySaved > 0 ? (
            <AlertBanner
              tone="success"
              title={`FHB Stamp Duty Saving: ${formatAUD(houseDeposit.stampDutySaved)}`}
            >
              In {profile.state}, your First Home Buyer concession reduces stamp duty to{' '}
              {formatAUD(houseDeposit.stampDutyWithConcession)} on a{' '}
              {formatAUD(profile.targetPropertyPrice)} purchase.
            </AlertBanner>
          ) : null}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Monthly Cashflow Allocation Chart */}
        <SectionCard
          title="Monthly Cashflow Allocation"
          subtitle={`Gross household ${formatAUD(householdGross / 12)}/mo -> Net ${formatAUD(
            rentBudget.householdNetMonthlyIncome
          )}/mo`}
          action={
            <button
              type="button"
              onClick={() => setActiveTab('rent')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              Optimize Rent &rarr;
            </button>
          }
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyCashflowData}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 16, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLES.gridStroke} horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => compactAUD(v)}
                  tick={CHART_STYLES.axisTick}
                  axisLine={CHART_STYLES.axisLine}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={112}
                  tick={{ fontSize: 11, fill: isDark ? '#CBD5E1' : '#334155', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [formatAUD(Number(value ?? 0)) + '/mo', 'Monthly']}
                  contentStyle={CHART_STYLES.tooltipContentStyle}
                  itemStyle={CHART_STYLES.tooltipItemStyle}
                  labelStyle={CHART_STYLES.tooltipLabelStyle}
                />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={22}>
                  {monthlyCashflowData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Multi-Year Net Worth Trajectory Chart */}
        <SectionCard
          title="Multi-Year Net Worth Trajectory"
          subtitle="Liquid savings + Superannuation + Estimated Home Equity minus HECS"
          action={
            <button
              type="button"
              onClick={() => setActiveTab('housing')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              Deposit Plan &rarr;
            </button>
          }
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={netWorthProjection}
                margin={{ top: 8, right: 16, left: 4, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="nwLiquid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="nwSuper" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="nwNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isDark ? '#E2E8F0' : '#0F172A'} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={isDark ? '#E2E8F0' : '#0F172A'} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLES.gridStroke} />
                <XAxis
                  dataKey="year"
                  tickFormatter={(y: number) => `Yr ${y}`}
                  tick={CHART_STYLES.axisTick}
                />
                <YAxis
                  tickFormatter={(v: number) => compactAUD(v)}
                  tick={CHART_STYLES.axisTick}
                  width={60}
                />
                <Tooltip
                  labelFormatter={(y) => `Year ${String(y)}`}
                  formatter={(value, name) => [formatAUD(Number(value ?? 0)), String(name)]}
                  contentStyle={CHART_STYLES.tooltipContentStyle}
                  itemStyle={CHART_STYLES.tooltipItemStyle}
                  labelStyle={CHART_STYLES.tooltipLabelStyle}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area
                  type="monotone"
                  dataKey="liquidAndInvestments"
                  name="Liquid & ETFs"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="url(#nwLiquid)"
                />
                <Area
                  type="monotone"
                  dataKey="superBalance"
                  name="Superannuation"
                  stroke="#059669"
                  strokeWidth={2}
                  fill="url(#nwSuper)"
                />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  name="Total Net Worth"
                  stroke={isDark ? '#E2E8F0' : '#0F172A'}
                  strokeWidth={2.5}
                  fill="url(#nwNet)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Embedded Action Roadmap */}
      <ActionRoadmapView />
    </div>
  );
};
