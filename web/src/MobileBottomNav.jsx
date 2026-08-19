/**
 * Mobile bottom nav — persistent tab bar (design option 5e).
 *
 * Replaces the previous corner FAB "speed dial" on mobile (≤1080px) with a
 * frosted, full-width tab bar pinned to the bottom edge. Five slots, in order:
 *
 *   Table (standings) · Moves (teamSelection) · [CENTER] · Players · More
 *
 * The CENTER slot is an inline circle (never raised — nothing pokes above the
 * bar) and is the "what matters now" hero. It is contextual on the season
 * phase, derived from the shared brand-header status (`deriveBrandHeaderStatus`,
 * passed in as `liveStatus`):
 *
 *   - PRESEASON (status 'pre-season' / 'unknown'): label "Preview" with a
 *     muted mono "GW{next}" chip. Routes to FPL Live landing on the Season
 *     Predictions sub-tab.
 *   - LIVE GW (status 'live' — deadline passed, GW not finished): a solid
 *     green Geist Mono "LIVE" chip with a subtly blinking tick (option D of
 *     the scorestab mockup sheet); label "Live" (accent). Routes to FPL Live
 *     landing on Scores.
 *   - GW OVER (status 'idle' — current GW finalized, between GWs): a muted
 *     mono "FT GW{n}" chip (option E of the sheet), where {n} is
 *     `liveStatus.lastFinishedGw` — the same field the brand header's
 *     "GW {n} complete" strip uses. Falls back to a bare "FT" when the GW
 *     number is unavailable. No pulse; label "Preview" (muted). Routes to
 *     FPL Live landing on the weekly Recap.
 *
 * Heritage ('hall') and Settings ('settings') live behind More (the existing
 * `'more'` dashboardView page / DashboardMorePanel).
 *
 * Visuals are scoped to the `.mobile-tab-bar` class prefix (see
 * `MobileBottomNav.css`). Desktop (≥1081px) hides the whole thing and uses the
 * top `<DashboardNav variant="top" />`.
 */

import { NavIcon } from './NavIcon'
import './MobileBottomNav.css'

/**
 * Collapse the shared brand-header status into the three nav centre states.
 * `'pre-season'` and `'unknown'` (and any missing status) fall back to the
 * Live tab so fixtures are reachable before the first kickoff.
 *
 * @param {'live' | 'idle' | 'pre-season' | 'unknown' | undefined | null} status
 * @returns {'pre' | 'live' | 'over'}
 */
function gwStateFromStatus(status) {
  if (status === 'live') return 'live'
  if (status === 'idle') return 'over'
  return 'pre'
}

const TABS = [
  { id: /** @type {const} */ ('standings'),     label: 'Table',   icon: /** @type {const} */ ('bar-chart-3') },
  { id: /** @type {const} */ ('teamSelection'), label: 'Moves',   icon: /** @type {const} */ ('users') },
  { id: /** @type {const} */ ('players'),       label: 'Players', icon: /** @type {const} */ ('shuffle') },
]

/** Per-phase copy + routing for the contextual centre slot. `tab` is the
 * FPL Live sub-tab the button lands on: Scores mid-GW, the weekly Recap
 * between GWs, and Season Predictions before the campaign starts. */
const CENTER_BY_STATE = {
  pre:  { label: 'Preview', view: /** @type {const} */ ('fplLive'), tab: 'predictions', aria: 'Season predictions' },
  live: { label: 'Live',    view: /** @type {const} */ ('fplLive'), tab: 'live',        aria: 'FPL Live scores' },
  over: { label: 'Preview', view: /** @type {const} */ ('fplLive'), tab: 'recap',       aria: 'Weekly recap and season predictions' },
}

/**
 * @param {{
 *   dashboardView: string,
 *   onSelect: (id: string) => void,
 *   onCenterSelect?: (view: string, tab: string) => void,
 *   liveStatus?: { status?: 'live' | 'idle' | 'pre-season' | 'unknown' } | null,
 *   navLocked?: boolean,
 * }} props
 */
export function MobileBottomNav({
  dashboardView,
  onSelect,
  onCenterSelect,
  liveStatus,
  navLocked = false,
}) {
  const gwState = gwStateFromStatus(liveStatus?.status)
  const center = CENTER_BY_STATE[gwState]
  const centerActive = dashboardView === center.view

  /** Completed-GW number for the FT chip. Sourced from the same
   * `deriveBrandHeaderStatus` result that renders "GW {n} complete" in the
   * brand header, so the two never disagree. Null → bare "FT" chip. */
  const ftGw = Number.isFinite(Number(liveStatus?.lastFinishedGw))
    ? Number(liveStatus.lastFinishedGw)
    : null

  // "More" stays lit while the user is on any destination reached through it
  // (the More page itself or Settings).
  const moreActive =
    dashboardView === 'more' ||
    dashboardView === 'settings'

  if (navLocked) {
    return (
      <nav
        className="mobile-tab-bar mobile-tab-bar--pre-draft"
        aria-label="App navigation"
        data-gwstate="pre"
      >
        <div className="mobile-tab-bar__row">
          <button
            type="button"
            className={
              'mobile-tab-bar__btn' + (dashboardView === 'teamSelection' ? ' is-active' : '')
            }
            onClick={() => onSelect('teamSelection')}
            aria-current={dashboardView === 'teamSelection' ? 'page' : undefined}
            aria-label="Draft board"
          >
            <span className="mobile-tab-bar__ico" aria-hidden>
              <NavIcon name="users" size={22} />
            </span>
            <span className="mobile-tab-bar__label">Draft</span>
          </button>
        </div>
      </nav>
    )
  }

  return (
    <nav className="mobile-tab-bar" aria-label="App navigation" data-gwstate={gwState}>
      <div className="mobile-tab-bar__row">
        {TABS.slice(0, 2).map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={dashboardView === tab.id}
            onSelect={onSelect}
          />
        ))}

        <div className="mobile-tab-bar__center">
          <button
            type="button"
            className={
              'mobile-tab-bar__fab' + (centerActive ? ' is-active' : '')
            }
            onClick={() =>
              onCenterSelect
                ? onCenterSelect(center.view, center.tab)
                : onSelect(center.view)
            }
            aria-current={centerActive ? 'page' : undefined}
            aria-label={center.aria}
          >
            {gwState === 'pre' ? (
              <span
                className="mobile-tab-bar__chip mobile-tab-bar__chip--ft"
                aria-hidden
              >
                {Number.isFinite(Number(liveStatus?.nextGw)) &&
                Number(liveStatus.nextGw) >= 1
                  ? `GW${Number(liveStatus.nextGw)}`
                  : '26/27'}
              </span>
            ) : gwState === 'live' ? (
              <span
                className="mobile-tab-bar__chip mobile-tab-bar__chip--live"
                aria-hidden
              >
                <i className="mobile-tab-bar__chip-tick" />
                LIVE
              </span>
            ) : (
              <span
                className="mobile-tab-bar__chip mobile-tab-bar__chip--ft"
                aria-hidden
              >
                {ftGw != null ? `FT GW${ftGw}` : 'FT'}
              </span>
            )}
          </button>
          <span className="mobile-tab-bar__label">{center.label}</span>
        </div>

        <TabButton
          tab={TABS[2]}
          active={dashboardView === TABS[2].id}
          onSelect={onSelect}
        />

        <button
          type="button"
          className={'mobile-tab-bar__btn' + (moreActive ? ' is-active' : '')}
          onClick={() => onSelect('more')}
          aria-current={moreActive ? 'page' : undefined}
          aria-label="More"
        >
          <span className="mobile-tab-bar__ico" aria-hidden>
            <NavIcon name="more" size={22} />
          </span>
          <span className="mobile-tab-bar__label">More</span>
        </button>
      </div>
    </nav>
  )
}

/**
 * @param {{
 *   tab: { id: string, label: string, icon: 'bar-chart-3' | 'users' | 'shuffle' },
 *   active: boolean,
 *   onSelect: (id: string) => void,
 * }} props
 */
function TabButton({ tab, active, onSelect }) {
  return (
    <button
      type="button"
      className={'mobile-tab-bar__btn' + (active ? ' is-active' : '')}
      onClick={() => onSelect(tab.id)}
      aria-current={active ? 'page' : undefined}
      aria-label={tab.label}
    >
      <span className="mobile-tab-bar__ico" aria-hidden>
        <NavIcon name={tab.icon} size={22} />
      </span>
      <span className="mobile-tab-bar__label">{tab.label}</span>
    </button>
  )
}
