import { HGS_PRICE_CAPS } from '../data/auConstants';
import type {
  AuState,
  RentVsBuyCostItem,
  RentVsBuyInput,
  RentVsBuySummary,
  RentVsBuyYearPoint,
} from '../types/planner';
import { calculateStampDuty } from './housing';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getHgsCapForCity(state: AuState, cityLabel: string): number {
  const caps = HGS_PRICE_CAPS[state];
  const lower = cityLabel.toLowerCase();
  const isMetro =
    lower.includes(caps.metroLabel.toLowerCase()) ||
    caps.metroCap === caps.regionalCap;
  return isMetro ? caps.metroCap : caps.regionalCap;
}

function computeMonthlyPI(
  principal: number,
  annualRatePct: number,
  termYears: number,
): number {
  if (principal <= 0) return 0;
  const n = Math.max(12, Math.round(termYears * 12));
  const r = Math.max(0, annualRatePct) / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

function estimateLmiForRentVsBuy(
  loanAmount: number,
  lvrPct: number,
  hgsEligible: boolean,
): number {
  if (loanAmount <= 0 || lvrPct <= 80 || hgsEligible) return 0;
  if (lvrPct <= 90) return Math.round(loanAmount * 0.022);
  if (lvrPct <= 95) return Math.round(loanAmount * 0.038);
  return Math.round(loanAmount * 0.048);
}

/**
 * Compares Renting + Investing vs Buying with a Mortgage over a multi-year horizon,
 * accounting for rent growth, mortgage amortisation, inflation, capital growth,
 * strata, council rates, water, home insurance, maintenance, stamp duty, LMI,
 * selling costs, and cashflow-parity portfolio investing (Nominal & Real).
 */
export function calculateRentVsBuy(input: RentVsBuyInput): RentVsBuySummary {
  const horizonYears = Math.max(1, Math.min(35, Math.round(input.horizonYears)));
  const propertyPrice = Math.max(50000, input.propertyPrice);
  const depositPct = Math.max(0, Math.min(100, input.depositPct));
  const depositAmount = Math.round(propertyPrice * (depositPct / 100));
  const initialLoanAmount = Math.max(0, Math.round(propertyPrice - depositAmount));
  const lvrPct = propertyPrice > 0 ? (initialLoanAmount / propertyPrice) * 100 : 0;

  const hgsCap = getHgsCapForCity(input.state, input.cityLabel);
  const hgsEligible =
    input.isFirstHomeBuyer && lvrPct <= 95 && propertyPrice <= hgsCap;

  const stampDuty = calculateStampDuty(
    propertyPrice,
    input.state,
    input.isFirstHomeBuyer,
    input.isNewHome,
  );
  const lmiEstimate = estimateLmiForRentVsBuy(
    initialLoanAmount,
    lvrPct,
    hgsEligible,
  );
  const buyingCostsFixed = Math.max(0, Math.round(input.buyingCostsFixed));
  const upfrontSunkCosts = Math.round(stampDuty + lmiEstimate + buyingCostsFixed);
  const initialCashRequired = Math.round(depositAmount + upfrontSunkCosts);

  const offsetInit = Math.max(0, Math.round(input.offsetBalanceInitial ?? 0));
  const offsetMonthly = Math.max(0, input.offsetMonthlyContribution ?? 0);
  const annualOffsetFee = Math.max(0, input.annualOffsetFee ?? 0);
  const hasOffsetActivity = offsetInit > 0 || offsetMonthly > 0;

  const monthlyMortgageRate = Math.max(0, input.mortgageRatePct) / 100 / 12;
  const scheduledMonthlyPI = computeMonthlyPI(
    initialLoanAmount,
    input.mortgageRatePct,
    input.loanTermYears,
  );
  const monthlyPropertyGrowth =
    Math.pow(1 + Math.max(-0.2, input.capitalGrowthPct / 100), 1 / 12) - 1;

  // Split investment return into ~3% dividend yield (taxed annually) and remaining
  // capital appreciation (2026-27 Budget from 1 Jul 2027: CPI-indexed cost base + min 30% CGT).
  const grossReturnDec = Math.max(0, input.investmentReturnPct / 100);
  const marginalTaxDec = Math.max(0, Math.min(0.47, input.marginalTaxRatePct / 100));
  const dividendYieldAnnual = Math.min(grossReturnDec, 0.03);
  const capReturnAnnual = Math.max(0, grossReturnDec - dividendYieldAnnual);
  const netAnnualPortfolioReturn =
    dividendYieldAnnual * (1 - marginalTaxDec) + capReturnAnnual;
  const monthlyPortfolioRate = Math.pow(1 + netAnnualPortfolioReturn, 1 / 12) - 1;
  const offsetTaxFreeEquivalentRatePct = round2(
    input.mortgageRatePct / (1 - marginalTaxDec),
  );
  const mortgageRateDec = Math.max(0, input.mortgageRatePct) / 100;
  const inflationDec = Math.max(0, input.inflationRatePct / 100);
  const dividendYieldForEquiv = 0.03;
  const effectiveCgtRate = Math.max(0.3, marginalTaxDec);
  const maxYieldNetForEquiv = dividendYieldForEquiv * (1 - marginalTaxDec);
  const offsetEtfEquivDec =
    mortgageRateDec <= maxYieldNetForEquiv
      ? mortgageRateDec / (1 - marginalTaxDec)
      : mortgageRateDec <= maxYieldNetForEquiv + inflationDec
        ? dividendYieldForEquiv + (mortgageRateDec - maxYieldNetForEquiv)
        : dividendYieldForEquiv +
          inflationDec +
          (mortgageRateDec - maxYieldNetForEquiv - inflationDec) /
            (1 - effectiveCgtRate);
  const offsetTaxFreeEquivalentEtfRatePct = round2(offsetEtfEquivDec * 100);

  const monthlyInflationRate = Math.pow(1 + inflationDec, 1 / 12) - 1;
  const rentGrowthDec = Math.max(0, input.annualRentIncreasePct / 100);
  const sellingCostsDec = Math.max(0, input.sellingCostsPct / 100);
  const maintenancePctDec = Math.max(0, input.maintenancePctOfValue / 100);

  let propertyValue = propertyPrice;
  let loanBalance = initialLoanAmount;
  let noOffsetLoanBalance = initialLoanAmount;
  let buyerOffsetBalance = offsetInit;
  let renterPortfolio = initialCashRequired + offsetInit;
  let renterCostBasis = initialCashRequired + offsetInit;
  let buyerSidePortfolio = 0;
  let buyerSideCostBasis = 0;

  let totalRentPaid = 0;
  let totalRentersInsurance = 0;
  let totalMortgageInterest = 0;
  let totalNoOffsetInterest = 0;
  let totalOffsetFees = 0;
  let totalPrincipalRepaid = 0;
  let totalStrata = 0;
  let totalCouncil = 0;
  let totalWater = 0;
  let totalHomeInsurance = 0;
  let totalMaintenance = 0;

  let yearOneMonthlyRent = 0;
  let yearOneMonthlyMortgagePI = 0;
  let yearOneMonthlyMortgageInterest = 0;
  let yearOneMonthlyRunningCosts = 0;
  let yearOneMonthlyOwnTotal = 0;

  const computeAfterTaxPortfolioValue = (value: number, indexedBasis: number): number => {
    const realGain = Math.max(0, value - indexedBasis);
    const cgt = realGain * effectiveCgtRate;
    return Math.max(0, value - cgt);
  };

  const yearlySeries: RentVsBuyYearPoint[] = [
    {
      year: 0,
      propertyValue: Math.round(propertyPrice),
      loanBalance: Math.round(initialLoanAmount),
      buyerNetWealthNominal: Math.round(
        propertyPrice - initialLoanAmount - propertyPrice * sellingCostsDec + offsetInit,
      ),
      buyerNetWealthReal: Math.round(
        propertyPrice - initialLoanAmount - propertyPrice * sellingCostsDec + offsetInit,
      ),
      renterNetWealthNominal: Math.round(initialCashRequired + offsetInit),
      renterNetWealthReal: Math.round(initialCashRequired + offsetInit),
      annualRentCost: 0,
      annualOwnershipTotalCost: 0,
      annualMortgageInterest: 0,
      annualOwnershipRunningCosts: 0,
      cumulativeRentUnrecoverable: 0,
      cumulativeBuyUnrecoverable: Math.round(upfrontSunkCosts + propertyPrice * sellingCostsDec),
    },
  ];

  let breakEvenYearNominal: number | null = null;
  let breakEvenYearReal: number | null = null;

  for (let year = 1; year <= horizonYears; year++) {
    const inflationFactor = Math.pow(1 + inflationDec, year - 1);
    const rentFactor = Math.pow(1 + rentGrowthDec, year - 1);

    const annualRent = Math.max(0, input.weeklyRent) * 52 * rentFactor;
    const annualRentersIns = Math.max(0, input.rentersInsuranceAnnual) * inflationFactor;
    const annualStrata = Math.max(0, input.strataAnnual) * inflationFactor;
    const annualCouncil = Math.max(0, input.councilRatesAnnual) * inflationFactor;
    const annualWater = Math.max(0, input.waterRatesAnnual) * inflationFactor;
    const annualHomeIns = Math.max(0, input.homeInsuranceAnnual) * inflationFactor;
    const annualMaint = propertyValue * maintenancePctDec;

    const annualRunningCosts =
      annualStrata + annualCouncil + annualWater + annualHomeIns + annualMaint;

    const monthlyRent = annualRent / 12;
    const monthlyRentersIns = annualRentersIns / 12;
    const monthlyRentTotal = monthlyRent + monthlyRentersIns;
    const monthlyRunning = annualRunningCosts / 12;

    let yearMortgageInterest = 0;
    let yearMortgagePI = 0;
    let yearOffsetFees = 0;

    for (let m = 1; m <= 12; m++) {
      // Apples-to-apples monthly offset savings contributed equally to buyer offset & renter portfolio
      buyerOffsetBalance += offsetMonthly;

      // Track baseline mortgage interest without offset for exact savings attribution
      if (noOffsetLoanBalance > 0) {
        const noOffInt = noOffsetLoanBalance * monthlyMortgageRate;
        const noOffPay = Math.min(noOffsetLoanBalance + noOffInt, scheduledMonthlyPI);
        const noOffPrincipal = Math.max(0, noOffPay - noOffInt);
        noOffsetLoanBalance = Math.max(0, noOffsetLoanBalance - noOffPrincipal);
        totalNoOffsetInterest += noOffInt;
      }

      let monthlyInterest = 0;
      let actualPI = 0;
      let monthlyOffsetFee = 0;
      if (loanBalance > 0) {
        if (hasOffsetActivity && annualOffsetFee > 0) {
          monthlyOffsetFee = annualOffsetFee / 12;
          yearOffsetFees += monthlyOffsetFee;
          totalOffsetFees += monthlyOffsetFee;
        }
        const effectiveOffset = Math.min(loanBalance, buyerOffsetBalance);
        const chargeablePrincipal = Math.max(0, loanBalance - effectiveOffset);
        monthlyInterest = chargeablePrincipal * monthlyMortgageRate;
        const rawPayment = Math.min(loanBalance + monthlyInterest, scheduledMonthlyPI);
        const principalPaid = Math.max(0, rawPayment - monthlyInterest);
        loanBalance = Math.max(0, loanBalance - principalPaid);
        actualPI = rawPayment;
        yearMortgageInterest += monthlyInterest;
        yearMortgagePI += actualPI;
        totalMortgageInterest += monthlyInterest;
        totalPrincipalRepaid += principalPaid;
      }

      if (year === 1 && m === 1) {
        yearOneMonthlyRent = round2(monthlyRentTotal);
        yearOneMonthlyMortgagePI = round2(actualPI);
        yearOneMonthlyMortgageInterest = round2(monthlyInterest);
        yearOneMonthlyRunningCosts = round2(monthlyRunning + monthlyOffsetFee);
        yearOneMonthlyOwnTotal = round2(actualPI + monthlyRunning + monthlyOffsetFee);
      }

      propertyValue *= 1 + monthlyPropertyGrowth;

      const buyerMonthlyCashOut = actualPI + monthlyRunning + monthlyOffsetFee;
      const diff = buyerMonthlyCashOut - monthlyRentTotal;

      // Grow existing portfolios & CPI-index cost bases, then add renter's parity offset saving + cashflow diff
      renterPortfolio = renterPortfolio * (1 + monthlyPortfolioRate) + offsetMonthly;
      renterCostBasis = renterCostBasis * (1 + monthlyInflationRate) + offsetMonthly;
      buyerSidePortfolio *= 1 + monthlyPortfolioRate;
      buyerSideCostBasis *= 1 + monthlyInflationRate;

      if (diff > 0) {
        renterPortfolio += diff;
        renterCostBasis += diff;
      } else if (diff < 0) {
        const extraBuySavings = Math.abs(diff);
        buyerSidePortfolio += extraBuySavings;
        buyerSideCostBasis += extraBuySavings;
      }
    }

    totalRentPaid += annualRent;
    totalRentersInsurance += annualRentersIns;
    totalStrata += annualStrata;
    totalCouncil += annualCouncil;
    totalWater += annualWater;
    totalHomeInsurance += annualHomeIns;
    totalMaintenance += annualMaint;

    const sellingCostAtYear = propertyValue * sellingCostsDec;
    const buyerEquityNominal =
      propertyValue -
      loanBalance -
      sellingCostAtYear +
      buyerOffsetBalance +
      computeAfterTaxPortfolioValue(buyerSidePortfolio, buyerSideCostBasis);
    const renterEquityNominal = computeAfterTaxPortfolioValue(
      renterPortfolio,
      renterCostBasis,
    );

    const deflator = Math.pow(1 + inflationDec, year);
    const buyerEquityReal = buyerEquityNominal / deflator;
    const renterEquityReal = renterEquityNominal / deflator;

    if (breakEvenYearNominal === null && buyerEquityNominal >= renterEquityNominal) {
      breakEvenYearNominal = year;
    }
    if (breakEvenYearReal === null && buyerEquityReal >= renterEquityReal) {
      breakEvenYearReal = year;
    }

    const cumulativeRentUnrecoverable = Math.round(totalRentPaid + totalRentersInsurance);
    const cumulativeBuyUnrecoverable = Math.round(
      upfrontSunkCosts +
        totalMortgageInterest +
        totalOffsetFees +
        totalStrata +
        totalCouncil +
        totalWater +
        totalHomeInsurance +
        totalMaintenance +
        sellingCostAtYear,
    );

    yearlySeries.push({
      year,
      propertyValue: Math.round(propertyValue),
      loanBalance: Math.round(loanBalance),
      buyerNetWealthNominal: Math.round(buyerEquityNominal),
      buyerNetWealthReal: Math.round(buyerEquityReal),
      renterNetWealthNominal: Math.round(renterEquityNominal),
      renterNetWealthReal: Math.round(renterEquityReal),
      annualRentCost: Math.round(annualRent + annualRentersIns),
      annualOwnershipTotalCost: Math.round(
        yearMortgagePI + annualRunningCosts + yearOffsetFees,
      ),
      annualMortgageInterest: Math.round(yearMortgageInterest),
      annualOwnershipRunningCosts: Math.round(annualRunningCosts + yearOffsetFees),
      cumulativeRentUnrecoverable,
      cumulativeBuyUnrecoverable,
    });
  }

  const last = yearlySeries[yearlySeries.length - 1];
  const buyerNetWealthNominal = last.buyerNetWealthNominal;
  const renterNetWealthNominal = last.renterNetWealthNominal;
  const netWealthDiffNominal = buyerNetWealthNominal - renterNetWealthNominal;

  const buyerNetWealthReal = last.buyerNetWealthReal;
  const renterNetWealthReal = last.renterNetWealthReal;
  const netWealthDiffReal = buyerNetWealthReal - renterNetWealthReal;

  const winner: RentVsBuySummary['winner'] =
    Math.abs(netWealthDiffNominal) < 2500
      ? 'tie'
      : netWealthDiffNominal > 0
        ? 'buy'
        : 'rent';

  const winnerReal: RentVsBuySummary['winnerReal'] =
    Math.abs(netWealthDiffReal) < 2500
      ? 'tie'
      : netWealthDiffReal > 0
        ? 'buy'
        : 'rent';

  const estimatedSellingCosts = Math.round(propertyValue * sellingCostsDec);
  const totalRentUnrecoverable = Math.round(totalRentPaid + totalRentersInsurance);
  const totalBuyUnrecoverable = Math.round(
    upfrontSunkCosts +
      totalMortgageInterest +
      totalOffsetFees +
      totalStrata +
      totalCouncil +
      totalWater +
      totalHomeInsurance +
      totalMaintenance +
      estimatedSellingCosts,
  );
  const totalOffsetInterestSaved = Math.max(
    0,
    Math.round(totalNoOffsetInterest - totalMortgageInterest),
  );

  const costBreakdown: RentVsBuyCostItem[] = [
    {
      label: 'Rent Paid',
      amount: Math.round(totalRentPaid),
      side: 'rent',
      color: '#2563EB',
    },
    {
      label: 'Renters Insurance',
      amount: Math.round(totalRentersInsurance),
      side: 'rent',
      color: '#60A5FA',
    },
    {
      label: 'Mortgage Interest',
      amount: Math.round(totalMortgageInterest),
      side: 'buy',
      color: '#D97706',
    },
    {
      label: 'Stamp Duty, LMI & Legal',
      amount: Math.round(upfrontSunkCosts),
      side: 'buy',
      color: '#E11D48',
    },
    {
      label: 'Selling Costs',
      amount: estimatedSellingCosts,
      side: 'buy',
      color: '#F43F5E',
    },
    {
      label: 'Strata / Body Corp',
      amount: Math.round(totalStrata),
      side: 'buy',
      color: '#7C3AED',
    },
    {
      label: 'Council & Water Rates',
      amount: Math.round(totalCouncil + totalWater),
      side: 'buy',
      color: '#0EA5E9',
    },
    {
      label: 'Home & Building Insurance',
      amount: Math.round(totalHomeInsurance),
      side: 'buy',
      color: '#14B8A6',
    },
    {
      label: 'Maintenance & Repairs',
      amount: Math.round(totalMaintenance),
      side: 'buy',
      color: '#64748B',
    },
  ];
  if (totalOffsetFees > 0) {
    costBreakdown.push({
      label: 'Offset Package Fees',
      amount: Math.round(totalOffsetFees),
      side: 'buy',
      color: '#A855F7',
    });
  }

  const insights: string[] = [];
  if (winner === 'buy') {
    insights.push(
      `Over ${horizonYears} years, buying leaves you $${Math.abs(netWealthDiffNominal).toLocaleString('en-AU')} ahead in nominal wealth ($${Math.abs(netWealthDiffReal).toLocaleString('en-AU')} in today's dollars).`,
    );
  } else if (winner === 'rent') {
    insights.push(
      `Over ${horizonYears} years, renting and investing the cashflow difference leaves you $${Math.abs(netWealthDiffNominal).toLocaleString('en-AU')} ahead ($${Math.abs(netWealthDiffReal).toLocaleString('en-AU')} in today's dollars).`,
    );
  } else {
    insights.push(
      `Over ${horizonYears} years, buying and renting/investing finish within $2,500 of each other — lifestyle preference and rate moves dominate.`,
    );
  }

  if (breakEvenYearNominal !== null) {
    insights.push(
      `Buying breaks even on net wealth in Year ${breakEvenYearNominal} (nominal)${breakEvenYearReal !== null ? ` and Year ${breakEvenYearReal} (inflation-adjusted real)` : ''}.`,
    );
  } else {
    insights.push(
      `Buying does not break even within ${horizonYears} years under ${input.capitalGrowthPct.toFixed(1)}% capital growth vs ${input.investmentReturnPct.toFixed(1)}% investment return.`,
    );
  }

  const totalRunningOwnership = Math.round(
    totalStrata + totalCouncil + totalWater + totalHomeInsurance + totalMaintenance,
  );
  insights.push(
    `Non-mortgage ownership costs (strata, council, water, insurance, maintenance) total $${totalRunningOwnership.toLocaleString('en-AU')} over ${horizonYears} years — $${Math.round(yearOneMonthlyRunningCosts).toLocaleString('en-AU')}/mo in Year 1.`,
  );

  if (hasOffsetActivity) {
    insights.push(
      `Mortgage offset savings ($${offsetInit.toLocaleString('en-AU')} start + $${Math.round(offsetMonthly).toLocaleString('en-AU')}/mo) cut mortgage interest by $${totalOffsetInterestSaved.toLocaleString('en-AU')} and are 100% tax-free (zero income tax, CGT, or HECS/MLS impact), equal to ${offsetTaxFreeEquivalentRatePct.toFixed(2)}% in a taxed HISA or ~${offsetTaxFreeEquivalentEtfRatePct.toFixed(2)}% pre-tax in ETFs/shares (renter given identical extra savings for fairness).`,
    );
  }

  if (hgsEligible && lvrPct > 80) {
    insights.push(
      `5% Home Guarantee Scheme eligibility saves ~$${estimateLmiForRentVsBuy(initialLoanAmount, lvrPct, false).toLocaleString('en-AU')} in LMI upfront.`,
    );
  }

  return {
    horizonYears,
    winner,
    winnerReal,
    initialCashRequired,
    depositAmount,
    stampDuty,
    lmiEstimate,
    buyingCostsFixed,
    initialLoanAmount,
    buyerNetWealthNominal,
    renterNetWealthNominal,
    netWealthDiffNominal,
    buyerNetWealthReal,
    renterNetWealthReal,
    netWealthDiffReal,
    breakEvenYearNominal,
    breakEvenYearReal,
    yearOneMonthlyRent,
    yearOneMonthlyMortgagePI,
    yearOneMonthlyMortgageInterest,
    yearOneMonthlyRunningCosts,
    yearOneMonthlyOwnTotal,
    totalRentPaid: Math.round(totalRentPaid),
    totalRentersInsurance: Math.round(totalRentersInsurance),
    totalRentUnrecoverable,
    totalMortgageInterest: Math.round(totalMortgageInterest),
    totalPrincipalRepaid: Math.round(totalPrincipalRepaid),
    totalStrata: Math.round(totalStrata),
    totalCouncil: Math.round(totalCouncil),
    totalWater: Math.round(totalWater),
    totalHomeInsurance: Math.round(totalHomeInsurance),
    totalMaintenance: Math.round(totalMaintenance),
    upfrontSunkCosts,
    estimatedSellingCosts,
    totalBuyUnrecoverable,
    offsetBalanceInitial: offsetInit,
    offsetMonthlyContribution: Math.round(offsetMonthly),
    finalOffsetBalance: Math.round(buyerOffsetBalance),
    totalOffsetInterestSaved,
    offsetTaxFreeEquivalentRatePct,
    offsetTaxFreeEquivalentEtfRatePct,
    costBreakdown,
    yearlySeries,
    insights,
  };
}
