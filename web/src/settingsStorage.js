/**
 * Settings storage — localStorage keys + reader helpers for PR #3.
 * Component code lives in `SettingsPage.jsx`; this module is the
 * non-component half so `react-refresh/only-export-components` is happy.
 */

/** Mirrors `dashboardView` IDs in App.jsx — keep these in sync. */
export const DEFAULT_TAB_OPTIONS = /** @type {const} */ ([
  { id: 'teamSelection', label: 'Moves' },
  { id: 'fplLive',       label: 'FPL Live' },
  { id: 'standings',     label: 'Standings' },
  { id: 'players',       label: 'Players' },
])

export const DEFAULT_TAB_STORAGE_KEY = 'tclot:settings:default-tab'
/* Season-open cold load is Moves/Draft (see seasonOpenLanding.js), not this
 * stored pref. The pref still drives Settings and post-waivers visits.
 * Stored `'preseason'` prefs are treated as missing so they don't resurrect
 * the hub. */
export const DEFAULT_TAB_FALLBACK = 'teamSelection'

const VALID_TAB_IDS = new Set(DEFAULT_TAB_OPTIONS.map((o) => o.id))

/** Read & validate the stored default-tab pref. Returns fallback on miss/garbage. */
export function readStoredDefaultTab() {
  if (typeof window === 'undefined') return DEFAULT_TAB_FALLBACK
  try {
    const stored = window.localStorage.getItem(DEFAULT_TAB_STORAGE_KEY)
    if (stored === 'preseason') return DEFAULT_TAB_FALLBACK
    if (stored && VALID_TAB_IDS.has(stored)) return stored
  } catch { /* ignore */ }
  return DEFAULT_TAB_FALLBACK
}
