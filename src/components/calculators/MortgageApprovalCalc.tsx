import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { evaluateMortgageApproval } from '../../engine';
import { usePlanner } from '../../context/PlannerContext';
import type { CreditScoreBand, UnderwritingGate } from '../../types/planner';
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

const LOAN_TERMS = [15, 20, 25, 30] as const;

const CREDIT_SCORE_OPTIONS: ReadonlyArray<{
  value: CreditScoreBand;
  label: string;
}> = [
  { value: 'excellent', label: 'Excellent (800+)' },
  { value: 'very_good', label: 'Very Good (700–799)' },
  { value: 'good', label: 'Good (600–699)' },
  { value: 'fair', label: 'Fair (<600)' },
];

const GATE_BADGE_MAP: Record<
  UnderwritingGate['status'],
  { tone: 'positive' | 'warning' | 'danger'; label: string }
> = {
  pass: { tone: 'positive', label: 'Pass' },
  borderline: { tone: 'warning', label: 'Borderline' },
  fail: { tone: 'danger', label: 'Fail' },
};

export const MortgageApprovalCalc: React.FC = () => {
  const { profile, patchProfile, lifePlan, isDark } = usePlanner();

  const defaultDeposit = useMemo(() => {
    const pct =
      profile.depositStrategy === '5_hgs'
        ? 0.05
        : profile.depositStrategy === '10_lmi'
          ? 0.1
          : 0.2;
    return Math.round(profile.targetPropertyPrice * pct);
  }, [profile.depositStrategy, profile.targetPropertyPrice]);

  const [propertyPrice, setPropertyPrice] = useState(profile.targetPropertyPrice);
  const [depositAmount, setDepositAmount] = useState(defaultDeposit);
  const [interestRatePct, setInterestRatePct] = useState(profile.targetMortgageRatePct);
  const [apraBufferPct, setApraBufferPct] = useState(3.0);
  const [loanTermYears, setLoanTermYears] = useState<number>(30);
  const [creditCardLimitsTotal, setCreditCardLimitsTotal] = useState(10000);
  const [existingMonthlyDebtRepayments, setExistingMonthlyDebtRepayments] = useState(0);
  const [bonusOrOtherIncomeAnnual, setBonusOrOtherIncomeAnnual] = useState(0);
  const [monthlyLivingExpenses, setMonthlyLivingExpenses] = useState(
    profile.currentMonthlyLivingExpenses,
  );
  const [hecsBalance, setHecsBalance] = useState(profile.hecsBalance);
  const [creditScoreBand, setCreditScoreBand] = useState<CreditScoreBand>('very_good');

  useEffect(() => {
    setPropertyPrice(profile.targetPropertyPrice);
    setDepositAmount(defaultDeposit);
    setInterestRatePct(profile.targetMortgageRatePct);
    setMonthlyLivingExpenses(profile.currentMonthlyLivingExpenses);
    setHecsBalance(profile.hecsBalance);
  }, [
    profile.id,
    profile.targetPropertyPrice,
    defaultDeposit,
    profile.targetMortgageRatePct,
    profile.currentMonthlyLivingExpenses,
    profile.hecsBalance,
  ]);

  const novatedLeaseAnnualPreTax = profile.novatedLease.enabled
    ? lifePlan.novatedLease.preTaxDeductionAnnual
    : 0;

  const summary = useMemo(
    () =>
      evaluateMortgageApproval({
        financialYear: profile.financialYear,
        state: profile.state,
        cityLabel: profile.cityLabel,
        relationshipStatus: profile.relationshipStatus,
        dependents: profile.dependents,
        employmentStatus: profile.employmentStatus,
        grossSalary: profile.grossSalary,
        partnerGrossSalary: profile.partnerGrossSalary,
        bonusOrOtherIncomeAnnual,
        hasPrivateHospitalCover: profile.hasPrivateHospitalCover,
        hecsBalance,
        monthlyLivingExpenses,
        creditCardLimitsTotal,
        existingMonthlyDebtRepayments,
        novatedLeaseAnnualPreTax,
        propertyPrice,
        depositAmount,
        isFirstHomeBuyer: profile.isFirstHomeBuyer,
        isNewHome: profile.isNewHome,
        interestRatePct,
        apraBufferPct,
        loanTermYears,
        creditScoreBand,
      }),
    [
      profile.financialYear,
      profile.state,
      profile.cityLabel,
      profile.relationshipStatus,
      profile.dependents,
      profile.employmentStatus,
      profile.grossSalary,
      profile.partnerGrossSalary,
      profile.hasPrivateHospitalCover,
      profile.isFirstHomeBuyer,
      profile.isNewHome,
      novatedLeaseAnnualPreTax,
      bonusOrOtherIncomeAnnual,
      hecsBalance,
      monthlyLivingExpenses,
      creditCardLimitsTotal,
      existingMonthlyDebtRepayments,
      propertyPrice,
      depositAmount,
      interestRatePct,
      apraBufferPct,
      loanTermYears,
      creditScoreBand,
    ],
  );

  const isProfileDirty =
    propertyPrice !== profile.targetPropertyPrice ||
    interestRatePct !== profile.targetMortgageRatePct ||
    monthlyLivingExpenses !== profile.currentMonthlyLivingExpenses ||
    hecsBalance !== profile.hecsBalance;

  const handleApply = () => {
    patchProfile({
      targetPropertyPrice: propertyPrice,
      targetMortgageRatePct: interestRatePct,
      currentMonthlyLivingExpenses: monthlyLivingExpenses,
      hecsBalance,
    });
  };

  const handleReset = () => {
    setPropertyPrice(profile.targetPropertyPrice);
    setDepositAmount(defaultDeposit);
    setInterestRatePct(profile.targetMortgageRatePct);
    setMonthlyLivingExpenses(profile.currentMonthlyLivingExpenses);
    setHecsBalance(profile.hecsBalance);
    setApraBufferPct(3.0);
    setLoanTermYears(30);
    setCreditCardLimitsTotal(10000);
    setExistingMonthlyDebtRepayments(0);
    setBonusOrOtherIncomeAnnual(0);
    setCreditScoreBand('very_good');
  };

  const verdictTone =
    summary.verdict === 'Likely Approved'
      ? 'positive'
      : summary.verdict === 'Conditional / Borderline'
        ? 'warning'
        : 'danger';

  const VerdictIcon =
    summary.verdict === 'Likely Approved'
      ? ShieldCheck
      : summary.verdict === 'Conditional / Borderline'
        ? ShieldAlert
        : XCircle;

  return (
    <div className="space-y-6">
      {/* Approval Verdict Hero */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                verdictTone === 'positive'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : verdictTone === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-400'
                    : 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-400'
              }`}
            >
              <VerdictIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                  Underwriting Verdict
                </span>
                <Badge tone={verdictTone}>{summary.verdict}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                  {summary.approvalScore}
                  <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                    /100
                  </span>
                </span>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Requested {formatAUD(summary.requestedLoanAmount)} loan vs{' '}
                  <strong className="text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatAUD(summary.maxBorrowingPower)}
                  </strong>{' '}
                  max borrowing power at{' '}
                  <strong className="tabular-nums">
                    {formatPercent(summary.assessmentRatePct, 2)}
                  </strong>{' '}
                  APRA assessment rate
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Badge tone={summary.hgsEligible ? 'positive' : 'neutral'}>
              {summary.hgsEligible ? 'HGS $0 LMI' : `LVR ${formatPercent(summary.lvrPct, 1)}`}
            </Badge>
            <Badge tone={summary.dtiRatio <= 6 ? 'positive' : summary.dtiRatio <= 7 ? 'warning' : 'danger'}>
              DTI {summary.dtiRatio.toFixed(1)}x
            </Badge>
          </div>
        </div>
      </div>

      {/* 4 KPI StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Max Borrowing Power"
          value={formatAUD(summary.maxBorrowingPower)}
          subtext={
            summary.borrowingSurplusOrShortfall >= 0
              ? `+${formatAUD(summary.borrowingSurplusOrShortfall)} headroom above loan`
              : `${formatAUD(Math.abs(summary.borrowingSurplusOrShortfall))} below requested loan`
          }
          tone={summary.borrowingSurplusOrShortfall >= 0 ? 'positive' : 'danger'}
        />
        <StatCard
          label="Requested Loan & LVR"
          value={formatAUD(summary.requestedLoanAmount)}
          subtext={`${formatPercent(summary.lvrPct, 1)} LVR · LMI ${formatAUD(summary.lmiEstimate)}`}
          tone={summary.lvrPct > 95 ? 'danger' : summary.lvrPct <= 80 || summary.hgsEligible ? 'positive' : 'warning'}
        />
        <StatCard
          label="DTI Ratio"
          value={`${summary.dtiRatio.toFixed(1)}x`}
          subtext={
            summary.dtiRatio <= 6
              ? 'Within 6.0x APRA benchmark'
              : summary.dtiRatio <= 7
                ? 'Elevated (6.0x–7.0x)'
                : 'Above 7.0x lender cap'
          }
          tone={summary.dtiRatio <= 6 ? 'positive' : summary.dtiRatio <= 7 ? 'warning' : 'danger'}
        />
        <StatCard
          label="Stressed Monthly Surplus"
          value={`${formatAUD(summary.netMonthlySurplusAtStress)}/mo`}
          subtext={`Actual P&I ${formatAUD(summary.actualMonthlyRepayment)}/mo · Stress ${formatAUD(summary.stressedMonthlyRepayment)}/mo`}
          tone={
            summary.netMonthlySurplusAtStress >= 250
              ? 'positive'
              : summary.netMonthlySurplusAtStress >= 0
                ? 'warning'
                : 'danger'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Controls */}
        <div className="lg:col-span-4">
          <SectionCard
            title="Loan & Underwriting Inputs"
            subtitle="Test lender serviceability, card limits & deposit"
            action={
              isProfileDirty ? (
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
                label="Property Purchase Price"
                value={propertyPrice}
                onChange={setPropertyPrice}
                min={150000}
                max={5000000}
                step={10000}
              />

              <div className="space-y-1.5">
                <CurrencyInput
                  label="Cash Deposit"
                  value={depositAmount}
                  onChange={setDepositAmount}
                  min={0}
                  max={propertyPrice}
                  step={5000}
                  hint={`${formatPercent(100 - summary.lvrPct, 1)} equity`}
                />
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { pct: 0.05, label: '5%' },
                    { pct: 0.1, label: '10%' },
                    { pct: 0.2, label: '20%' },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setDepositAmount(Math.round(propertyPrice * opt.pct))}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Set {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <SliderField
                label="Advertised Mortgage Rate"
                value={interestRatePct}
                onChange={setInterestRatePct}
                min={4.0}
                max={9.0}
                step={0.05}
                formatValue={(v) => formatPercent(v, 2)}
              />

              <SliderField
                label="APRA Serviceability Buffer"
                value={apraBufferPct}
                onChange={setApraBufferPct}
                min={1.0}
                max={3.5}
                step={0.25}
                formatValue={(v) => `+${formatPercent(v, 2)}`}
              />

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Loan Term
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {LOAN_TERMS.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setLoanTermYears(yr)}
                      className={`rounded-lg border py-1.5 text-xs font-semibold tabular-nums transition ${
                        loanTermYears === yr
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {yr}y
                    </button>
                  ))}
                </div>
              </div>

              <CurrencyInput
                label="Total Credit Card Limits"
                value={creditCardLimitsTotal}
                onChange={setCreditCardLimitsTotal}
                min={0}
                max={150000}
                step={1000}
                hint="Shaded 3.8%/mo"
              />

              <CurrencyInput
                label="Other Monthly Debt Repayments"
                value={existingMonthlyDebtRepayments}
                onChange={setExistingMonthlyDebtRepayments}
                min={0}
                max={15000}
                step={50}
                suffix="/mo"
                hint="Personal/car loans"
              />

              <CurrencyInput
                label="Bonus / Overtime Income"
                value={bonusOrOtherIncomeAnnual}
                onChange={setBonusOrOtherIncomeAnnual}
                min={0}
                max={300000}
                step={1000}
                suffix="/yr"
                hint="Shaded 80%"
              />

              <CurrencyInput
                label="Monthly Living Expenses"
                value={monthlyLivingExpenses}
                onChange={setMonthlyLivingExpenses}
                min={500}
                max={20000}
                step={100}
                suffix="/mo"
                hint={`HEM ${formatAUD(summary.hemFloorMonthly)}`}
              />

              <CurrencyInput
                label="HECS-HELP Balance"
                value={hecsBalance}
                onChange={setHecsBalance}
                min={0}
                max={250000}
                step={1000}
              />

              <div className="space-y-1">
                <label
                  htmlFor="mortgage-credit-score"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Credit Score Band
                </label>
                <select
                  id="mortgage-credit-score"
                  value={creditScoreBand}
                  onChange={(e) => setCreditScoreBand(e.target.value as CreditScoreBand)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  {CREDIT_SCORE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Analysis Panels */}
        <div className="space-y-6 lg:col-span-8">
          {/* 4 Underwriting Gates */}
          <SectionCard
            title="Bank Underwriting Gate Check"
            subtitle="How Australian lenders assess serviceability, equity, DTI, and borrower profile"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {summary.gates.map((gate) => {
                const badge = GATE_BADGE_MAP[gate.status];
                const GateIcon =
                  gate.status === 'pass'
                    ? CheckCircle2
                    : gate.status === 'borderline'
                      ? AlertTriangle
                      : XCircle;
                return (
                  <div
                    key={gate.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <GateIcon
                          className={`h-4 w-4 shrink-0 ${
                            gate.status === 'pass'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : gate.status === 'borderline'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400'
                          }`}
                        />
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {gate.label}
                        </span>
                      </div>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </div>
                    <div className="mt-2.5 flex items-baseline justify-between gap-2 text-xs tabular-nums">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {gate.actualDisplay}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        Target: {gate.benchmarkDisplay}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {gate.detail}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs sm:grid-cols-4 tabular-nums">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Assessed Net Pay</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatAUD(summary.assessedNetMonthlyIncome)}/mo
                </div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">HEM / Living Floor</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatAUD(summary.assessedLivingMonthly)}/mo
                </div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Card Shading (3.8%)</span>
                <div className="font-semibold text-amber-700 dark:text-amber-400">
                  {formatAUD(summary.creditCardMonthlyAssessment)}/mo
                </div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Total Cash Needed</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatAUD(summary.totalCashNeeded)}
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Borrowing Power Waterfall / Impact */}
            <SectionCard
              title="Borrowing Power Impact"
              subtitle={`HECS reduces capacity by ${formatAUD(summary.borrowingLostToHecs)} · Cards by ${formatAUD(summary.borrowingLostToCards)}`}
            >
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.borrowingBreakdown}
                    layout="vertical"
                    margin={{ top: 8, right: 20, left: 12, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={CHART_STYLES.gridStroke}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
                      tick={CHART_STYLES.axisTick}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={124}
                      tick={{ fontSize: 11, fill: isDark ? '#CBD5E1' : '#334155', fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [formatAUD(Number(value ?? 0)), 'Amount']}
                      contentStyle={CHART_STYLES.tooltipContentStyle}
                      itemStyle={CHART_STYLES.tooltipItemStyle}
                      labelStyle={CHART_STYLES.tooltipLabelStyle}
                    />
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={22}>
                      {summary.borrowingBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            {/* Rate Stress Test */}
            <SectionCard
              title="Interest Rate Stress Test"
              subtitle={`Repayment & monthly surplus from -0.5% to +${apraBufferPct.toFixed(1)}% APRA buffer`}
            >
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={summary.rateStressSeries}
                    margin={{ top: 10, right: 16, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLES.gridStroke} />
                    <XAxis dataKey="rateLabel" tick={CHART_STYLES.axisTick} />
                    <YAxis
                      tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
                      tick={CHART_STYLES.axisTick}
                      width={52}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        `${formatAUD(Number(value ?? 0))}/mo`,
                        name === 'monthlyRepayment' ? 'Monthly P&I' : 'Monthly Surplus',
                      ]}
                      contentStyle={CHART_STYLES.tooltipContentStyle}
                      itemStyle={CHART_STYLES.tooltipItemStyle}
                      labelStyle={CHART_STYLES.tooltipLabelStyle}
                    />
                    <ReferenceLine y={0} stroke="#E11D48" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="monthlyRepayment"
                      name="monthlyRepayment"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="monthlySurplus"
                      name="monthlySurplus"
                      stroke="#059669"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          <AlertBanner
            tone={
              verdictTone === 'positive'
                ? 'success'
                : verdictTone === 'warning'
                  ? 'warning'
                  : 'info'
            }
            title="How to Strengthen Loan Approval"
          >
            <ul className="list-disc space-y-1 pl-4">
              {summary.unlockActions.map((action, idx) => (
                <li key={idx}>{action}</li>
              ))}
            </ul>
          </AlertBanner>
        </div>
      </div>
    </div>
  );
};
