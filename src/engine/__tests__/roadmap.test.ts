import { describe, expect, it } from 'vitest';
import { PRESET_PROFILES } from '../../data/presets';
import {
  analyzeCareerPathway,
  analyzeEducationRoi,
  generateLifePlan,
} from '../index';

describe('Education ROI Engine', () => {
  it('models postgrad-student CSP Masters vs Full-Fee and Austudy eligibility', () => {
    const grad = PRESET_PROFILES.find((p) => p.id === 'postgrad-student')!;
    const roi = analyzeEducationRoi(grad);

    expect(roi.austudyEligibleDuringStudy).toBe(true);
    expect(roi.annualStudyLivingIncome).toBe(18500);
    expect(roi.cspVsFullFeeSavings).toBeGreaterThan(25000);
    expect(roi.tuitionTotalAddedToHecs).toBeLessThan(35000);
    expect(roi.scenarios).toHaveLength(4);
    expect(roi.cumulativeEarningsSeries).toHaveLength(11);
    expect(roi.cumulativeEarningsSeries[0]).toEqual({
      year: 0,
      noStudyCumulative: 0,
      selectedStudyCumulative: 0,
      fullFeeAlternativeCumulative: 0,
    });

    const fullFeeRoi = analyzeEducationRoi(grad, { isCsp: false });
    expect(fullFeeRoi.tuitionTotalAddedToHecs).toBeGreaterThan(roi.tuitionTotalAddedToHecs);
    expect(fullFeeRoi.tenYearNetWealthDelta).toBeLessThan(roi.tenYearNetWealthDelta);
  });

  it('models no-study profiles cleanly with zero tuition and zero opportunity cost', () => {
    const sydneyRenter = PRESET_PROFILES.find((p) => p.id === 'sydney-renter')!;
    const roi = analyzeEducationRoi(sydneyRenter);

    expect(roi.tuitionTotalAddedToHecs).toBe(0);
    expect(roi.foregoneIncomeDuringStudy).toBe(0);
    expect(roi.tenYearNetWealthDelta).toBe(0);
    expect(roi.breakEvenYears).toBeNull();
  });

  it('models part-time study with lower opportunity cost than full-time', () => {
    const sydneyRenter = PRESET_PROFILES.find((p) => p.id === 'sydney-renter')!;
    const ft = analyzeEducationRoi(sydneyRenter, {
      targetQualification: 'masters',
      studyMode: 'full_time',
      durationYears: 2,
      partTimeStudyIncome: 25000,
    });
    const pt = analyzeEducationRoi(sydneyRenter, {
      targetQualification: 'masters',
      studyMode: 'part_time',
      durationYears: 4,
      partTimeStudyIncome: 85000,
    });

    expect(pt.foregoneIncomeDuringStudy).toBeLessThan(ft.foregoneIncomeDuringStudy);
  });

  it('models partTimeWorkFullTime with $0 foregone pay, annual raises, and CSP/SSAF breakdown', () => {
    const sydneyRenter = PRESET_PROFILES.find((p) => p.id === 'sydney-renter')!;
    const ptFullPay = analyzeEducationRoi(sydneyRenter, {
      targetQualification: 'masters',
      field: 'tech_data',
      isCsp: true,
      studyMode: 'part_time',
      durationYears: 4,
      partTimeWorkFullTime: true,
      annualStudentContributionOverride: 9537,
      includeSsaf: true,
    });
    const ptReduced = analyzeEducationRoi(sydneyRenter, {
      targetQualification: 'masters',
      field: 'tech_data',
      isCsp: true,
      studyMode: 'part_time',
      durationYears: 4,
      partTimeWorkFullTime: false,
      partTimeStudyIncome: 65000,
    });

    expect(ptFullPay.partTimeWorkFullTimeActive).toBe(true);
    expect(ptFullPay.foregoneIncomeDuringStudy).toBe(0);
    expect(ptFullPay.courseEftsl).toBe(2);
    expect(ptFullPay.studentContributionTotal).toBe(19074);
    expect(ptFullPay.ssafTotal).toBe(1120);
    expect(ptFullPay.tuitionTotalAddedToHecs).toBe(20194);
    expect(ptFullPay.tenYearNetWealthDelta).toBeGreaterThan(
      ptReduced.tenYearNetWealthDelta,
    );
  });
});

describe('Career Pathway Engine', () => {
  it('builds 4-stage salary ladder and computes Sydney vs Canberra net advantage', () => {
    const sydneyRenter = PRESET_PROFILES.find((p) => p.id === 'sydney-renter')!;
    const pathway = analyzeCareerPathway(sydneyRenter, 130000);

    expect(pathway.milestones).toHaveLength(4);
    expect(pathway.milestones.map((m) => m.stage)).toEqual([
      'entry',
      'mid',
      'senior',
      'lead',
    ]);
    expect(pathway.incomeGapToGoals).toBe(40000);
    expect(pathway.projectedYearsToRequiredIncome).not.toBeNull();
    expect(pathway.cityComparison.canberraMedianRentWeekly).toBeLessThan(
      pathway.cityComparison.sydneyMedianRentWeekly,
    );
    expect(pathway.cityComparison.netDisposableDeltaCanberraVsSydneyAnnual).toBeGreaterThan(
      0,
    );
    expect(pathway.notes.some((n) => n.includes('15.4%'))).toBe(true);
  });

  it('recognizes couple household income when assessing goal income gap', () => {
    const couplePreset = PRESET_PROFILES.find((p) => p.id === 'public-sector-couple')!;
    const pathway = analyzeCareerPathway(couplePreset, 180000);

    expect(pathway.incomeGapToGoals).toBe(0);
    expect(pathway.projectedYearsToRequiredIncome).toBe(0);
  });
});

describe('Integrated LifePlan Roadmap Engine', () => {
  it.each(PRESET_PROFILES.map((p) => [p.id, p] as const))(
    'generates complete finite LifePlanSummary for preset %s',
    (_id, profile) => {
      const plan = generateLifePlan(profile);

      expect(plan.readiness.overallScore).toBeGreaterThanOrEqual(0);
      expect(plan.readiness.overallScore).toBeLessThanOrEqual(100);
      expect(['On Track', 'Needs Adjustment', 'Stretch Goal']).toContain(
        plan.readiness.statusLabel,
      );

      expect(plan.netWorthProjection).toHaveLength(11);
      for (const pt of plan.netWorthProjection) {
        expect(Number.isFinite(pt.netWorth)).toBe(true);
        expect(Number.isFinite(pt.superBalance)).toBe(true);
        expect(Number.isFinite(pt.liquidAndInvestments)).toBe(true);
      }

      expect(plan.actionPlan.length).toBeGreaterThanOrEqual(4);
      const horizons = ['Immediate', '1-12 Months', '1-3 Years', '3+ Years'];
      for (const step of plan.actionPlan) {
        expect(horizons).toContain(step.horizon);
        expect(Number.isFinite(step.estimatedAnnualImpactAud)).toBe(true);
        expect(step.estimatedAnnualImpactAud).toBeGreaterThanOrEqual(0);
      }
    },
  );

  it('surfaces MLS warning for mid-career-ev without private cover and RFBA knock-on', () => {
    const midCareer = PRESET_PROFILES.find((p) => p.id === 'mid-career-ev')!;
    const plan = generateLifePlan(midCareer);

    expect(plan.tax.medicareLevySurcharge).toBeGreaterThan(0);
    expect(plan.novatedLease.enabled).toBe(true);
    expect(plan.novatedLease.rfbaAmount).toBeGreaterThan(0);
    expect(plan.actionPlan.some((a) => a.id === 'mls-hospital-cover')).toBe(true);
    expect(plan.actionPlan.some((a) => a.id === 'novated-rfba-knockon')).toBe(true);
  });

  it('computes partnerTax and $0 ACT FHB stamp duty for public-sector-couple preset', () => {
    const couplePreset = PRESET_PROFILES.find((p) => p.id === 'public-sector-couple')!;
    const plan = generateLifePlan(couplePreset);

    expect(plan.partnerTax).not.toBeNull();
    expect(plan.houseDeposit.stampDutyWithConcession).toBe(0);
    expect(plan.houseDeposit.stampDutySaved).toBeGreaterThan(20000);
    expect(plan.readiness.overallScore).toBeGreaterThan(65);
  });
});
