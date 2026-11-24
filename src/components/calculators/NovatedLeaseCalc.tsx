import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Check, RotateCcw } from 'lucide-react';
import { NOVATED_LEASE_CONSTANTS } from '../../data/auConstants';
import { calculateNovatedLease } from '../../engine';
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

const LEASE_TERMS: readonly (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];

export const NovatedLeaseCalc: React.FC = () => {
  const { profile, patchProfile } = usePlanner();

  const [vehiclePrice, setVehiclePrice] = useState(
    profile.novatedLease.vehiclePrice
  );
  const [isEv, setIsEv] = useState(profile.novatedLease.isEv);
  const [leaseTermYears, setLeaseTermYears] = useState<1 | 2 | 3 | 4 | 5>(
    profile.novatedLease.leaseTermYears
  );
  const [annualRunningCosts, setAnnualRunningCosts] = useState(
    profile.novatedLease.annualRunningCosts
  );
  const [financeRatePct, setFinanceRatePct] = useState(
    profile.novatedLease.financeRatePct
  );
  const [annualKm, setAnnualKm] = useState(profile.novatedLease.annualKm);

  useEffect(() => {
    setVehiclePrice(profile.novatedLease.vehiclePrice);
    setIsEv(profile.novatedLease.isEv);
    setLeaseTermYears(profile.novatedLease.leaseTermYears);
    setAnnualRunningCosts(profile.novatedLease.annualRunningCosts);
    setFinanceRatePct(profile.novatedLease.financeRatePct);
    setAnnualKm(profile.novatedLease.annualKm);
  }, [
    profile.id,
    profile.novatedLease.vehiclePrice,
    profile.novatedLease.isEv,
    profile.novatedLease.leaseTermYears,
    profile.novatedLease.annualRunningCosts,
    profile.novatedLease.financeRatePct,
    profile.novatedLease.annualKm,
  ]);

  const summary = useMemo(
    () =>
      calculateNovatedLease({
        financialYear: profile.financialYear,
        grossSalary: profile.grossSalary,
        hasPrivateHospitalCover: profile.hasPrivateHospitalCover,
        hecsBalance: profile.hecsBalance,
        lease: {
          enabled: true,
          vehiclePrice,
          isEv,
          leaseTermYears,
          annualRunningCosts,
          financeRatePct,
          annualKm,
        },
      }),
    [
      profile.financialYear,
      profile.grossSalary,
      profile.hasPrivateHospitalCover,
      profile.hecsBalance,
      vehiclePrice,
      isEv,
      leaseTermYears,
      annualRunningCosts,
      financeRatePct,
      annualKm,
    ]
  );

  // Compute Secured Car Loan comparison on same term + residual basis
  const carLoanTotalCostOverTerm = useMemo(() => {
    const r = financeRatePct / 100 / 12;
    const n = leaseTermYears * 12;
    const balloon = summary.residualValueIncGst;
    let totalInterest = 0;
    if (r > 0 && n > 0) {
      const pvFactor = Math.pow(1 + r, -n);
      const monthlyPayment =
        ((vehiclePrice - balloon * pvFactor) * r) / (1 - pvFactor);
      totalInterest = Math.max(0, monthlyPayment * n + balloon - vehiclePrice);
    }
    return Math.round(summary.cashPurchaseTotalCostOverTerm + totalInterest);
  }, [
    vehiclePrice,
    financeRatePct,
    leaseTermYears,
    summary.residualValueIncGst,
    summary.cashPurchaseTotalCostOverTerm,
  ]);

  const threeWayChartData = useMemo(
    () => [
      {
        method: 'Novated Lease',
        totalCost: Math.round(summary.novatedLeaseNetCostOverTerm),
        fill: '#2563EB',
      },
      {
        method: 'Cash Purchase',
        totalCost: Math.round(summary.cashPurchaseTotalCostOverTerm),
        fill: '#64748B',
      },
      {
        method: 'Car Loan',
        totalCost: carLoanTotalCostOverTerm,
        fill: '#D97706',
      },
    ],
    [
      summary.novatedLeaseNetCostOverTerm,
      summary.cashPurchaseTotalCostOverTerm,
      carLoanTotalCostOverTerm,
    ]
  );

  const lctCap = NOVATED_LEASE_CONSTANTS.fuelEfficientLct[profile.financialYear];
  const april2027Cap =
    NOVATED_LEASE_CONSTANTS.evTransitionApril2027.fullExemptionPriceCap;

  const isDirty =
    !profile.novatedLease.enabled ||
    vehiclePrice !== profile.novatedLease.vehiclePrice ||
    isEv !== profile.novatedLease.isEv ||
    leaseTermYears !== profile.novatedLease.leaseTermYears ||
    annualRunningCosts !== profile.novatedLease.annualRunningCosts ||
    financeRatePct !== profile.novatedLease.financeRatePct ||
    annualKm !== profile.novatedLease.annualKm;

  const handleApply = () => {
    patchProfile({
      novatedLease: {
        enabled: true,
        vehiclePrice,
        isEv,
        leaseTermYears,
        annualRunningCosts,
        financeRatePct,
        annualKm,
      },
    });
  };

  const handleReset = () => {
    setVehiclePrice(profile.novatedLease.vehiclePrice);
    setIsEv(profile.novatedLease.isEv);
    setLeaseTermYears(profile.novatedLease.leaseTermYears);
    setAnnualRunningCosts(profile.novatedLease.annualRunningCosts);
    setFinanceRatePct(profile.novatedLease.financeRatePct);
    setAnnualKm(profile.novatedLease.annualKm);
  };

  const hasKnockOnImpact =
    summary.hecsImpactAnnual > 0 || summary.mlsImpactAnnual > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net Savings vs Cash"
          value={formatAUD(summary.netSavingsVsCashOverTerm)}
          subtext={`Effective ${formatPercent(summary.effectiveDiscountPct, 1)} discount over ${leaseTermYears} yrs`}
          tone={summary.netSavingsVsCashOverTerm > 0 ? 'positive' : 'warning'}
        />
        <StatCard
          label="GST + Tax Saved"
          value={formatAUD(
            summary.gstSavedOnPurchase +
              summary.incomeTaxAndMedicareSavedAnnual * leaseTermYears
          )}
          subtext={`GST ${formatAUD(summary.gstSavedOnPurchase)} + ${formatAUD(summary.incomeTaxAndMedicareSavedAnnual)}/yr tax`}
          tone="accent"
        />
        <StatCard
          label="Take-Home Pay Impact"
          value={`-${formatAUD(summary.netTakeHomePayReductionFortnightly)}/fn`}
          subtext={`-${formatAUD(summary.netTakeHomePayReductionAnnual)}/yr net after knock-ons`}
          tone="neutral"
        />
        <StatCard
          label="Residual Balloon"
          value={formatAUD(summary.residualValueIncGst)}
          subtext={`ATO ${formatPercent(summary.residualPct, 2)} at year ${leaseTermYears}`}
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionCard
            title="Vehicle & Lease Controls"
            subtitle="Test EV vs ICE/Hybrid novated packaging"
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsEv(true)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                    isEv
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div>Electric (EV)</div>
                  <div className="mt-0.5 text-[11px] font-normal opacity-80">
                    FBT exempt ≤ {formatAUD(lctCap)}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEv(false)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                    !isEv
                      ? 'border-blue-600 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div>ICE / Hybrid</div>
                  <div className="mt-0.5 text-[11px] font-normal opacity-80">
                    ECM post-tax offset
                  </div>
                </button>
              </div>

              <SliderField
                label="Drive-Away Vehicle Price"
                value={vehiclePrice}
                onChange={setVehiclePrice}
                min={25000}
                max={110000}
                step={1000}
                formatValue={(v) => formatAUD(v)}
              />

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Lease Term
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {LEASE_TERMS.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setLeaseTermYears(yr)}
                      className={`rounded-lg border py-1.5 text-xs font-semibold tabular-nums transition ${
                        leaseTermYears === yr
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
                label="Annual Running Costs"
                value={annualRunningCosts}
                onChange={setAnnualRunningCosts}
                min={500}
                max={15000}
                step={200}
                suffix="/yr"
                hint="Rego, insurance, tyres, energy"
              />

              <SliderField
                label="Lease Finance Rate"
                value={financeRatePct}
                onChange={setFinanceRatePct}
                min={5.5}
                max={12.5}
                step={0.1}
                formatValue={(v) => formatPercent(v, 1)}
              />

              <SliderField
                label="Annual Kilometres"
                value={annualKm}
                onChange={setAnnualKm}
                min={5000}
                max={35000}
                step={1000}
                formatValue={(v) => `${v.toLocaleString('en-AU')} km`}
              />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6 lg:col-span-8">
          {/* Prominent RFBA -> HECS & MLS Knock-On Warning Card */}
          <div
            className={`rounded-xl border p-5 ${
              hasKnockOnImpact
                ? 'border-rose-200 bg-rose-50/70 dark:border-rose-800/60 dark:bg-rose-950/40'
                : 'border-amber-200 bg-amber-50/70 dark:border-amber-800/60 dark:bg-amber-950/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={`h-5 w-5 shrink-0 ${
                    hasKnockOnImpact
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  RFBA Knock-On Warning: HECS-HELP & Medicare Levy Surcharge
                </h3>
              </div>
              <Badge tone={hasKnockOnImpact ? 'danger' : 'warning'}>
                RFBA {formatAUD(summary.rfbaAmount)}/yr
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              Even though an eligible EV is <strong>FBT-exempt</strong>, the
              Reportable Fringe Benefits Amount (RFBA) is still added to your
              ATO Repayment Income and MLS Income.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 tabular-nums">
              <div className="rounded-lg border border-white/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 p-3">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Reportable RFBA
                </div>
                <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {formatAUD(summary.rfbaAmount)}/yr
                </div>
              </div>
              <div className="rounded-lg border border-white/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 p-3">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Extra HECS Repayment
                </div>
                <div
                  className={`mt-1 text-base font-semibold ${
                    summary.hecsImpactAnnual > 0
                      ? 'text-rose-700 dark:text-rose-400'
                      : summary.hecsImpactAnnual < 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {summary.hecsImpactAnnual > 0 ? '+' : ''}
                  {formatAUD(summary.hecsImpactAnnual)}/yr
                </div>
              </div>
              <div className="rounded-lg border border-white/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 p-3">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Extra MLS Surcharge
                </div>
                <div
                  className={`mt-1 text-base font-semibold ${
                    summary.mlsImpactAnnual > 0
                      ? 'text-rose-700 dark:text-rose-400'
                      : summary.mlsImpactAnnual < 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {summary.mlsImpactAnnual > 0 ? '+' : ''}
                  {formatAUD(summary.mlsImpactAnnual)}/yr
                </div>
              </div>
            </div>
          </div>

          <SectionCard
            title={`3-Way Total Cost Comparison (${leaseTermYears}-Year Term)`}
            subtitle="Net cumulative cost including finance, running costs, tax savings, GST, and residual"
          >
            <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={threeWayChartData}
                  margin={{ top: 10, right: 20, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLES.gridStroke} />
                  <XAxis
                    dataKey="method"
                    tick={CHART_STYLES.axisTick}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`}
                    tick={CHART_STYLES.axisTick}
                    width={54}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatAUD(Number(value ?? 0)),
                      `${leaseTermYears}-Yr Net Cost`,
                    ]}
                    contentStyle={CHART_STYLES.tooltipContentStyle}
                    itemStyle={CHART_STYLES.tooltipItemStyle}
                    labelStyle={CHART_STYLES.tooltipLabelStyle}
                  />
                  <Bar
                    dataKey="totalCost"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={84}
                  >
                    {threeWayChartData.map((entry) => (
                      <Cell key={entry.method} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs sm:grid-cols-4 tabular-nums">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Financed Ex-GST</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatAUD(summary.financedAmountExGst)}
                </div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Pre-Tax Deduction</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatAUD(summary.preTaxDeductionAnnual)}/yr
                </div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Post-Tax ECM</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatAUD(summary.postTaxEcmContributionAnnual)}/yr
                </div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">FBT Exemption</span>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {summary.fbtExemptUnderCurrentRules ? 'Yes (100%)' : 'No (ECM)'}
                </div>
              </div>
            </div>
          </SectionCard>

          <AlertBanner
            tone={isEv && vehiclePrice > april2027Cap ? 'warning' : 'info'}
            title="1 April 2027 $75,000 EV FBT Transition Notice"
          >
            {summary.postApril2027EvTransitionNote} Under proposed post-1 April
            2027 EV rules, full FBT exemption caps at{' '}
            <strong className="tabular-nums">{formatAUD(april2027Cap)}</strong>{' '}
            (current fuel-efficient LCT cap is{' '}
            <strong className="tabular-nums">{formatAUD(lctCap)}</strong>).
          </AlertBanner>
        </div>
      </div>
    </div>
  );
};
