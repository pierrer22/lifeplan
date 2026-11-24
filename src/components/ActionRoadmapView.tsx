import React, { useMemo, useState } from 'react';
import { ArrowRight, Filter } from 'lucide-react';
import { usePlanner } from '../context/PlannerContext';
import type { ActionHorizon, ActionStep, TabId } from '../types/planner';
import { Badge, SectionCard, formatAUD, type StatTone } from './SharedPrimitives';

type HorizonFilter = 'All' | ActionHorizon;
type CategoryFilter = 'All' | ActionStep['category'];

const HORIZONS: HorizonFilter[] = [
  'All',
  'Immediate',
  '1-12 Months',
  '1-3 Years',
  '3+ Years',
];

const CATEGORY_LABELS: Record<ActionStep['category'], string> = {
  tax: 'Tax & MLS',
  housing: 'Housing',
  super: 'Super & FHSSS',
  hecs: 'HECS-HELP',
  novated: 'Novated Lease',
  career: 'Career & Study',
  budget: 'Rent & Cashflow',
};

const CATEGORY_TO_TAB: Record<ActionStep['category'], TabId> = {
  tax: 'super',
  housing: 'housing',
  super: 'super',
  hecs: 'hecs',
  novated: 'novated',
  career: 'career',
  budget: 'rent',
};

const PRIORITY_STYLE: Record<
  ActionStep['priority'],
  { tone: StatTone; label: string }
> = {
  high: { tone: 'warning', label: 'High Priority' },
  medium: { tone: 'accent', label: 'Medium' },
  low: { tone: 'neutral', label: 'Optional' },
};

function resolveTargetTab(step: ActionStep): TabId {
  const maybeWithTab = step as ActionStep & { targetTab?: TabId };
  if (maybeWithTab.targetTab) return maybeWithTab.targetTab;
  return CATEGORY_TO_TAB[step.category];
}

export const ActionRoadmapView: React.FC = () => {
  const { lifePlan, setActiveTab } = usePlanner();
  const [horizon, setHorizon] = useState<HorizonFilter>('All');
  const [category, setCategory] = useState<CategoryFilter>('All');

  const availableCategories = useMemo(() => {
    const set = new Set(lifePlan.actionPlan.map((s) => s.category));
    return ['All', ...Array.from(set)] as CategoryFilter[];
  }, [lifePlan.actionPlan]);

  const filteredSteps = useMemo(() => {
    return lifePlan.actionPlan.filter((step) => {
      if (horizon !== 'All' && step.horizon !== horizon) return false;
      if (category !== 'All' && step.category !== category) return false;
      return true;
    });
  }, [lifePlan.actionPlan, horizon, category]);

  const totalAnnualImpact = useMemo(
    () =>
      filteredSteps.reduce(
        (sum, step) => sum + Math.max(0, step.estimatedAnnualImpactAud),
        0
      ),
    [filteredSteps]
  );

  return (
    <SectionCard
      title="Prioritized Action Roadmap"
      subtitle="Sequenced steps calibrated to your current profile, tax brackets, and housing timeline"
      action={
        <div className="flex items-center gap-2">
          <Badge tone="positive">
            {filteredSteps.length} action{filteredSteps.length === 1 ? '' : 's'}
          </Badge>
          {totalAnnualImpact > 0 ? (
            <Badge tone="accent">
              Up to {formatAUD(totalAnnualImpact)}/yr upside
            </Badge>
          ) : null}
        </div>
      }
    >
      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Filter className="h-3.5 w-3.5" />
            Horizon:
          </span>
          {HORIZONS.map((h) => {
            const active = horizon === h;
            return (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? 'bg-slate-900 dark:bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {h}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="roadmap-cat-filter"
            className="text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            Category:
          </label>
          <select
            id="roadmap-cat-filter"
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryFilter)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
          >
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'All Categories' : CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Cards */}
      {filteredSteps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No action items match the selected horizon and category filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSteps.map((step) => {
            const prio = PRIORITY_STYLE[step.priority];
            const targetTab = resolveTargetTab(step);
            return (
              <article
                key={step.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 p-4 transition hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800/80 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={prio.tone}>{prio.label}</Badge>
                    <Badge tone="neutral">{step.horizon}</Badge>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {CATEGORY_LABELS[step.category]}
                    </span>
                    {step.estimatedAnnualImpactAud > 0 ? (
                      <Badge tone="positive">
                        +{formatAUD(step.estimatedAnnualImpactAud)}/yr
                      </Badge>
                    ) : null}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {step.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {step.description}
                  </p>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab(targetTab)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 shadow-2xs transition hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                  >
                    Open Calculator
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
};
