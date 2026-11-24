import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check, RotateCcw, Scale } from 'lucide-react';
import { calculateRentVsBuy } from '../../engine';
import { usePlanner } from '../../context/PlannerContext';
import {
  AlertBanner,
  Badge,
  CHART_STYLES,
  ChartSwatchLegend,
  CurrencyInput,
  SectionCard,
  SliderField,
  StatCard,
  formatAUD,
  formatPercent,
} from '../SharedPrimitives';

export const RentVsBuyCalc: React.FC = () => {
  const { profile, patchProfile, lifePlan, isDark } = usePlanner();

  const defaultDepositPct =
    profile.depositStrategy === '5_hgs'
      ? 5
      : profile.depositStrategy === '10_lmi'
        ? 10
        : 20;

  const [horizonYears, setHorizonYears] = useState(15);
  const [dollarMode, setDollarMode] = useState<'real' | 'nominal'>('real');
  const [propertyPrice, setPropertyPrice] = useState(profile.targetPropertyPrice);
  const [depositPct, setDepositPct] = useState(defaultDepositPct);
  const [mortgageRatePct, setMortgageRatePct] = useState(profile.targetMortgageRatePct);
  const [capitalGrowthPct, setCapitalGrowthPct] = useState(5.5);
  const [inflationRatePct, setInflationRatePct] = useState(2.8);
  const [weeklyRent, setWeeklyRent] = useState(profile.currentWeeklyRent);
  const [annualRentIncreasePct, setAnnualRentIncreasePct] = useState(3.5);
  const [rentersInsuranceAnnual, setRentersInsuranceAnnual] = useState(280);
  const [investmentReturnPct, setInvestmentReturnPct] = useState(profile.investmentReturnPct);

  const [strataAnnual, setStrataAnnual] = useState(3600);
  const [councilRatesAnnual, setCouncilRatesAnnual] = useState(1600);
  const [waterRatesAnnual, setWaterRatesAnnual] = useState(1000);
  const [homeInsuranceAnnual, setHomeInsuranceAnnual] = useState(1800);
  const [maintenancePctOfValue, setMaintenancePctOfValue] = useState(0.8);
  const [sellingCostsPct, setSellingCostsPct] = useState(2.2);
  const [offsetBalanceInitial, setOffsetBalanceInitial] = useState(() =>
    Math.min(25000, profile.currentCashSavings),
  );
  const [offsetMonthlyContribution, setOffsetMonthlyContribution] = useState(0);
  const [annualOffsetFee, setAnnualOffsetFee] = useState(0);

  useEffect(() => {
    setPropertyPrice(profile.targetPropertyPrice);
    setDepositPct(defaultDepositPct);
    setMortgageRatePct(profile.targetMortgageRatePct);
    setWeeklyRent(profile.currentWeeklyRent);
    setInvestmentReturnPct(profile.investmentReturnPct);
    setOffsetBalanceInitial(Math.min(25000, profile.currentCashSavings));
  }, [
    profile.id,
    profile.targetPropertyPrice,
    defaultDepositPct,
    profile.targetMortgageRatePct,
    profile.currentWeeklyRent,
    profile.investmentReturnPct,
    profile.currentCashSavings,
  ]);

  const summary = useMemo(
    () =>
      calculateRentVsBuy({
        state: profile.state,
        cityLabel: profile.cityLabel,
        propertyPrice,
        depositPct,
        isFirstHomeBuyer: profile.isFirstHomeBuyer,
        isNewHome: profile.isNewHome,
        mortgageRatePct,
        loanTermYears: 30,
        capitalGrowthPct,
        inflationRatePct,
        weeklyRent,
        annualRentIncreasePct,
        rentersInsuranceAnnual,
        investmentReturnPct,
        marginalTaxRatePct: lifePlan.tax.effectiveMarginalRateWithMedicare * 100,
        strataAnnual,
        councilRatesAnnual,
        waterRatesAnnual,
        homeInsuranceAnnual,
        maintenancePctOfValue,
        buyingCostsFixed: 3500,
        sellingCostsPct,
        horizonYears,
        offsetBalanceInitial,
        offsetMonthlyContribution,
        annualOffsetFee,
      }),
    [
      profile.state,
      profile.cityLabel,
      profile.isFirstHomeBuyer,
      profile.isNewHome,
      lifePlan.tax.effectiveMarginalRateWithMedicare,
      propertyPrice,
      depositPct,
      mortgageRatePct,
      capitalGrowthPct,
      inflationRatePct,
      weeklyRent,
      annualRentIncreasePct,
      rentersInsuranceAnnual,
      investmentReturnPct,
      strataAnnual,
      councilRatesAnnual,
      waterRatesAnnual,
      homeInsuranceAnnual,
      maintenancePctOfValue,
      sellingCostsPct,
      horizonYears,
      offsetBalanceInitial,
      offsetMonthlyContribution,
      annualOffsetFee,
    ],
  );

  const isReal = dollarMode === 'real';
  const activeWinner = isReal ? summary.winnerReal : summary.winner;
  const activeBuyerWealth = isReal
    ? summary.buyerNetWealthReal
    : summary.buyerNetWealthNominal;
  const activeRenterWealth = isReal
    ? summary.renterNetWealthReal
    : summary.renterNetWealthNominal;
  const activeDiff = isReal
    ? summary.netWealthDiffReal
    : summary.netWealthDiffNominal;
  const activeBreakEven = isReal
    ? summary.breakEvenYearReal
    : summary.breakEvenYearNominal;

  const isDirty =
    propertyPrice !== profile.targetPropertyPrice ||
    weeklyRent !== profile.currentWeeklyRent ||
    mortgageRatePct !== profile.targetMortgageRatePct ||
    investmentReturnPct !== profile.investmentReturnPct;

  const handleApply = () => {
    patchProfile({
      targetPropertyPrice: propertyPrice,
      currentWeeklyRent: weeklyRent,
      targetMortgageRatePct: mortgageRatePct,
      investmentReturnPct,
    });
  };

  const handleReset = () => {
    setPropertyPrice(profile.targetPropertyPrice);
    setDepositPct(defaultDepositPct);
    setMortgageRatePct(profile.targetMortgageRatePct);
    setWeeklyRent(profile.currentWeeklyRent);
    setInvestmentReturnPct(profile.investmentReturnPct);
    setHorizonYears(15);
    setCapitalGrowthPct(5.5);
    setInflationRatePct(2.8);
    setAnnualRentIncreasePct(3.5);
    setRentersInsuranceAnnual(280);
    setStrataAnnual(3600);
    setCouncilRatesAnnual(1600);
    setWaterRatesAnnual(1000);
    setHomeInsuranceAnnual(1800);
    setMaintenancePctOfValue(0.8);
    setSellingCostsPct(2.2);
    setOffsetBalanceInitial(Math.min(25000, profile.currentCashSavings));
    setOffsetMonthlyContribution(0);
    setAnnualOffsetFee(0);
  };

  const winnerTone =
    activeWinner === 'buy'
      ? 'positive'
      : activeWinner === 'rent'
        ? 'accent'
        : 'warning';

  const yearOneMonthlyMaintenance = Math.round(
    (propertyPrice * (maintenancePctOfValue / 100)) / 12,
  );
  const yearOneMonthlyDiff =
    summary.yearOneMonthlyOwnTotal - summary.yearOneMonthlyRent;

  return (
    <div className="space-y-6">
      {/* Verdict & Nominal/Real Toggle Banner */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800/60 dark:bg-blue-950/50 dark:text-blue-400">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                  {horizonYears}-Year Verdict ({isReal ? "Today's $" : 'Nominal $'})
                </span>
                <Badge tone={winnerTone}>
                  {activeWinner === 'buy'
                    ? 'Buying Wins'
                    : activeWinner === 'rent'
                      ? 'Renting & Investing Wins'
                      : 'Roughly Even'}
                </Badge>
                {activeBreakEven !== null ? (
                  <Badge tone="neutral">Break-even Yr {activeBreakEven}</Badge>
                ) : (
                  <Badge tone="warning">No Break-Even in {horizonYears}y</Badge>
                )}
              </div>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                {activeWinner === 'buy' ? (
                  <>
                    Buying leads by{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatAUD(Math.abs(activeDiff))}
                    </strong>{' '}
                    in net wealth after mortgage, strata, rates, insurance, maintenance &amp; selling costs.
                  </>
                ) : activeWinner === 'rent' ? (
                  <>
                    Renting &amp; investing leads by{' '}
                    <strong className="text-blue-700 dark:text-blue-400 tabular-nums">
                      {formatAUD(Math.abs(activeDiff))}
                    </strong>{' '}
                    after CGT on portfolio gains &amp; annual rent increases.
                  </>
                ) : (
                  <>Within $2,500 over {horizonYears} years — effectively a financial tie.</>
                )}
              </p>
            </div>
          </div>

          <div
            role="group"
            aria-label="Dollar basis"
            className="inline-flex shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1"
          >
            <button
              type="button"
              onClick={() => setDollarMode('real')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                isReal
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Real (Today&apos;s $)
            </button>
            <button
              type="button"
              onClick={() => setDollarMode('nominal')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                !isReal
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Nominal ($)
            </button>
          </div>
        </div>
      </div>

      {/* 4 KPI StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Buyer Net Wealth"
          value={formatAUD(activeBuyerWealth)}
          subtext={`Home equity + side savings at Yr ${horizonYears}`}
          tone={activeWinner === 'buy' ? 'positive' : 'neutral'}
        />
        <StatCard
          label="Renter Net Wealth"
          value={formatAUD(activeRenterWealth)}
          subtext={`Starting ${formatAUD(summary.initialCashRequired)} + monthly savings`}
          tone={activeWinner === 'rent' ? 'accent' : 'neutral'}
        />
        <StatCard
          label="Unrecoverable Costs"
          value={`${formatAUD(summary.totalBuyUnrecoverable)} vs ${formatAUD(summary.totalRentUnrecoverable)}`}
          subtext="Buy sunk costs (interest, rates, duty) vs Rent paid"
          tone={summary.totalBuyUnrecoverable < summary.totalRentUnrecoverable ? 'positive' : 'warning'}
        />
        <StatCard
          label="Year-1 Monthly Outflow"
          value={`${formatAUD(summary.yearOneMonthlyOwnTotal)} vs ${formatAUD(summary.yearOneMonthlyRent)}`}
          subtext={`Own (${formatAUD(summary.yearOneMonthlyRunningCosts)} running) vs Rent`}
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Controls Column */}
        <div className="lg:col-span-4">
          <SectionCard
            title="Rent vs Buy Assumptions"
            subtitle="All running costs indexed by inflation"
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
                label="Comparison Horizon"
                value={horizonYears}
                onChange={setHorizonYears}
                min={3}
                max={30}
                step={1}
                formatValue={(v) => `${v} yrs`}
              />

              <SliderField
                label="CPI Inflation Rate"
                value={inflationRatePct}
                onChange={setInflationRatePct}
                min={1.0}
                max={6.0}
                step={0.1}
                formatValue={(v) => formatPercent(v, 1)}
              />

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                  Renting &amp; Investing
                </div>
                <div className="space-y-3">
                  <CurrencyInput
                    label="Weekly Rent"
                    value={weeklyRent}
                    onChange={setWeeklyRent}
                    min={150}
                    max={3000}
                    step={10}
                    suffix="/wk"
                  />
                  <SliderField
                    label="Annual Rent Increase"
                    value={annualRentIncreasePct}
                    onChange={setAnnualRentIncreasePct}
                    min={0}
                    max={8}
                    step={0.25}
                    formatValue={(v) => formatPercent(v, 2)}
                  />
                  <SliderField
                    label="Investment Return (ETF/Shares)"
                    value={investmentReturnPct}
                    onChange={setInvestmentReturnPct}
                    min={2}
                    max={12}
                    step={0.25}
                    formatValue={(v) => formatPercent(v, 2)}
                  />
                  <CurrencyInput
                    label="Renters Contents Insurance"
                    value={rentersInsuranceAnnual}
                    onChange={setRentersInsuranceAnnual}
                    min={0}
                    max={3000}
                    step={20}
                    suffix="/yr"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                  Property &amp; Mortgage
                </div>
                <div className="space-y-3">
                  <CurrencyInput
                    label="Property Price"
                    value={propertyPrice}
                    onChange={setPropertyPrice}
                    min={200000}
                    max={5000000}
                    step={10000}
                  />
                  <div className="space-y-1.5">
                    <SliderField
                      label="Deposit %"
                      value={depositPct}
                      onChange={setDepositPct}
                      min={5}
                      max={40}
                      step={1}
                      formatValue={(v) => `${v}% (${formatAUD((propertyPrice * v) / 100)})`}
                    />
                    <div className="grid grid-cols-3 gap-1.5">
                      {[5, 10, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDepositPct(pct)}
                          className={`rounded-md border py-1 text-[11px] font-semibold transition ${
                            depositPct === pct
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <SliderField
                    label="Mortgage Interest Rate"
                    value={mortgageRatePct}
                    onChange={setMortgageRatePct}
                    min={3.5}
                    max={9.5}
                    step={0.05}
                    formatValue={(v) => formatPercent(v, 2)}
                  />
                  <SliderField
                    label="Property Capital Growth"
                    value={capitalGrowthPct}
                    onChange={setCapitalGrowthPct}
                    min={0}
                    max={10}
                    step={0.25}
                    formatValue={(v) => formatPercent(v, 2)}
                  />
                  <SliderField
                    label="Exit Selling Costs"
                    value={sellingCostsPct}
                    onChange={setSellingCostsPct}
                    min={0}
                    max={5}
                    step={0.1}
                    formatValue={(v) => formatPercent(v, 1)}
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                  Mortgage Offset Account
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <CurrencyInput
                      label="Starting Offset Cash"
                      value={offsetBalanceInitial}
                      onChange={setOffsetBalanceInitial}
                      min={0}
                      max={500000}
                      step={2500}
                    />
                    <div className="grid grid-cols-4 gap-1.5">
                      {[0, 10000, 25000, 50000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setOffsetBalanceInitial(preset)}
                          className={`rounded-md border py-1 text-[11px] font-semibold transition ${
                            offsetBalanceInitial === preset
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {preset === 0 ? '$0' : `$${preset / 1000}k`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <CurrencyInput
                      label="Monthly Top-Up"
                      value={offsetMonthlyContribution}
                      onChange={setOffsetMonthlyContribution}
                      min={0}
                      max={15000}
                      step={100}
                      suffix="/mo"
                    />
                    <CurrencyInput
                      label="Package Fee"
                      value={annualOffsetFee}
                      onChange={setAnnualOffsetFee}
                      min={0}
                      max={1500}
                      step={25}
                      suffix="/yr"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
                  Ownership Running Costs
                </div>
                <div className="space-y-3">
                  <CurrencyInput
                    label="Strata / Body Corporate"
                    value={strataAnnual}
                    onChange={setStrataAnnual}
                    min={0}
                    max={25000}
                    step={200}
                    suffix="/yr"
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <CurrencyInput
                      label="Council Rates"
                      value={councilRatesAnnual}
                      onChange={setCouncilRatesAnnual}
                      min={0}
                      max={10000}
                      step={100}
                      suffix="/yr"
                    />
                    <CurrencyInput
                      label="Water Rates"
                      value={waterRatesAnnual}
                      onChange={setWaterRatesAnnual}
                      min={0}
                      max={5000}
                      step={50}
                      suffix="/yr"
                    />
                  </div>
                  <CurrencyInput
                    label="Home & Building Insurance"
                    value={homeInsuranceAnnual}
                    onChange={setHomeInsuranceAnnual}
                    min={0}
                    max={10000}
                    step={100}
                    suffix="/yr"
                  />
                  <SliderField
                    label="Annual Maintenance (% of Value)"
                    value={maintenancePctOfValue}
                    onChange={setMaintenancePctOfValue}
                    min={0}
                    max={2.5}
                    step={0.1}
                    formatValue={(v) =>
                      `${formatPercent(v, 1)} (${formatAUD((propertyPrice * v) / 100)}/yr)`
                    }
                  />
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Charts & Tables */}
        <div className="space-y-6 lg:col-span-8">
          {offsetBalanceInitial > 0 || offsetMonthlyContribution > 0 ? (
            <SectionCard
              title="Mortgage Offset Benefit"
              subtitle="Apples-to-apples comparison: renter invests identical extra starting cash & monthly top-ups"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 tabular-nums">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Interest Saved ({horizonYears} yrs)
                  </div>
                  <div className="mt-0.5 text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    {formatAUD(summary.totalOffsetInterestSaved)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Tax-Free HISA Equivalent
                  </div>
                  <div className="mt-0.5 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {formatPercent(summary.offsetTaxFreeEquivalentRatePct, 2)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Offset Cash at Yr {horizonYears}
                  </div>
                  <div className="mt-0.5 text-lg font-bold text-blue-700 dark:text-blue-400">
                    {formatAUD(summary.finalOffsetBalance)}
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            title={`Net Wealth Trajectory (${isReal ? "Today's Real $" : 'Nominal $'})`}
            subtitle="Buyer home equity (after selling costs) vs Renter portfolio (after 50% discount CGT)"
          >
            <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={summary.yearlySeries}
                  margin={{ top: 20, right: 18, left: 6, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLES.gridStroke} />
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
                    width={60}
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
                  {activeBreakEven !== null ? (
                    <ReferenceLine
                      x={activeBreakEven}
                      stroke="#D97706"
                      strokeDasharray="3 3"
                      label={{
                        value: `Break-even Yr ${activeBreakEven}`,
                        position: 'insideTopRight',
                        fill: isDark ? '#FBBF24' : '#B45309',
                        fontSize: 11,
                      }}
                    />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey={isReal ? 'buyerNetWealthReal' : 'buyerNetWealthNominal'}
                    name="Buy (Home Equity)"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey={isReal ? 'renterNetWealthReal' : 'renterNetWealthNominal'}
                    name="Rent & Invest"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard
              title={`Unrecoverable Costs (${horizonYears} yrs)`}
              subtitle="Non-equity cash burned on Rent vs Interest, Duty, Strata, Rates & Maintenance"
            >
              <div className="h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.costBreakdown}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 10, bottom: 0 }}
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
                      dataKey="label"
                      width={136}
                      tick={{ fontSize: 11, fill: isDark ? '#CBD5E1' : '#334155', fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [formatAUD(Number(value ?? 0)), `${horizonYears}-Yr Cost`]}
                      contentStyle={CHART_STYLES.tooltipContentStyle}
                      itemStyle={CHART_STYLES.tooltipItemStyle}
                      labelStyle={CHART_STYLES.tooltipLabelStyle}
                    />
                    <Legend
                      content={() => (
                        <ChartSwatchLegend
                          items={summary.costBreakdown
                            .filter((c) => c.amount > 0)
                            .map((c) => ({
                              label: c.label,
                              color: c.color,
                            }))}
                        />
                      )}
                    />
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={18}>
                      {summary.costBreakdown.map((entry) => (
                        <Cell key={entry.label} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard
              title="Year-1 Monthly Cost Breakdown"
              subtitle="Exact line-by-line monthly cashflow before rent growth & inflation"
            >
              <div className="space-y-2 text-xs tabular-nums">
                <div className="flex justify-between py-1">
                  <span className="text-slate-600 dark:text-slate-400">Rent ({formatAUD(weeklyRent)}/wk) + Insurance</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-400">
                    {formatAUD(summary.yearOneMonthlyRent)}/mo
                  </span>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Buying Monthly Outflow
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Mortgage Interest (Yr 1)</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatAUD(summary.yearOneMonthlyMortgageInterest)}/mo
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Principal Repaid (Equity)</span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    {formatAUD(summary.yearOneMonthlyMortgagePI - summary.yearOneMonthlyMortgageInterest)}/mo
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Strata / Body Corporate</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatAUD(strataAnnual / 12)}/mo
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Council + Water Rates</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatAUD((councilRatesAnnual + waterRatesAnnual) / 12)}/mo
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Home Insurance</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatAUD(homeInsuranceAnnual / 12)}/mo
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Maintenance ({formatPercent(maintenancePctOfValue, 1)})</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatAUD(yearOneMonthlyMaintenance)}/mo
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 font-semibold text-slate-900 dark:text-slate-100">
                  <span>Total Buyer Monthly Cash Out</span>
                  <span>{formatAUD(summary.yearOneMonthlyOwnTotal)}/mo</span>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 dark:bg-slate-800/70 px-2.5 py-2 text-[11px]">
                  <span className="text-slate-600 dark:text-slate-300">
                    {yearOneMonthlyDiff >= 0
                      ? 'Renter invests monthly savings'
                      : 'Buyer invests monthly savings'}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatAUD(Math.abs(yearOneMonthlyDiff))}/mo
                  </span>
                </div>
              </div>
            </SectionCard>
          </div>

          <AlertBanner
            tone={activeWinner === 'buy' ? 'success' : activeWinner === 'rent' ? 'info' : 'warning'}
            title="Rent vs Buy Key Takeaways"
          >
            <ul className="list-disc space-y-1 pl-4">
              {summary.insights.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </AlertBanner>
        </div>
      </div>
    </div>
  );
};
