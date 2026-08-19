import { TeamAvatar } from './TeamAvatar'
import { NavIcon } from './NavIcon'

/** @typedef {'preseason' | 'standings' | 'teamSelection' | 'players' | 'hall' | 'fplLive' | 'more' | 'settings'} DashboardViewId */

/** @typedef {'pulsing-dot' | 'bar-chart-3' | 'users' | 'shuffle' | 'column' | 'more' | 'settings'} NavIconName */

/**
 * Note: the view ID for the Moves tab stays `teamSelection` to keep
 * already-stored Settings default-tab prefs (PR #3) working — the
 * user-visible label has gone Team Selection → Transactions → Moves, but
 * the internal id is load-bearing for saved preferences and is preserved.
 *
 * Items may provide either an `icon` (Lucide-style NavIcon) or an `emoji`
 * glyph (used by the 26/27 preseason tab). Exactly one is rendered.
 *
 * @param {{
 *   item: {
 *     id: DashboardViewId,
 *     label: string,
 *     shortLabel: string,
 *     icon?: NavIconName,
 *     emoji?: string,
 *     pulse?: boolean,
 *     bottomOnly?: boolean,
 *   },
 *   active: boolean,
 *   onSelect: (id: DashboardViewId) => void,
 *   variant: 'top' | 'bottom',
 * }} props
 */
function NavButton({ item, active, onSelect, variant }) {
  const isBottom = variant === 'bottom'
  const iconClass =
    'dashboard-nav__icon' + (item.pulse ? ' dashboard-nav__icon--pulse' : '')
  return (
    <button
      type="button"
      className={
        'dashboard-nav__btn' +
        (active ? ' dashboard-nav__btn--active' : '') +
        (isBottom ? ' dashboard-nav__btn--bottom' : '')
      }
      onClick={() => onSelect(item.id)}
      aria-current={active ? 'page' : undefined}
      aria-label={isBottom ? item.label : undefined}
      title={isBottom ? item.label : undefined}
    >
      {item.emoji ? (
        <span className="dashboard-nav__emoji" aria-hidden="true">
          {item.emoji}
        </span>
      ) : (
        <NavIcon name={item.icon} className={iconClass} />
      )}
      <span className="dashboard-nav__label">
        {isBottom ? item.shortLabel : item.label}
      </span>
    </button>
  )
}

/**
 * @param {{
 *   variant: 'top' | 'bottom',
 *   dashboardView: DashboardViewId,
 *   onSelect: (id: DashboardViewId) => void,
 *   navLocked?: boolean,
 * }} props
 */
export function DashboardNav({ variant, dashboardView, onSelect, navLocked = false }) {
  const isBottom = variant === 'bottom'

  // Single source of truth for nav order (left → right on desktop, also the
  // bottom-pill order on legacy mobile callers): FPL Live · Standings ·
  // Moves · Players · TCLOT Heritage · More. The cinematic 26/27 hub is
  // retired; Live stays available before GW1 so fixtures and squads are
  // ready. The new mobile bottom tab bar (MobileBottomNav.jsx) supplies its
  // own slot list (Table · Moves · contextual centre · Players · More); the
  // items defined here drive only the desktop top nav now. `More` is
  // `bottomOnly` so it never renders on desktop; desktop gets a separate
  // Settings gear button (rendered below the .map() loop).
  const primaryItems = [
    {
      id: /** @type {const} */ ('fplLive'),
      label: 'FPL Live',
      shortLabel: 'Live',
      icon: /** @type {const} */ ('pulsing-dot'),
      pulse: true,
    },
    {
      id: /** @type {const} */ ('standings'),
      label: 'Standings',
      shortLabel: 'Table',
      icon: /** @type {const} */ ('bar-chart-3'),
    },
    {
      id: /** @type {const} */ ('teamSelection'),
      label: 'Moves',
      shortLabel: 'Moves',
      icon: /** @type {const} */ ('users'),
    },
    {
      id: /** @type {const} */ ('players'),
      label: 'Players',
      shortLabel: 'Wire',
      icon: /** @type {const} */ ('shuffle'),
    },
    {
      id: /** @type {const} */ ('more'),
      label: 'More',
      shortLabel: 'More',
      icon: /** @type {const} */ ('more'),
      bottomOnly: true,
    },
  ]

  const topItems = primaryItems.filter((i) => !i.bottomOnly)
  const unlockedItems = isBottom ? primaryItems : topItems
  const preDraftItems = [
    unlockedItems.find((i) => i.id === 'teamSelection'),
  ].filter(Boolean)
  const items = navLocked ? preDraftItems : unlockedItems

  const isActive = (id) => {
    if (id === 'more') {
      return dashboardView === 'more' || dashboardView === 'settings'
    }
    return dashboardView === id
  }

  const settingsActive = dashboardView === 'settings'

  return (
    <nav
      className={
        'dashboard-nav' +
        (isBottom ? ' dashboard-nav--bottom' : ' dashboard-nav--top') +
        (navLocked ? ' dashboard-nav--pre-draft' : '')
      }
      aria-label={isBottom ? 'App navigation' : 'Dashboard sections'}
    >
      {items.map((item) => (
        <NavButton
          key={item.id}
          item={item}
          active={isActive(item.id)}
          onSelect={onSelect}
          variant={variant}
        />
      ))}
      {!isBottom && !navLocked && (
        <button
          type="button"
          className={
            'dashboard-nav__btn dashboard-nav__btn--settings' +
            (settingsActive ? ' dashboard-nav__btn--active' : '')
          }
          onClick={() => onSelect('settings')}
          aria-current={settingsActive ? 'page' : undefined}
          aria-label="Settings"
          title="Settings"
        >
          <NavIcon name="settings" className="dashboard-nav__icon" />
        </button>
      )}
    </nav>
  )
}

export function DashboardMorePanel({
  onNavigate,
  badgeTeams = [],
  teamLogoMap = {},
  kitIndexByEntry = {},
}) {
  // The persistent mobile bottom tab bar (MobileBottomNav.jsx) now surfaces
  // Table (Standings), Moves, Players, and a contextual centre (FPL Live)
  // at the top level. That leaves only Settings to reach through More.
  // ('more' is effectively mobile-only — the desktop top nav filters it out.)
  const rows = [
    { id: /** @type {const} */ ('settings'), label: 'Settings', emoji: '⚙️' },
  ]

  return (
    <section className="tile tile--compact dashboard-more" aria-label="More">
      <h2 className="tile-title tile-title--sm">More</h2>
      {badgeTeams.length > 0 ? (
        <div className="dashboard-more__badges">
          <h3 className="dashboard-more__section-title">Badges</h3>
          <ul className="dashboard-more__badge-grid">
            {badgeTeams.map((t) => (
              <li key={t.id} className="dashboard-more__badge-cell">
                <TeamAvatar
                  entryId={t.id}
                  name={t.teamName}
                  size="lg"
                  logoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                />
                <span className="dashboard-more__badge-name">{t.teamName}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className="dashboard-more__list">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className="dashboard-more__btn"
              onClick={() => onNavigate(row.id)}
            >
              <span className="dashboard-more__emoji" aria-hidden="true">
                {row.emoji}
              </span>
              <span className="dashboard-more__label">{row.label}</span>
              <span className="dashboard-more__chevron" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
