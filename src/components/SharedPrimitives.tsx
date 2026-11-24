import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';

export function formatAUD(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '$0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}$${formatted}`;
}

export function formatPercent(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return `${(0).toFixed(decimals)}%`;
  return `${n.toFixed(decimals)}%`;
}

export function formatMonths(months: number): string {
  if (!Number.isFinite(months) || months <= 0) return '0 mos';
  if (months < 12) return `${Math.round(months)} mos`;
  const yrs = Math.floor(months / 12);
  const rem = Math.round(months % 12);
  if (rem === 0) return `${yrs} yr${yrs === 1 ? '' : 's'}`;
  if (rem === 12) return `${yrs + 1} yrs`;
  return `${yrs}y ${rem}m`;
}

export const CHART_STYLES = {
  gridStroke: 'var(--chart-grid)',
  axisTick: { fill: 'var(--chart-axis)', fontSize: 11 },
  axisLine: { stroke: 'var(--chart-grid)' },
  tooltipContentStyle: {
    backgroundColor: 'var(--chart-tooltip-bg)',
    borderColor: 'var(--chart-tooltip-border)',
    color: 'var(--chart-tooltip-text)',
    borderRadius: '0.5rem',
    fontSize: '12px',
  },
  tooltipItemStyle: { color: 'var(--chart-tooltip-text)' },
  tooltipLabelStyle: { color: 'var(--chart-tooltip-text)', fontWeight: 600 },
} as const;

export const ChartSwatchLegend: React.FC<{
  items: ReadonlyArray<{ label: string; color: string }>;
}> = ({ items }) => (
  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-2 text-[11px] text-slate-600 dark:text-slate-300">
    {items.map((item) => (
      <span key={item.label} className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
          style={{ backgroundColor: item.color }}
        />
        <span>{item.label}</span>
      </span>
    ))}
  </div>
);

export type StatTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'accent';

const STAT_TONE_STYLES: Record<
  StatTone,
  { border: string; valueText: string; dot: string; bg: string }
> = {
  neutral: {
    border: 'border-slate-200 dark:border-slate-800',
    valueText: 'text-slate-900 dark:text-slate-100',
    dot: 'bg-slate-400 dark:bg-slate-500',
    bg: 'bg-white dark:bg-slate-900',
  },
  positive: {
    border: 'border-emerald-200/80 dark:border-emerald-800/60',
    valueText: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    bg: 'bg-white dark:bg-slate-900',
  },
  warning: {
    border: 'border-amber-200/80 dark:border-amber-800/60',
    valueText: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
    bg: 'bg-white dark:bg-slate-900',
  },
  danger: {
    border: 'border-rose-200/80 dark:border-rose-800/60',
    valueText: 'text-rose-700 dark:text-rose-400',
    dot: 'bg-rose-500',
    bg: 'bg-white dark:bg-slate-900',
  },
  accent: {
    border: 'border-blue-200/80 dark:border-blue-800/60',
    valueText: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-600 dark:bg-blue-500',
    bg: 'bg-white dark:bg-slate-900',
  },
};

export interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  tone?: StatTone;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  tone = 'neutral',
}) => {
  const style = STAT_TONE_STYLES[tone];
  return (
    <div
      className={`rounded-xl border ${style.border} ${style.bg} p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none transition-colors`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
        <span className="text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400 uppercase">
          {label}
        </span>
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${style.valueText}`}
      >
        {value}
      </div>
      {subtext ? (
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{subtext}</p>
      ) : null}
    </div>
  );
};

export interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  action,
  children,
}) => {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
};

export type AlertTone = 'info' | 'warning' | 'success' | 'danger';

const ALERT_TONE_STYLES: Record<
  AlertTone,
  { container: string; title: string; iconColor: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  info: {
    container: 'border-blue-200 bg-blue-50/70 text-slate-700 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-slate-300',
    title: 'text-blue-900 dark:text-blue-300',
    iconColor: 'text-blue-600 dark:text-blue-400',
    Icon: Info,
  },
  warning: {
    container: 'border-amber-200 bg-amber-50/80 text-slate-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-slate-300',
    title: 'text-amber-900 dark:text-amber-300',
    iconColor: 'text-amber-600 dark:text-amber-400',
    Icon: AlertTriangle,
  },
  success: {
    container: 'border-emerald-200 bg-emerald-50/70 text-slate-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-slate-300',
    title: 'text-emerald-900 dark:text-emerald-300',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
  danger: {
    container: 'border-rose-200 bg-rose-50/80 text-slate-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-slate-300',
    title: 'text-rose-900 dark:text-rose-300',
    iconColor: 'text-rose-600 dark:text-rose-400',
    Icon: AlertCircle,
  },
};

export interface AlertBannerProps {
  tone: AlertTone;
  title: string;
  children: React.ReactNode;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  tone,
  title,
  children,
}) => {
  const cfg = ALERT_TONE_STYLES[tone];
  const Icon = cfg.Icon;
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${cfg.container}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.iconColor}`} />
      <div className="min-w-0 flex-1">
        <div className={`font-semibold ${cfg.title}`}>{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          {children}
        </div>
      </div>
    </div>
  );
};

export interface BadgeProps {
  tone?: StatTone;
  children: React.ReactNode;
}

const BADGE_CLASSES: Record<StatTone, string> = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300',
  danger: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-300',
  accent: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/60 dark:bg-blue-950/50 dark:text-blue-300',
};

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', children }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums ${BADGE_CLASSES[tone]}`}
  >
    {children}
  </span>
);

export interface CurrencyInputProps {
  id?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 500,
  suffix,
  hint,
}) => {
  const inputId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        {hint ? <span className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</span> : null}
      </div>
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 text-xs font-medium text-slate-400 dark:text-slate-500">
          $
        </span>
        <input
          id={inputId}
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const parsed = e.target.value === '' ? 0 : Number(e.target.value);
            if (!Number.isFinite(parsed)) return;
            const clampedMin = Math.max(min, parsed);
            onChange(max !== undefined ? Math.min(max, clampedMin) : clampedMin);
          }}
          className={`w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 ${suffix ? 'pr-12' : 'pr-3'} pl-6 text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none`}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 text-xs text-slate-400 dark:text-slate-500">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export interface SliderFieldProps {
  id?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  formatValue?: (val: number) => string;
}

export const SliderField: React.FC<SliderFieldProps> = ({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  formatValue,
}) => {
  const inputId = id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-slate-700 accent-blue-600 dark:accent-blue-500"
      />
    </div>
  );
};
