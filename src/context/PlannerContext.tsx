import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_PROFILE, PRESET_PROFILES } from '../data/presets';
import { generateLifePlan } from '../engine';
import type { LifePlanSummary, PlannerProfile, TabId } from '../types/planner';

const STORAGE_KEY = 'lifeplanner_profile_v2';
const THEME_STORAGE_KEY = 'lifeplanner_theme_v1';

export type ThemeMode = 'light' | 'dark';

export interface PlannerContextValue {
  profile: PlannerProfile;
  setProfile: React.Dispatch<React.SetStateAction<PlannerProfile>>;
  patchProfile: (patch: Partial<PlannerProfile>) => void;
  loadPreset: (presetId: string) => void;
  resetProfile: () => void;
  exportProfileJson: () => string;
  importProfileJson: (json: string) => { ok: boolean; error?: string };
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  lifePlan: LifePlanSummary;
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

function cloneProfile(p: PlannerProfile): PlannerProfile {
  return {
    ...p,
    studyPlan: { ...p.studyPlan },
    novatedLease: { ...p.novatedLease },
  };
}

function hydrateProfile(raw: unknown): PlannerProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<PlannerProfile>;
  if (typeof candidate.grossSalary !== 'number' || typeof candidate.state !== 'string') {
    return null;
  }
  const base = cloneProfile(DEFAULT_PROFILE);
  return {
    ...base,
    ...candidate,
    studyPlan: {
      ...base.studyPlan,
      ...(candidate.studyPlan && typeof candidate.studyPlan === 'object'
        ? candidate.studyPlan
        : {}),
    },
    novatedLease: {
      ...base.novatedLease,
      ...(candidate.novatedLease && typeof candidate.novatedLease === 'object'
        ? candidate.novatedLease
        : {}),
    },
  };
}

function loadInitialProfile(): PlannerProfile {
  if (typeof window === 'undefined') return cloneProfile(DEFAULT_PROFILE);
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return cloneProfile(DEFAULT_PROFILE);
    const parsed: unknown = JSON.parse(stored);
    return hydrateProfile(parsed) ?? cloneProfile(DEFAULT_PROFILE);
  } catch {
    return cloneProfile(DEFAULT_PROFILE);
  }
}

function loadInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export const PlannerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [profile, setProfile] = useState<PlannerProfile>(loadInitialProfile);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [theme, setTheme] = useState<ThemeMode>(loadInitialTheme);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage quota or private-mode errors
    }
  }, [profile]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage quota or private-mode errors
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const patchProfile = useCallback((patch: Partial<PlannerProfile>) => {
    setProfile((prev) => ({
      ...prev,
      ...patch,
      studyPlan: patch.studyPlan
        ? { ...prev.studyPlan, ...patch.studyPlan }
        : prev.studyPlan,
      novatedLease: patch.novatedLease
        ? { ...prev.novatedLease, ...patch.novatedLease }
        : prev.novatedLease,
    }));
  }, []);

  const loadPreset = useCallback((presetId: string) => {
    const found = PRESET_PROFILES.find((p) => p.id === presetId);
    if (found) {
      setProfile(cloneProfile(found));
    }
  }, []);

  const resetProfile = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setProfile(cloneProfile(DEFAULT_PROFILE));
  }, []);

  const exportProfileJson = useCallback(() => {
    return JSON.stringify(profile, null, 2);
  }, [profile]);

  const importProfileJson = useCallback(
    (json: string): { ok: boolean; error?: string } => {
      try {
        const parsed: unknown = JSON.parse(json);
        const hydrated = hydrateProfile(parsed);
        if (!hydrated) {
          return {
            ok: false,
            error: 'Invalid profile JSON: missing required fields (grossSalary, state).',
          };
        }
        setProfile(hydrated);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Unable to parse JSON.',
        };
      }
    },
    []
  );

  const lifePlan = useMemo(() => generateLifePlan(profile), [profile]);

  const isDark = theme === 'dark';

  const value = useMemo<PlannerContextValue>(
    () => ({
      profile,
      setProfile,
      patchProfile,
      loadPreset,
      resetProfile,
      exportProfileJson,
      importProfileJson,
      activeTab,
      setActiveTab,
      lifePlan,
      theme,
      isDark,
      setTheme,
      toggleTheme,
    }),
    [
      profile,
      patchProfile,
      loadPreset,
      resetProfile,
      exportProfileJson,
      importProfileJson,
      activeTab,
      lifePlan,
      theme,
      isDark,
      toggleTheme,
    ]
  );

  return (
    <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
  );
};

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) {
    throw new Error('usePlanner must be used within a PlannerProvider');
  }
  return ctx;
}
