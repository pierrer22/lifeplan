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
import { calculateMortgageOffset } from '../../engine';
import { usePlanner } from '../../context/PlannerContext';
import {
  CHART_STYLES,
  CurrencyInput,
  SectionCard,
  SliderField,
  formatAUD,
  formatPercent,
} from '../SharedPrimitives';

interface MortgageOffsetPanelProps {
  loanAmount: number;
  annualRatePct: number;
  loanTermYears?: number;
  marginalTaxRateWithMedicarePct: number;
  defaultInitialOffset?: number;
  defaultMonthlyContribution?: number;
  contextNote?: string;
}

const OFFSET_PRESETS = [0, 10000, 25000, 50000] as const;

export const MortgageOffsetPanel: React.FC<MortgageOffsetPanelProps> = ({
  loanAmount,
  annualRatePct,
  loanTermYears = 30,
  marginalTaxRateWithMedicarePct,
  defaultInitialOffset = 20000,
  defaultMonthlyContribution = 400,
  contextNote,
}) => {
  const { profile, isDark } = usePlanner();

  const [initialOffset, setInitialOffset] = useState(defaultInitialOffset);
  const [monthlyContribution, setMonthlyContribution] = useState(
    defaultMonthlyContribution,
  );
  const [annualOffsetFee, setAnnualOffsetFee] = useState(0);
  const [hisaRatePct, setHisaRatePct] = useState(5.0);

  useEffect(() => {
    setInitialOffset(defaultInitialOffset);
    setMonthlyContribution(defaultMonthlyContribution);
  }, [profile.id, defaultInitialOffset, defaultMonthlyContribution]);

  const offsetSummary = useMemo(
    () =>
      calculateMortgageOffset({
        loanAmount,
        annualRatePct,
        loanTermYears,
        initialOffsetBalance: initialOffset,
        monthlyOffsetContribution: monthlyContribution,
        annualOffsetFee,
        marginalTaxRateWithMedicarePct,
        hisaRatePct,
      }),
    [
      loanAmount,
      annualRatePct,
      loanTermYears,
      initialOffset,
      monthlyContribution,
      annualOffsetFee,
      marginalTaxRateWithMedicarePct,
      hisaRatePct,
    ],
  );

  return (
    <SectionCard
      title="Mortgage Offset Account Benefit"
      subtitle={`100% offset against ${formatAUD(loanAmount)} at ${formatPercent(annualRatePct, 2)} (${loanTermYears}-yr P&I, ${formatPercent(marginalTaxRateWithMedicarePct, 0)} marginal tax)`}
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-5">
          <div className="space-y-2">
            <CurrencyInput
              label="Starting Offset Cash"
              value={initialOffset}
              onChange={setInitialOffset}
              min={0}
              max={1000000}
              step={2500}
            />
            <div className="grid grid-cols-4 gap-1.5">
              {OFFSET_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setInitialOffset(preset)}
                  className={`rounded-md border py-1 text-[11px] font-semibold transition ${
                    initialOffset === preset
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {preset === 0 ? '$0' : `$${preset / 1000}k`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CurrencyInput
              label="Monthly Offset Top-Up"
              value={monthlyContribution}
              onChange={setMonthlyContribution}
              min={0}
              max={15000}
              step={100}
              suffix="/mo"
            />
            <CurrencyInput
              label="Annual Package Fee"
              value={annualOffsetFee}
              onChange={setAnnualOffsetFee}
              min={0}
              max={1500}
              step={25}
              suffix="/yr"
            />
          </div>

          <SliderField
            label="Compare vs HISA"
            value={hisaRatePct}
            onChange={setHisaRatePct}
            min={1.0}
            max={8.0}
            step={0.1}
            formatValue={(v) => formatPercent(v, 1)}
          />

          <div className="grid grid-cols-2 gap-2.5 tabular-nums">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-2.5">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Lifetime Interest Saved
              </div>
              <div className="mt-0.5 text-base font-bold text-emerald-700 dark:text-emerald-400">
                {formatAUD(offsetSummary.netInterestSavedAfterFees)}
              </div>
              {offsetSummary.totalOffsetFeesPaid > 0 ? (
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Net of {formatAUD(offsetSummary.totalOffsetFeesPaid)} fees
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-2.5">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Loan Term Saved
              </div>
              <div className="mt-0.5 text-base font-bold text-blue-700 dark:text-blue-400">
                {offsetSummary.yearsSavedPayoff > 0
                  ? `${offsetSummary.yearsSavedPayoff.toFixed(1)} yrs`
                  : '0.0 yrs'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {offsetSummary.yearsToFullOffset !== null
                  ? `100% offset in ${offsetSummary.yearsToFullOffset.toFixed(1)} yrs`
                  : `${offsetSummary.monthsSavedPayoff} mos earlier`}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-2.5">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Tax-Free HISA Equivalent
              </div>
              <div className="mt-0.5 text-base font-bold text-slate-900 dark:text-slate-100">
                {formatPercent(offsetSummary.taxFreeEquivalentHisaRatePct, 2)}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                HISA (or ~{formatPercent(offsetSummary.taxFreeEquivalentEtfRatePct, 2)} ETFs) to tie
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-2.5">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Year-1 Edge vs HISA
              </div>
              <div
                className={`mt-0.5 text-base font-bold ${
                  offsetSummary.yearOneNetAdvantageVsHisa >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {offsetSummary.yearOneNetAdvantageVsHisa >= 0 ? '+' : ''}
                {formatAUD(offsetSummary.yearOneNetAdvantageVsHisa)}/yr
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {formatAUD(offsetSummary.yearOneInterestSaved)} saved vs{' '}
                {formatAUD(offsetSummary.yearOneHisaAfterTaxInterest)} HISA
              </div>
            </div>
          </div>

          {annualOffsetFee > 0 ? (
            <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              Package fee break-even balance:{' '}
              <strong>
                {formatAUD(offsetSummary.breakEvenOffsetBalanceForFee)}
              </strong>{' '}
              held in offset.
            </div>
          ) : null}
        </div>

        <div className="flex flex-col justify-between xl:col-span-7">
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={offsetSummary.yearlySeries}
                margin={{ top: 10, right: 16, left: 6, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_STYLES.gridStroke}
                />
                <XAxis
                  dataKey="year"
                  tickFormatter={(y) => `Yr ${y}`}
                  tick={CHART_STYLES.axisTick}
                />
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
                  labelFormatter={(y) => `Year ${y}`}
                  contentStyle={CHART_STYLES.tooltipContentStyle}
                  itemStyle={CHART_STYLES.tooltipItemStyle}
                  labelStyle={CHART_STYLES.tooltipLabelStyle}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area
                  type="monotone"
                  dataKey="baselineLoanBalance"
                  name="Standard Loan Balance"
                  stroke="#64748B"
                  fill="#64748B"
                  fillOpacity={isDark ? 0.16 : 0.08}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="offsetLoanBalance"
                  name="Loan Balance (with Offset)"
                  stroke="#2563EB"
                  fill="#2563EB"
                  fillOpacity={isDark ? 0.2 : 0.12}
                  strokeWidth={2.5}
                />
                <Area
                  type="monotone"
                  dataKey="netDebtWithOffset"
                  name="Net Debt (Loan − Offset)"
                  stroke="#059669"
                  fill="#059669"
                  fillOpacity={isDark ? 0.22 : 0.14}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 text-xs leading-relaxed text-emerald-900 dark:text-emerald-200">
              <strong>100% Tax-Free Advantage:</strong> Interest saved via an
              offset account is <strong>not assessable income</strong> — zero
              income tax, zero Medicare levy, zero CGT, and no increase to
              HECS/MLS Repayment Income. At your{' '}
              <strong>
                {formatPercent(marginalTaxRateWithMedicarePct, 0)}
              </strong>{' '}
              marginal rate, saving{' '}
              <strong>{formatPercent(annualRatePct, 2)}</strong> in offset
              equals{' '}
              <strong>
                {formatPercent(offsetSummary.taxFreeEquivalentHisaRatePct, 2)}{' '}
                p.a.
              </strong>{' '}
              in a taxed HISA or{' '}
              <strong>
                ~{formatPercent(offsetSummary.taxFreeEquivalentEtfRatePct, 2)}{' '}
                p.a.
              </strong>{' '}
              pre-tax in ETFs/shares (3% yield + CPI-indexed CGT, min 30% rate
              from 1 Jul 2027).
            </div>

            {contextNote ? (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800/60 bg-blue-50/70 dark:bg-blue-950/30 p-3 text-xs leading-relaxed text-blue-900 dark:text-blue-200">
                {contextNote}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </SectionCard>
  );
};
