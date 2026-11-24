import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check, RotateCcw } from 'lucide-react';
import {
  HECS_DEFAULT_INDEXATION_PCT,
  HECS_THRESHOLDS,
} from '../../data/auConstants';
import { simulateHecsPayoff } from '../../engine';
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

export const HecsCalc: React.FC = () => {
  const { profile, patchProfile, lifePlan, isDark } = usePlanner();

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

  useEffect(() => {
    setBalance(profile.hecsBalance);
    setGrossSalary(profile.grossSalary);
    setSalaryGrowthPct(profile.salaryGrowthPct);
    setVoluntaryExtraAnnual(profile.hecsVoluntaryExtraAnnual);
    setRescAddBack(profile.salarySacrificeAnnual);
    setRfbaAddBack(lifePlan.novatedLease.rfbaAmount);
  }, [
    profile.id,
    profile.hecsBalance,
    profile.grossSalary,
    profile.salaryGrowthPct,
    profile.hecsVoluntaryExtraAnnual,
    profile.salarySacrificeAnnual,
    lifePlan.novatedLease.rfbaAmount,
  ]);

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
    voluntaryExtraAnnual !== profile.hecsVoluntaryExtraAnnual;

  const handleApply = () => {
    patchProfile({
      hecsBalance: balance,
      grossSalary,
      salaryGrowthPct,
      hecsVoluntaryExtraAnnual: voluntaryExtraAnnual,
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
  };

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
            balance <= 0
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
            balance <= 0 || summary.yearsSavedWithExtra > 0
              ? 'positive'
              : 'neutral'
          }
        />
        <StatCard
          label="Year 1 Indexation"
          value={formatAUD(summary.yearOneIndexation)}
          subtext={`At ${formatPercent(indexationRatePct, 1)} on 1 June`}
          tone="warning"
        />
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
        <div className="lg:col-span-4">
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
                label="HECS-HELP Balance"
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
        </div>

        <div className="space-y-6 lg:col-span-8">
          <SectionCard
            title="Payoff Trajectory: Minimum vs Voluntary Extra"
            subtitle="Projected year-end balance after 1 June indexation & compulsory repayments"
          >
            <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
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
                  <Area
                    type="monotone"
                    dataKey="closingBalance"
                    name="With Voluntary Extra"
                    stroke="#059669"
                    fill="#059669"
                    fillOpacity={isDark ? 0.24 : 0.16}
                    strokeWidth={2.5}
                  />
                </AreaChart>
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

          <AlertBanner
            tone="info"
            title="1 June Indexation Timing Rule"
          >
            ATO applies HECS-HELP indexation on <strong>1 June</strong> each
            year to unpaid debt aged 11+ months. Employer PAYG withheld
            repayments are only credited after your tax return is lodged, so any
            voluntary extra repayment aimed at beating 1 June indexation should
            be paid via BPAY in <strong>mid-May</strong>.
          </AlertBanner>
        </div>
      </div>
    </div>
  );
};
