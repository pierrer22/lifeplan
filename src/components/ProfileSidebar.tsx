import React, { useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import {
  INDUSTRY_FIELD_LABELS,
  QUALIFICATION_LABELS,
} from '../data/auConstants';
import { usePlanner } from '../context/PlannerContext';
import type {
  AuState,
  DepositStrategy,
  EmploymentStatus,
  FinancialYear,
  IndustryField,
  QualificationLevel,
} from '../types/planner';
import { CurrencyInput, formatAUD } from './SharedPrimitives';

type SectionKey = 'household' | 'income' | 'savings' | 'education' | 'housing';

const AU_STATES: AuState[] = ['NSW', 'ACT', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT'];

const CITY_PRESETS: Record<AuState, string> = {
  NSW: 'Sydney',
  ACT: 'Canberra',
  VIC: 'Melbourne',
  QLD: 'Brisbane',
  WA: 'Perth',
  SA: 'Adelaide',
  TAS: 'Hobart',
  NT: 'Darwin',
};

interface AccordionSectionProps {
  title: string;
  summary: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  summary,
  isOpen,
  onToggle,
  children,
}) => (
  <div className="border-b border-slate-200 dark:border-slate-800 last:border-b-0">
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/70"
    >
      <div className="min-w-0">
        <div className="text-xs font-semibold tracking-wide text-slate-800 dark:text-slate-200 uppercase">
          {title}
        </div>
        <div className="truncate text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          {summary}
        </div>
      </div>
      <ChevronDown
        className={`h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform ${
          isOpen ? 'rotate-180' : ''
        }`}
      />
    </button>
    {isOpen ? <div className="space-y-3 bg-slate-50/40 dark:bg-slate-800/40 px-4 pt-1 pb-4">{children}</div> : null}
  </div>
);

interface NumberInputProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

const NumberInput: React.FC<NumberInputProps> = ({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 0.5,
  suffix,
}) => (
  <div className="space-y-1">
    <label htmlFor={id} className="block text-xs font-medium text-slate-700 dark:text-slate-300">
      {label}
    </label>
    <div className="relative flex items-center">
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const parsed = e.target.value === '' ? 0 : Number(e.target.value);
          if (!Number.isFinite(parsed)) return;
          const clamped = Math.max(min, parsed);
          onChange(max !== undefined ? Math.min(max, clamped) : clamped);
        }}
        className={`w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 ${suffix ? (suffix.length > 1 ? 'pr-12' : 'pr-9') : 'pr-3'} pl-3 text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none`}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3 text-xs text-slate-400 dark:text-slate-500">
          {suffix}
        </span>
      ) : null}
    </div>
  </div>
);

const selectClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none';

export const ProfileSidebar: React.FC = () => {
  const { profile, patchProfile, resetProfile } = usePlanner();
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    household: true,
    income: true,
    savings: false,
    education: false,
    housing: false,
  });

  const toggle = (key: SectionKey) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const liquidTotal = profile.currentCashSavings + profile.currentInvestments;
  const householdIncome =
    profile.grossSalary +
    (profile.relationshipStatus === 'couple' ? profile.partnerGrossSalary : 0);

  return (
    <aside className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Your Profile</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Live assumptions across all calculators</p>
        </div>
        <button
          type="button"
          onClick={resetProfile}
          title="Reset to default profile"
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div>
        {/* 1. Household & Location */}
        <AccordionSection
          title="Household & Location"
          summary={`${profile.state} · ${profile.cityLabel} · ${
            profile.relationshipStatus === 'couple' ? 'Couple' : 'Single'
          }, age ${profile.age}`}
          isOpen={openSections.household}
          onToggle={() => toggle('household')}
        >
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label htmlFor="sb-fy" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Financial Year
              </label>
              <select
                id="sb-fy"
                value={profile.financialYear}
                onChange={(e) =>
                  patchProfile({ financialYear: e.target.value as FinancialYear })
                }
                className={selectClass}
              >
                <option value="2026-27">FY 2026-27</option>
                <option value="2025-26">FY 2025-26</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="sb-state" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                State / Territory
              </label>
              <select
                id="sb-state"
                value={profile.state}
                onChange={(e) => {
                  const nextState = e.target.value as AuState;
                  patchProfile({
                    state: nextState,
                    cityLabel: CITY_PRESETS[nextState],
                  });
                }}
                className={selectClass}
              >
                {AU_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label htmlFor="sb-city" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                City / Region
              </label>
              <input
                id="sb-city"
                type="text"
                value={profile.cityLabel}
                onChange={(e) => patchProfile({ cityLabel: e.target.value })}
                className={selectClass}
              />
            </div>

            <NumberInput
              id="sb-age"
              label="Age"
              value={profile.age}
              min={18}
              max={75}
              step={1}
              suffix="yrs"
              onChange={(age) => patchProfile({ age })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label htmlFor="sb-rel" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Household
              </label>
              <select
                id="sb-rel"
                value={profile.relationshipStatus}
                onChange={(e) =>
                  patchProfile({
                    relationshipStatus: e.target.value as 'single' | 'couple',
                  })
                }
                className={selectClass}
              >
                <option value="single">Single</option>
                <option value="couple">Couple</option>
              </select>
            </div>

            <NumberInput
              id="sb-deps"
              label="Dependents"
              value={profile.dependents}
              min={0}
              max={8}
              step={1}
              onChange={(dependents) => patchProfile({ dependents })}
            />
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Private Hospital Cover (MLS exempt)
            </span>
            <input
              type="checkbox"
              checked={profile.hasPrivateHospitalCover}
              onChange={(e) =>
                patchProfile({ hasPrivateHospitalCover: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </label>
        </AccordionSection>

        {/* 2. Income & Super */}
        <AccordionSection
          title="Income & Super"
          summary={`${formatAUD(householdIncome)}/yr · ${profile.superRatePct}% super`}
          isOpen={openSections.income}
          onToggle={() => toggle('income')}
        >
          <div className="space-y-1">
            <label htmlFor="sb-emp" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Employment Status
            </label>
            <select
              id="sb-emp"
              value={profile.employmentStatus}
              onChange={(e) =>
                patchProfile({
                  employmentStatus: e.target.value as EmploymentStatus,
                })
              }
              className={selectClass}
            >
              <option value="full_time">Full-Time</option>
              <option value="part_time">Part-Time</option>
              <option value="studying_austudy">Studying / Austudy</option>
              <option value="casual">Casual</option>
            </select>
          </div>

          <CurrencyInput
            id="sb-salary"
            label="Your Gross Salary"
            value={profile.grossSalary}
            step={1000}
            suffix="/yr"
            onChange={(grossSalary) => patchProfile({ grossSalary })}
          />

          {profile.relationshipStatus === 'couple' ? (
            <CurrencyInput
              id="sb-partner-salary"
              label="Partner Gross Salary"
              value={profile.partnerGrossSalary}
              step={1000}
              suffix="/yr"
              onChange={(partnerGrossSalary) => patchProfile({ partnerGrossSalary })}
            />
          ) : null}

          <div className="grid grid-cols-2 gap-2.5">
            <NumberInput
              id="sb-growth"
              label="Salary Growth"
              value={profile.salaryGrowthPct}
              min={0}
              max={15}
              step={0.5}
              suffix="%"
              onChange={(salaryGrowthPct) => patchProfile({ salaryGrowthPct })}
            />
            <NumberInput
              id="sb-sgrate"
              label="Super Rate"
              value={profile.superRatePct}
              min={0}
              max={25}
              step={0.2}
              suffix="%"
              onChange={(superRatePct) => patchProfile({ superRatePct })}
            />
          </div>

          <CurrencyInput
            id="sb-super-bal"
            label="Current Super Balance"
            value={profile.currentSuperBalance}
            step={1000}
            onChange={(currentSuperBalance) => patchProfile({ currentSuperBalance })}
          />

          <CurrencyInput
            id="sb-sal-sac"
            label="Salary Sacrifice to Super"
            value={profile.salarySacrificeAnnual}
            step={500}
            suffix="/yr"
            onChange={(salarySacrificeAnnual) =>
              patchProfile({ salarySacrificeAnnual })
            }
          />

          <CurrencyInput
            id="sb-carry-fwd"
            label="Carry-Forward Unused Cap"
            value={profile.carryForwardUnusedCap}
            step={1000}
            onChange={(carryForwardUnusedCap) =>
              patchProfile({ carryForwardUnusedCap })
            }
          />
        </AccordionSection>

        {/* 3. Savings & Rent */}
        <AccordionSection
          title="Savings & Rent"
          summary={`${formatAUD(liquidTotal)} liquid · ${formatAUD(profile.currentWeeklyRent)}/wk rent`}
          isOpen={openSections.savings}
          onToggle={() => toggle('savings')}
        >
          <CurrencyInput
            id="sb-cash"
            label="Cash Savings (HISA)"
            value={profile.currentCashSavings}
            step={1000}
            onChange={(currentCashSavings) => patchProfile({ currentCashSavings })}
          />

          <CurrencyInput
            id="sb-invest"
            label="Stocks / ETFs"
            value={profile.currentInvestments}
            step={1000}
            onChange={(currentInvestments) => patchProfile({ currentInvestments })}
          />

          <NumberInput
            id="sb-return"
            label="Expected Return (p.a.)"
            value={profile.investmentReturnPct}
            min={0}
            max={15}
            step={0.5}
            suffix="%"
            onChange={(investmentReturnPct) => patchProfile({ investmentReturnPct })}
          />

          <CurrencyInput
            id="sb-rent"
            label="Current Weekly Rent"
            value={profile.currentWeeklyRent}
            step={10}
            suffix="/wk"
            onChange={(currentWeeklyRent) => patchProfile({ currentWeeklyRent })}
          />

          <CurrencyInput
            id="sb-living"
            label="Living Expenses (excl. rent)"
            value={profile.currentMonthlyLivingExpenses}
            step={50}
            suffix="/mo"
            onChange={(currentMonthlyLivingExpenses) =>
              patchProfile({ currentMonthlyLivingExpenses })
            }
          />
        </AccordionSection>

        {/* 4. Education & HECS */}
        <AccordionSection
          title="Education & HECS"
          summary={`${formatAUD(profile.hecsBalance)} HECS · ${
            profile.studyPlan.studyMode === 'none' ? 'No study' : profile.studyPlan.studyMode
          }`}
          isOpen={openSections.education}
          onToggle={() => toggle('education')}
        >
          <CurrencyInput
            id="sb-hecs"
            label="HECS-HELP Balance"
            value={profile.hecsBalance}
            step={1000}
            onChange={(hecsBalance) => patchProfile({ hecsBalance })}
          />

          <CurrencyInput
            id="sb-hecs-extra"
            label="Voluntary Extra HECS"
            value={profile.hecsVoluntaryExtraAnnual}
            step={500}
            suffix="/yr"
            onChange={(hecsVoluntaryExtraAnnual) =>
              patchProfile({ hecsVoluntaryExtraAnnual })
            }
          />

          <div className="space-y-1">
            <label htmlFor="sb-cur-qual" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Current Qualification
            </label>
            <select
              id="sb-cur-qual"
              value={profile.currentQualification}
              onChange={(e) =>
                patchProfile({
                  currentQualification: e.target.value as QualificationLevel,
                })
              }
              className={selectClass}
            >
              {Object.entries(QUALIFICATION_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="sb-cur-field" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Industry Field
            </label>
            <select
              id="sb-cur-field"
              value={profile.currentField}
              onChange={(e) =>
                patchProfile({ currentField: e.target.value as IndustryField })
              }
              className={selectClass}
            >
              {Object.entries(INDUSTRY_FIELD_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="sb-study-mode" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Planned Study Mode
            </label>
            <select
              id="sb-study-mode"
              value={profile.studyPlan.studyMode}
              onChange={(e) =>
                patchProfile({
                  studyPlan: {
                    ...profile.studyPlan,
                    studyMode: e.target.value as 'full_time' | 'part_time' | 'none',
                  },
                })
              }
              className={selectClass}
            >
              <option value="none">No Further Study</option>
              <option value="full_time">Full-Time Study</option>
              <option value="part_time">Part-Time Study</option>
            </select>
          </div>

          {profile.studyPlan.studyMode !== 'none' ? (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="sb-tgt-qual" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Target Degree
                  </label>
                  <select
                    id="sb-tgt-qual"
                    value={profile.studyPlan.targetQualification}
                    onChange={(e) =>
                      patchProfile({
                        studyPlan: {
                          ...profile.studyPlan,
                          targetQualification: e.target.value as QualificationLevel,
                        },
                      })
                    }
                    className={selectClass}
                  >
                    {Object.entries(QUALIFICATION_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <NumberInput
                  id="sb-study-dur"
                  label="Duration"
                  value={profile.studyPlan.durationYears}
                  min={0.5}
                  max={6}
                  step={0.5}
                  suffix="yrs"
                  onChange={(durationYears) =>
                    patchProfile({
                      studyPlan: { ...profile.studyPlan, durationYears },
                    })
                  }
                />
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Commonwealth Supported Place (CSP)
                </span>
                <input
                  type="checkbox"
                  checked={profile.studyPlan.isCsp}
                  onChange={(e) =>
                    patchProfile({
                      studyPlan: { ...profile.studyPlan, isCsp: e.target.checked },
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <CurrencyInput
                id="sb-study-inc"
                label="Income During Study"
                value={profile.studyPlan.partTimeStudyIncome}
                step={1000}
                suffix="/yr"
                onChange={(partTimeStudyIncome) =>
                  patchProfile({
                    studyPlan: { ...profile.studyPlan, partTimeStudyIncome },
                  })
                }
              />
            </>
          ) : null}
        </AccordionSection>

        {/* 5. Housing & Lease Goals */}
        <AccordionSection
          title="Housing & Lease Goals"
          summary={`${formatAUD(profile.targetPropertyPrice)} · ${profile.targetHomeYears}yr target`}
          isOpen={openSections.housing}
          onToggle={() => toggle('housing')}
        >
          <CurrencyInput
            id="sb-prop-price"
            label="Target Property Price"
            value={profile.targetPropertyPrice}
            step={10000}
            onChange={(targetPropertyPrice) =>
              patchProfile({ targetPropertyPrice })
            }
          />

          <div className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2">
              <input
                type="checkbox"
                checked={profile.isFirstHomeBuyer}
                onChange={(e) =>
                  patchProfile({ isFirstHomeBuyer: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">First Home</span>
            </label>

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2">
              <input
                type="checkbox"
                checked={profile.isNewHome}
                onChange={(e) => patchProfile({ isNewHome: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">New Build</span>
            </label>
          </div>

          <div className="space-y-1">
            <label htmlFor="sb-dep-strat" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Deposit Strategy
            </label>
            <select
              id="sb-dep-strat"
              value={profile.depositStrategy}
              onChange={(e) =>
                patchProfile({
                  depositStrategy: e.target.value as DepositStrategy,
                })
              }
              className={selectClass}
            >
              <option value="5_hgs">5% Deposit (HGS, $0 LMI)</option>
              <option value="10_lmi">10% Deposit (+ LMI)</option>
              <option value="20_no_lmi">20% Deposit ($0 LMI)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <NumberInput
              id="sb-home-yrs"
              label="Target Timeline"
              value={profile.targetHomeYears}
              min={1}
              max={15}
              step={1}
              suffix="yrs"
              onChange={(targetHomeYears) => patchProfile({ targetHomeYears })}
            />
            <NumberInput
              id="sb-mort-rate"
              label="Mortgage Rate"
              value={profile.targetMortgageRatePct}
              min={2}
              max={12}
              step={0.1}
              suffix="%"
              onChange={(targetMortgageRatePct) =>
                patchProfile({ targetMortgageRatePct })
              }
            />
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Include Novated Lease
            </span>
            <input
              type="checkbox"
              checked={profile.novatedLease.enabled}
              onChange={(e) =>
                patchProfile({
                  novatedLease: {
                    ...profile.novatedLease,
                    enabled: e.target.checked,
                  },
                })
              }
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          {profile.novatedLease.enabled ? (
            <div className="space-y-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 p-2.5">
              <CurrencyInput
                id="sb-car-price"
                label="Vehicle Price (inc. GST)"
                value={profile.novatedLease.vehiclePrice}
                step={1000}
                onChange={(vehiclePrice) =>
                  patchProfile({
                    novatedLease: { ...profile.novatedLease, vehiclePrice },
                  })
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={profile.novatedLease.isEv}
                    onChange={(e) =>
                      patchProfile({
                        novatedLease: {
                          ...profile.novatedLease,
                          isEv: e.target.checked,
                        },
                      })
                    }
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">EV (FBT Exempt)</span>
                </label>

                <select
                  aria-label="Lease term years"
                  value={profile.novatedLease.leaseTermYears}
                  onChange={(e) =>
                    patchProfile({
                      novatedLease: {
                        ...profile.novatedLease,
                        leaseTermYears: Number(e.target.value) as 1 | 2 | 3 | 4 | 5,
                      },
                    })
                  }
                  className={selectClass}
                >
                  {[1, 2, 3, 4, 5].map((y) => (
                    <option key={y} value={y}>
                      {y} yr term
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </AccordionSection>
      </div>
    </aside>
  );
};
