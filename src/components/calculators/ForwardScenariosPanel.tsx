import React, { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { GraduationCap } from 'lucide-react';
import { calculateForwardScenarios } from '../../engine';
import { usePlanner } from '../../context/PlannerContext';
import type { CreditScoreBand } from '../../types/planner';
import {
  Badge,
  CHART_STYLES,
  SectionCard,
  SliderField,
  formatAUD,
  formatPercent,
} from '../SharedPrimitives';

interface ForwardScenariosPanelProps {
  propertyPrice: number;
  depositAmountNow: number;
  annualSavingsCapacity: number;
  interestRatePct: number;
  apraBufferPct?: number;
  loanTermYears?: number;
  creditCardLimitsTotal?: number;
  existingMonthlyDebtRepayments?: number;
  monthlyLivingExpenses?: number;
  hecsBalanceOverride?: number;
  creditScoreBand?: CreditScoreBand;
  bonusOrOtherIncomeAnnual?: number;
  novatedLeaseAnnualPreTax?: number;
}

export const ForwardScenariosPanel: React.FC<ForwardScenariosPanelProps> = ({
  propertyPrice,
  depositAmountNow,
  annualSavingsCapacity,
  interestRatePct,
  apraBufferPct = 3.0,
  loanTermYears = 30,
  creditCardLimitsTotal = 10000,
  existingMonthlyDebtRepayments = 0,
  monthlyLivingExpenses,
  hecsBalanceOverride,
  creditScoreBand = 'very_good',
  bonusOrOtherIncomeAnnual = 0,
  novatedLeaseAnnualPreTax = 0,
}) => {
  const { profile, isDark } = usePlanner();

  const defaultMastersYear = useMemo(() => {
    const fs = profile.hecsFutureStudy;
    if (fs?.enabled && fs.totalUnitsRemaining > 0) {
      return Math.min(
        5,
        Math.max(
          1,
          Math.ceil(
            fs.totalUnitsRemaining /
              Math.max(1, fs.unitsPerTerm * fs.termsPerYear),
          ),
        ),
      );
    }
    if (profile.studyPlan.studyMode !== 'none' && profile.studyPlan.durationYears > 0) {
      return Math.min(5, Math.max(1, Math.ceil(profile.studyPlan.durationYears)));
    }
    return 2;
  }, [profile.hecsFutureStudy, profile.studyPlan]);

  const [includeMastersUplift, setIncludeMastersUplift] = useState(true);
  const [mastersCompletionYear, setMastersCompletionYear] =
    useState(defaultMastersYear);
  const [mastersUpliftPct, setMastersUpliftPct] = useState(12);

  const summary = useMemo(
    () =>
      calculateForwardScenarios({
        profile,
        horizonYears: 5,
        includeMastersUplift,
        mastersCompletionYear,
        mastersUpliftPct,
        startingHecsBalance: hecsBalanceOverride ?? profile.hecsBalance,
        propertyPrice,
        depositAmountNow,
        annualSavingsCapacity,
        interestRatePct,
        apraBufferPct,
        loanTermYears,
        creditCardLimitsTotal,
        existingMonthlyDebtRepayments,
        monthlyLivingExpenses:
          monthlyLivingExpenses ?? profile.currentMonthlyLivingExpenses,
        creditScoreBand,
        bonusOrOtherIncomeAnnual,
        novatedLeaseAnnualPreTax,
      }),
    [
      profile,
      includeMastersUplift,
      mastersCompletionYear,
      mastersUpliftPct,
      hecsBalanceOverride,
      propertyPrice,
      depositAmountNow,
      annualSavingsCapacity,
      interestRatePct,
      apraBufferPct,
      loanTermYears,
      creditCardLimitsTotal,
      existingMonthlyDebtRepayments,
      monthlyLivingExpenses,
      creditScoreBand,
      bonusOrOtherIncomeAnnual,
      novatedLeaseAnnualPreTax,
    ],
  );

  return (
    <SectionCard
      title="Forward-Looking Scenarios (1-Year Blocks)"
      subtitle={`Projects annual salary raises (${formatPercent(profile.salaryGrowthPct, 1)}/yr), Masters graduation uplift, HECS paydown & deposit growth`}
      action={
        <button
          type="button"
          role="switch"
          aria-checked={includeMastersUplift}
          onClick={() => setIncludeMastersUplift((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            includeMastersUplift
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5" />
          Masters Uplift {includeMastersUplift ? 'On' : 'Off'}
        </button>
      }
    >
      <div className="space-y-5">
        {includeMastersUplift ? (
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3.5 md:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Masters Attained In
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setMastersCompletionYear(yr)}
                    className={`rounded-md border py-1 text-xs font-semibold transition ${
                      mastersCompletionYear === yr
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Yr {yr}
                  </button>
                ))}
              </div>
            </div>
            <SliderField
              label="Masters Graduation Salary Uplift"
              value={mastersUpliftPct}
              onChange={setMastersUpliftPct}
              min={0}
              max={35}
              step={1}
              formatValue={(v) => `+${formatPercent(v, 0)}`}
            />
          </div>
        ) : null}

        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={summary.blocks}
              margin={{ top: 10, right: 16, left: 6, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_STYLES.gridStroke}
              />
              <XAxis dataKey="label" tick={CHART_STYLES.axisTick} />
              <YAxis
                tickFormatter={(v) =>
                  Math.abs(Number(v)) >= 1000000
                    ? `$${(Number(v) / 1000000).toFixed(1)}M`
                    : `$${Math.round(Number(v) / 1000)}k`
                }
                tick={CHART_STYLES.axisTick}
                width={56}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatAUD(Number(value ?? 0)),
                  String(name),
                ]}
                contentStyle={CHART_STYLES.tooltipContentStyle}
                itemStyle={CHART_STYLES.tooltipItemStyle}
                labelStyle={CHART_STYLES.tooltipLabelStyle}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar
                dataKey="maxBorrowingPower"
                name="Max Borrowing Power"
                fill="#2563EB"
                fillOpacity={isDark ? 0.85 : 0.8}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
              <Line
                type="monotone"
                dataKey="hecsBalance"
                name="Remaining HECS Balance"
                stroke="#D97706"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[660px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase">
                <th className="py-2 pr-2 font-semibold">1-Year Block</th>
                <th className="px-2 py-2 text-right font-semibold">Gross Salary</th>
                <th className="px-2 py-2 text-right font-semibold">HECS Bal</th>
                <th className="px-2 py-2 text-right font-semibold">Deposit</th>
                <th className="px-2 py-2 text-right font-semibold">Max Borrowing</th>
                <th className="px-2 py-2 text-right font-semibold">DTI</th>
                <th className="pl-2 py-2 text-right font-semibold">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
              {summary.blocks.map((b) => (
                <tr
                  key={b.year}
                  className={
                    b.mastersJustCompleted
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 font-medium'
                      : ''
                  }
                >
                  <td className="py-2.5 pr-2 text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span>{b.label}</span>
                      {b.mastersJustCompleted ? (
                        <Badge tone="accent">Masters</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right text-slate-900 dark:text-slate-100">
                    {formatAUD(b.grossSalary)}
                  </td>
                  <td className="px-2 py-2.5 text-right text-amber-700 dark:text-amber-400">
                    {formatAUD(b.hecsBalance)}
                  </td>
                  <td className="px-2 py-2.5 text-right text-slate-600 dark:text-slate-400">
                    {formatAUD(b.projectedLiquidDeposit)}
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold text-slate-900 dark:text-slate-100">
                    {formatAUD(b.maxBorrowingPower)}
                    {b.borrowingDeltaVsNow > 0 ? (
                      <span className="ml-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        (+{formatAUD(b.borrowingDeltaVsNow)})
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2.5 text-right text-slate-600 dark:text-slate-400">
                    {b.dtiRatio.toFixed(1)}x
                  </td>
                  <td className="pl-2 py-2.5 text-right">
                    <Badge
                      tone={
                        b.verdict === 'Likely Approved'
                          ? 'positive'
                          : b.verdict === 'Conditional / Borderline'
                            ? 'warning'
                            : 'danger'
                      }
                    >
                      {b.verdict === 'Likely Approved'
                        ? 'Approved'
                        : b.verdict === 'Conditional / Borderline'
                          ? 'Borderline'
                          : 'Declined'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  );
};
