import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check, RotateCcw } from 'lucide-react';
import { calculateRentBudgetPlan } from '../../engine';
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
  formatMonths,
  formatPercent,
} from '../SharedPrimitives';

function estimateMonthsToDeposit(
  currentLiquid: number,
  monthlySurplus: number,
  annualReturnPct: number,
  targetUpfront: number
): number | null {
  if (currentLiquid >= targetUpfront) return 0;
  if (monthlySurplus <= 0 && currentLiquid <= 0) return null;

  const monthlyRate = annualReturnPct / 100 / 12;
  let balance = currentLiquid;
  for (let m = 1; m <= 240; m += 1) {
    balance = balance * (1 + monthlyRate) + monthlySurplus;
    if (balance >= targetUpfront) return m;
  }
  return null;
}

export const RentBudgetCalc: React.FC = () => {
  const { profile, patchProfile, lifePlan, isDark } = usePlanner();

  const [weeklyRent, setWeeklyRent] = useState(profile.currentWeeklyRent);
  const [monthlyLivingExpenses, setMonthlyLivingExpenses] = useState(
    profile.currentMonthlyLivingExpenses
  );
  const [targetDeposit, setTargetDeposit] = useState(
    lifePlan.houseDeposit.totalUpfrontCashRequired
  );
  const [targetTimelineMonths, setTargetTimelineMonths] = useState(
    Math.max(12, profile.targetHomeYears * 12)
  );

  useEffect(() => {
    setWeeklyRent(profile.currentWeeklyRent);
    setMonthlyLivingExpenses(profile.currentMonthlyLivingExpenses);
    setTargetDeposit(lifePlan.houseDeposit.totalUpfrontCashRequired);
    setTargetTimelineMonths(Math.max(12, profile.targetHomeYears * 12));
  }, [
    profile.id,
    profile.currentWeeklyRent,
    profile.currentMonthlyLivingExpenses,
    profile.targetHomeYears,
    lifePlan.houseDeposit.totalUpfrontCashRequired,
  ]);

  const netMonthlyIncome = lifePlan.tax.netMonthlyIncome;
  const partnerNetMonthlyIncome = lifePlan.partnerTax?.netMonthlyIncome ?? 0;
  const currentLiquidAssets =
    profile.currentCashSavings + profile.currentInvestments;

  const summary = useMemo(
    () =>
      calculateRentBudgetPlan({
        netMonthlyIncome,
        partnerNetMonthlyIncome,
        weeklyRent,
        monthlyLivingExpenses,
        state: profile.state,
        cityLabel: profile.cityLabel,
        currentLiquidAssets,
        investmentReturnPct: profile.investmentReturnPct,
        targetUpfrontCash: targetDeposit,
      }),
    [
      netMonthlyIncome,
      partnerNetMonthlyIncome,
      weeklyRent,
      monthlyLivingExpenses,
      profile.state,
      profile.cityLabel,
      currentLiquidAssets,
      profile.investmentReturnPct,
      targetDeposit,
    ]
  );

  const maxSustainableWeeklyRent = useMemo(() => {
    const maxMonthly = summary.householdNetMonthlyIncome * 0.3;
    return Math.max(0, Math.round((maxMonthly * 12) / 52));
  }, [summary.householdNetMonthlyIncome]);

  const monthsAtCurrentRent = useMemo(
    () =>
      estimateMonthsToDeposit(
        currentLiquidAssets,
        summary.monthlySurplus,
        profile.investmentReturnPct,
        targetDeposit
      ),
    [
      currentLiquidAssets,
      summary.monthlySurplus,
      profile.investmentReturnPct,
      targetDeposit,
    ]
  );

  // Build sensitivity curve from $250/wk to $950/wk in $50 increments
  const sensitivityData = useMemo(() => {
    const points: Array<{
      weeklyRent: number;
      monthlySurplus: number;
      monthsToDeposit: number | null;
      rentPct: number;
    }> = [];

    for (let rent = 250; rent <= 950; rent += 50) {
      const sim = calculateRentBudgetPlan({
        netMonthlyIncome,
        partnerNetMonthlyIncome,
        weeklyRent: rent,
        monthlyLivingExpenses,
        state: profile.state,
        cityLabel: profile.cityLabel,
        currentLiquidAssets,
        investmentReturnPct: profile.investmentReturnPct,
        targetUpfrontCash: targetDeposit,
      });
      const months = estimateMonthsToDeposit(
        currentLiquidAssets,
        sim.monthlySurplus,
        profile.investmentReturnPct,
        targetDeposit
      );
      points.push({
        weeklyRent: rent,
        monthlySurplus: Math.round(sim.monthlySurplus),
        monthsToDeposit: months,
        rentPct: Number(sim.rentToNetIncomePct.toFixed(1)),
      });
    }
    return points;
  }, [
    netMonthlyIncome,
    partnerNetMonthlyIncome,
    monthlyLivingExpenses,
    profile.state,
    profile.cityLabel,
    currentLiquidAssets,
    profile.investmentReturnPct,
    targetDeposit,
  ]);

  // Max rent that still hits targetTimelineMonths
  const maxGoalAlignedWeeklyRent = useMemo(() => {
    let best: number | null = null;
    for (let rent = 950; rent >= 200; rent -= 10) {
      const monthlyRent = (rent * 52) / 12;
      const surplus =
        summary.householdNetMonthlyIncome - monthlyRent - monthlyLivingExpenses;
      const m = estimateMonthsToDeposit(
        currentLiquidAssets,
        surplus,
        profile.investmentReturnPct,
        targetDeposit
      );
      if (m !== null && m <= targetTimelineMonths) {
        best = rent;
        break;
      }
    }
    return best;
  }, [
    summary.householdNetMonthlyIncome,
    monthlyLivingExpenses,
    currentLiquidAssets,
    profile.investmentReturnPct,
    targetDeposit,
    targetTimelineMonths,
  ]);

  const hasFeasibleMonths = sensitivityData.some(
    (p) => p.monthsToDeposit !== null
  );

  const isDirty =
    weeklyRent !== profile.currentWeeklyRent ||
    monthlyLivingExpenses !== profile.currentMonthlyLivingExpenses;

  const handleApply = () => {
    patchProfile({
      currentWeeklyRent: weeklyRent,
      currentMonthlyLivingExpenses: monthlyLivingExpenses,
    });
  };

  const handleReset = () => {
    setWeeklyRent(profile.currentWeeklyRent);
    setMonthlyLivingExpenses(profile.currentMonthlyLivingExpenses);
    setTargetDeposit(lifePlan.houseDeposit.totalUpfrontCashRequired);
    setTargetTimelineMonths(Math.max(12, profile.targetHomeYears * 12));
  };

  const stressTone =
    summary.rentStressLevel === 'comfortable'
      ? 'positive'
      : summary.rentStressLevel === 'moderate'
        ? 'warning'
        : 'danger';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Max Sustainable Rent"
          value={`${formatAUD(maxSustainableWeeklyRent)}/wk`}
          subtext={`30% of net pay (${formatAUD(summary.householdNetMonthlyIncome)}/mo)`}
          tone={weeklyRent <= maxSustainableWeeklyRent ? 'positive' : 'danger'}
        />
        <StatCard
          label="Rent Stress Ratio"
          value={formatPercent(summary.rentToNetIncomePct, 1)}
          subtext={
            summary.rentStressLevel === 'comfortable'
              ? 'Comfortable (<25% of net pay)'
              : summary.rentStressLevel === 'moderate'
                ? 'Moderate (25%–30% of net pay)'
                : 'Housing stress (>30% of net pay)'
          }
          tone={stressTone}
        />
        <StatCard
          label="Monthly Savings Surplus"
          value={formatAUD(summary.monthlySurplus)}
          subtext={`Savings rate: ${formatPercent(summary.savingsRatePct, 1)} (${formatAUD(summary.annualSavingsCapacity)}/yr)`}
          tone={summary.monthlySurplus > 0 ? 'positive' : 'danger'}
        />
        <StatCard
          label="Time to Deposit"
          value={
            monthsAtCurrentRent !== null
              ? formatMonths(monthsAtCurrentRent)
              : 'Unfeasible'
          }
          subtext={
            maxGoalAlignedWeeklyRent !== null
              ? `Goal (${formatMonths(targetTimelineMonths)}) max rent: ${formatAUD(maxGoalAlignedWeeklyRent)}/wk`
              : `Increase income or trim costs for ${formatMonths(targetTimelineMonths)} goal`
          }
          tone={
            monthsAtCurrentRent !== null &&
            monthsAtCurrentRent <= targetTimelineMonths
              ? 'positive'
              : 'warning'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionCard
            title="Rent & Savings Controls"
            subtitle="Test weekly rent against your deposit timeline"
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
                label="Weekly Rent"
                value={weeklyRent}
                onChange={setWeeklyRent}
                min={250}
                max={950}
                step={10}
                formatValue={(v) => `${formatAUD(v)}/wk`}
              />

              <CurrencyInput
                label="Monthly Living Expenses (ex-rent)"
                value={monthlyLivingExpenses}
                onChange={setMonthlyLivingExpenses}
                min={500}
                max={12000}
                step={50}
                suffix="/mo"
              />

              <CurrencyInput
                label="Target Upfront Deposit Cash"
                value={targetDeposit}
                onChange={setTargetDeposit}
                min={10000}
                max={1000000}
                step={2500}
              />

              <SliderField
                label="Target Deposit Timeline"
                value={targetTimelineMonths}
                onChange={setTargetTimelineMonths}
                min={12}
                max={96}
                step={6}
                formatValue={(v) => formatMonths(v)}
              />

              {/* 30% Housing Stress Indicator */}
              <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    30% Housing Stress Gauge
                  </span>
                  <Badge tone={stressTone}>
                    {formatPercent(summary.rentToNetIncomePct, 1)}
                  </Badge>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className={`h-full transition-all ${
                      summary.rentStressLevel === 'comfortable'
                        ? 'bg-emerald-500'
                        : summary.rentStressLevel === 'moderate'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(0, summary.rentToNetIncomePct * 2))}%`,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-900 dark:bg-slate-100"
                    style={{ left: '60%' }}
                    title="30% Housing Stress Threshold"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>0%</span>
                  <span>25% Safe</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">30% Limit</span>
                  <span>50%+</span>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6 lg:col-span-8">
          <SectionCard
            title="Rent Sensitivity Curve"
            subtitle={
              hasFeasibleMonths
                ? 'Weekly rent ($250–$950) vs months to reach upfront cash target'
                : 'Weekly rent ($250–$950) vs monthly cash surplus (positive surplus needed to build deposit)'
            }
          >
            <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={sensitivityData}
                  margin={{ top: 24, right: 20, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLES.gridStroke} />
                  <XAxis
                    dataKey="weeklyRent"
                    tickFormatter={(v) => `$${v}`}
                    tick={CHART_STYLES.axisTick}
                  />
                  {hasFeasibleMonths ? (
                    <YAxis
                      yAxisId="left"
                      tickFormatter={(v) => `${v}m`}
                      tick={CHART_STYLES.axisTick}
                      width={48}
                    />
                  ) : null}
                  <YAxis
                    yAxisId="right"
                    orientation={hasFeasibleMonths ? 'right' : 'left'}
                    tickFormatter={(v) => formatAUD(Number(v))}
                    tick={CHART_STYLES.axisTick}
                    width={64}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      if (value === null || value === undefined) {
                        return ['Unfeasible (>20 yrs)', 'Months to Deposit'];
                      }
                      if (name === 'monthsToDeposit') {
                        return [formatMonths(Number(value)), 'Months to Deposit'];
                      }
                      return [`${formatAUD(Number(value))}/mo`, 'Monthly Surplus'];
                    }}
                    labelFormatter={(label) => `Weekly Rent: $${label}/wk`}
                    contentStyle={CHART_STYLES.tooltipContentStyle}
                    itemStyle={CHART_STYLES.tooltipItemStyle}
                    labelStyle={CHART_STYLES.tooltipLabelStyle}
                  />
                  {hasFeasibleMonths ? (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="monthsToDeposit"
                      name="monthsToDeposit"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  ) : null}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="monthlySurplus"
                    name="monthlySurplus"
                    stroke="#059669"
                    strokeWidth={2}
                    strokeDasharray={hasFeasibleMonths ? '4 4' : undefined}
                    dot={false}
                  />
                  <ReferenceLine
                    x={Math.round(weeklyRent / 50) * 50}
                    yAxisId={hasFeasibleMonths ? 'left' : 'right'}
                    stroke="#D97706"
                    strokeDasharray="3 3"
                    label={{
                      value: `Current $${weeklyRent}`,
                      position: 'insideTopRight',
                      fill: isDark ? '#FBBF24' : '#B45309',
                      fontSize: 11,
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <SectionCard
              title="Monthly Cashflow Breakdown"
              subtitle={`Net household income: ${formatAUD(summary.householdNetMonthlyIncome)}/mo`}
            >
              <div className="space-y-3 text-sm">
                {summary.budgetBreakdown.map((item) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{item.category}</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatAUD(item.monthlyAmount)}/mo{' '}
                        <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                          ({formatPercent(item.pctOfNet, 1)})
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${
                          item.monthlyAmount < 0
                            ? 'bg-rose-500'
                            : item.category.toLowerCase().includes('rent')
                              ? 'bg-amber-500'
                              : item.category.toLowerCase().includes('surplus') ||
                                  item.category.toLowerCase().includes('saving')
                                ? 'bg-emerald-500'
                                : 'bg-blue-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(4, Math.abs(item.pctOfNet)))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="City Rent Benchmarks"
              subtitle="Median unit vs house weekly rent across major capitals"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase">
                      <th className="py-2 pr-2 font-semibold">City</th>
                      <th className="px-2 py-2 text-right font-semibold">Unit/wk</th>
                      <th className="px-2 py-2 text-right font-semibold">House/wk</th>
                      <th className="pl-2 py-2 text-right font-semibold">Annual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                    {summary.cityRentComparisons.map((city) => {
                      const isCurrent =
                        city.city.toLowerCase() ===
                        profile.cityLabel.toLowerCase();
                      return (
                        <tr
                          key={city.city}
                          className={isCurrent ? 'bg-blue-50/60 dark:bg-blue-950/40 font-semibold' : ''}
                        >
                          <td className="py-2 pr-2 text-slate-900 dark:text-slate-100">
                            {city.city}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-700 dark:text-slate-300">
                            {formatAUD(city.medianUnitWeeklyRent)}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-700 dark:text-slate-300">
                            {formatAUD(city.medianHouseWeeklyRent)}
                          </td>
                          <td className="pl-2 py-2 text-right text-slate-700 dark:text-slate-300">
                            {formatAUD(city.annualRentCost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {summary.notes.length > 0 ? (
            <AlertBanner
              tone={summary.rentStressLevel === 'stressed' ? 'warning' : 'info'}
              title="Rent & Deposit Cashflow Notes"
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
