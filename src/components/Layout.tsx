import React, { useRef, useState } from 'react';
import {
  Briefcase,
  Car,
  Compass,
  Download,
  GraduationCap,
  Home,
  LayoutDashboard,
  Menu,
  Moon,
  PiggyBank,
  RotateCcw,
  Sun,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { PRESET_PROFILES } from '../data/presets';
import { usePlanner } from '../context/PlannerContext';
import type { TabId } from '../types/planner';
import { ProfileSidebar } from './ProfileSidebar';
import { Badge } from './SharedPrimitives';

interface NavTab {
  id: TabId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const TABS: NavTab[] = [
  { id: 'overview', label: 'Overview & Plan', Icon: LayoutDashboard },
  { id: 'housing', label: 'House Deposit', Icon: Home },
  { id: 'rent', label: 'Rent vs Save', Icon: Wallet },
  { id: 'super', label: 'Super & FHSSS', Icon: PiggyBank },
  { id: 'hecs', label: 'HECS-HELP', Icon: GraduationCap },
  { id: 'novated', label: 'Novated Lease', Icon: Car },
  { id: 'career', label: 'Career & Study', Icon: Briefcase },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    profile,
    loadPreset,
    resetProfile,
    exportProfileJson,
    importProfileJson,
    activeTab,
    setActiveTab,
    isDark,
    toggleTheme,
  } = usePlanner();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [importNotice, setImportNotice] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedPresetId = PRESET_PROFILES.some((p) => p.id === profile.id)
    ? profile.id
    : 'custom';

  const handleExport = () => {
    const json = exportProfileJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeplanner-${profile.id || 'profile'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const result = importProfileJson(text);
      if (result.ok) {
        setImportNotice({ tone: 'ok', text: `Imported "${file.name}"` });
      } else {
        setImportNotice({ tone: 'err', text: result.error ?? 'Import failed' });
      }
      window.setTimeout(() => setImportNotice(null), 4000);
    } catch {
      setImportNotice({ tone: 'err', text: 'Failed to read JSON file' });
      window.setTimeout(() => setImportNotice(null), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 transition-colors">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Toggle profile sidebar"
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                <Compass className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    LifePlanner
                  </span>
                  <Badge tone="accent">FY{profile.financialYear}</Badge>
                </div>
                <p className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:block">
                  Australian Financial, Housing &amp; Career Planner
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {importNotice ? (
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  importNotice.tone === 'ok'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                }`}
              >
                {importNotice.text}
              </span>
            ) : null}

            <div className="flex items-center gap-1.5">
              <label htmlFor="preset-select" className="sr-only">
                Load profile preset
              </label>
              <select
                id="preset-select"
                value={selectedPresetId}
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    loadPreset(e.target.value);
                  }
                }}
                className="max-w-[230px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 transition focus:border-blue-500 focus:outline-none"
              >
                {PRESET_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    Preset: {p.name}
                  </option>
                ))}
                {selectedPresetId === 'custom' ? (
                  <option value="custom">Custom Imported Profile</option>
                ) : null}
              </select>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={isDark}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-slate-600" />
              )}
              <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
            </button>

            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export JSON</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Import JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
            />

            <button
              type="button"
              onClick={resetProfile}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Horizontal 7-Tab Navigation */}
        <nav
          aria-label="Calculator sections"
          className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
        >
          <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 sm:px-6">
            {TABS.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap transition ${
                    active
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Content Shell */}
      <div className="mx-auto flex max-w-[1440px] items-start gap-6 px-4 py-6 sm:px-6">
        {/* Desktop Sticky Sidebar */}
        <div className="hidden w-80 shrink-0 lg:block xl:w-[340px]">
          <div className="sticky top-[112px] max-h-[calc(100vh-132px)] overflow-y-auto pr-0.5">
            <ProfileSidebar />
          </div>
        </div>

        {/* Mobile Drawer Sidebar */}
        {mobileSidebarOpen ? (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-[1px]"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative z-10 flex h-full w-full max-w-sm flex-col bg-[#F8FAFC] dark:bg-slate-950 p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Profile Settings
                </span>
                <button
                  type="button"
                  aria-label="Close sidebar"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-600 dark:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ProfileSidebar />
              </div>
            </div>
          </div>
        ) : null}

        {/* Active View */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Educational Disclaimer Footer */}
      <footer className="mt-8 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-2 px-4 py-4 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:px-6">
          <p>
            Educational modelling based on ATO FY2026-27 &amp; FY2025-26 tax brackets,
            marginal HECS-HELP thresholds, Super/FHSSS caps, and state FHB duty rules.
          </p>
          <p className="shrink-0 font-medium text-slate-600 dark:text-slate-300">
            General information only — not personal financial or tax advice.
          </p>
        </div>
      </footer>
    </div>
  );
};
