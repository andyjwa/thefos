import {
  Fragment,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react'
import {
  gameWeekSelectLabel,
  gameWeekShortLabel,
  gameWeekSpokenLabel,
} from './gwLabel.js'
import { NavIcon } from './NavIcon.jsx'
import {
  archivedSeasonLabel,
  isArchiveView,
  seasonLabelDisplay,
  seasonHref,
  fetchSeasonCatalog,
} from './seasonArchive.js'
import { getSeasonLabel } from './seasonString.js'
import { isPreDraftAllowedView, resolveDraftGate } from './draftGate.js'
import {
  deriveBrandHeaderStatus,
  formatMilestoneCountdown,
  MILESTONE_SECONDS_WITHIN_MS,
  nextCalendarMilestone,
} from './brandHeaderStatus.js'

const LEAGUE_TITLE_ABBR = 'TCLOT'
const BRAND_HEADER_TOP_N = 8

function wallClockSeasonLabel() {
  return getSeasonLabel()
}

function leagueTitle(seasonLabel) {
  return `Tri-Continental League of Titans, ${seasonLabel || wallClockSeasonLabel()} season`
}

// Lion silhouette extracted verbatim from public/tclot-fantasy-style-banner.svg.
// Kept inline so it inherits currentColor (no second network fetch, themable).
const TCLOT_LION_PATH = "m 60.78468,39.44666 c -1.88455,1.54443 -3.48225,2.4052 -3.48225,2.4052 l 0.0218,4.89541 c 1.34714,1.46649 2.67613,2.68148 3.67106,4.8954 1.88818,-3.31555 1.52507,-8.18972 -0.2106,-12.19601 m -1.53234,16.0252 c 0,0 -0.38489,-2.01909 -2.02253,-3.90357 l -3.73642,0.0886 c 0,0 -5.03636,4.22239 -8.10829,4.32156 0,0 1.6921,3.07115 2.54905,4.6758 1.68847,-0.36132 4.66235,-1.66133 5.86062,-3.02156 0,0 0.79159,2.49022 0.64271,5.43029 1.68121,-0.94932 3.99786,-3.52809 4.81486,-7.59107 m -4.81486,-8.84149 -0.007,-4.8777 c 0,0 -2.23314,-0.69782 -4.61515,-2.50084 -4.78582,0.70492 -10.58109,5.40195 -10.58109,5.40195 0,0 1.95718,3.62375 4.09954,7.53441 3.76547,0.51362 9.31382,-4.12675 11.10396,-5.55782 m 12.76338,20.31134 -3.07919,-3.32618 c -0.87873,8.99027 -5.39221,16.62385 -13.68205,21.94787 l -1.26726,-4.84936 c -7.03711,4.95917 -19.11421,8.17555 -29.48832,2.45125 1.28904,-6.4115 2.43285,-12.90801 -0.0218,-20.68683 -5.74443,8.67855 -10.828,12.07912 -10.828,12.07912 C 4.95285,68.19927 5.30143,55.44358 6.45976,51.68877 L 0,53.64056 C 0,49.35442 3.1627,40.26143 7.74518,35.15348 L 3.711,34.52296 l -0.004,0 C 6.4485,29.05725 10.54077,24.34603 15.54808,20.80731 l 0.007,-0.004 c -1.50328,2.31664 -1.52507,8.03385 2.87948,10.20881 -1.87002,-3.19866 -2.09515,-7.15184 -0.14161,-9.19927 1.95354,-2.06514 5.2397,-1.35668 7.33849,0.24442 -0.62455,-1.7853 -2.45464,-4.031096 -5.19613,-4.183413 l -0.004,0 c 5.17797,-2.600022 11.05676,-4.062977 17.27686,-4.062977 1.16196,0 2.32029,0.04959 3.4532,0.148775 l 0,0 c 1.8083,0.708453 4.46264,3.195123 5.70086,4.743095 0,0 0.0871,-1.82427 -0.95136,-4.027558 6.73573,1.601103 9.94927,4.275518 11.29641,5.564898 0.27597,2.8409 1.14744,4.54473 2.2985,7.24393 -2.1823,-2.38395 -7.66529,-6.23084 -10.28333,-7.15183 0,0 -0.21423,2.46188 -1.11475,3.64499 -5.21429,-3.66978 -7.77423,-4.59432 -7.77423,-4.59432 -5.72264,0.80055 -9.4046,2.95425 -11.40534,4.64746 l 1.74293,1.44877 c -3.44956,1.03435 -5.68996,3.92483 -5.68996,3.92483 0.0254,0.0532 3.08282,0.47821 3.08282,0.47821 0,0 -0.31228,3.5033 4.18305,5.69951 3.85262,1.88094 9.39007,-0.45341 14.60436,1.58693 -3.42777,-3.86106 -5.7989,-5.58615 -5.7989,-5.58615 0,0 -1.36167,-0.27629 -2.32028,-0.26922 -1.19827,0.007 -2.98478,0.23734 -4.94195,-0.50654 -0.93683,-0.35777 -2.0298,-0.98828 -2.88674,-1.51254 0,0 2.40743,-2.41229 5.92598,-2.94363 0,0 3.1736,0.8714 5.68634,2.68504 1.67031,-1.58693 3.41325,-1.53734 3.41325,-1.53734 0,0 -1.72842,1.57276 -1.20553,3.4785 2.5091,2.18204 5.23244,5.30631 5.23244,5.30631 2.77417,-1.48067 8.80546,-1.14061 10.04367,0.26213 -1.56864,-1.9872 -3.83083,-3.64499 -5.58103,-5.06189 -0.21423,-0.74388 -2.1242,-3.33681 -2.44737,-3.57769 0,0 1.81556,0.54551 3.43867,1.96596 0.46478,-0.64824 1.33625,-1.3071 2.52363,-1.59756 1.22005,0.99891 1.43792,2.53271 1.40524,2.78776 -0.5483,0.64115 -1.09297,0.90328 -1.09297,0.90328 l 2.94121,3.10656 0.29412,-2.22809 c 6.77567,9.44014 10.46852,20.36448 5.71901,34.09784 M 13.69195,7.197881 c 3.90709,1.746337 6.41619,3.949626 6.87371,4.286141 -0.20697,-0.984749 -0.97677,-5.7243 -1.41977,-8.667921 2.27671,1.540885 7.55999,5.118572 9.2993,6.280434 0.70807,-2.1289 3.1627,-9.082366 3.1627,-9.082366 0,0 4.43723,7.0066 5.19613,8.143667 C 37.72996,7.212051 43.03139,1.455872 44.40396,0 c 0.22876,3.312017 0.54103,8.048026 0.62092,8.760021 0.26507,-0.350685 2.29487,-3.12782 5.69722,-5.685335 -1.47423,2.833811 -2.17867,6.744471 -2.49094,9.88646 -3.34789,-0.910362 -6.88097,-1.399194 -10.51936,-1.399194 -6.9899,0 -13.55496,1.792386 -19.2304,4.941459 -1.03124,-3.035721 -2.64709,-6.811775 -4.78945,-9.30553"

function TclotLionIcon({ size = 22 }) {
  return (
    <svg
      viewBox="-10 -8 134 144"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      <g fill="currentColor" transform="scale(1.58)">
        <path d={TCLOT_LION_PATH} />
      </g>
    </svg>
  )
}

function BrandHeaderMilestoneTrail({ idleMilestone, nextGw, fallback = null }) {
  const active = Boolean(
    idleMilestone?.waiversTime || idleMilestone?.deadlineTime || idleMilestone?.targetIso,
  )
  const [now, setNow] = useState(() => new Date())
  const live =
    nextCalendarMilestone(
      {
        waivers_time: idleMilestone?.waiversTime,
        deadline_time: idleMilestone?.deadlineTime,
      },
      now,
    ) || idleMilestone
  const remainingMs = live?.targetIso
    ? Date.parse(live.targetIso) - now.getTime()
    : Number.POSITIVE_INFINITY
  const intervalMs =
    Number.isFinite(remainingMs) &&
    remainingMs > 0 &&
    remainingMs < MILESTONE_SECONDS_WITHIN_MS
      ? 1000
      : 60_000
  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [active, intervalMs])
  const countdownLabel = live?.targetIso
    ? formatMilestoneCountdown(live.targetIso, now)
    : live?.countdownLabel
  if (!live || !countdownLabel) return fallback

  const phrase =
    live.kind === 'waivers'
      ? 'Waivers'
      : live.kind === 'gameweek'
        ? `GW ${nextGw} starts`
        : null
  if (!phrase) return fallback

  return (
    <>
      <span className="visually-hidden">
        {phrase} {live.dateTimeLabel}
      </span>
      <span className="brand-header__status-clock" aria-hidden="true">
        {phrase} in{' '}
        <strong className="brand-header__status-mono">{countdownLabel}</strong>
        {' - '}
        {live.dateTimeLabel}
      </span>
    </>
  )
}

/** Renders the status strip body inside `.brand-header__status-strip`. Branches per
 * `liveStatus.status` ('live' | 'idle' | 'pre-season'). Returns `null` when state is
 * unknown (bootstrap not loaded yet) so the strip collapses rather than flashing
 * placeholder copy. */
function BrandHeaderStatusBody({ liveStatus }) {
  if (!liveStatus || liveStatus.status === 'unknown') return null
  const {
    status,
    liveGw,
    lastFinishedGw,
    nextGw,
    nextDeadlineLabel,
    seasonShort,
    progressLabel,
    kickoffLabel,
    idleMilestone,
  } = liveStatus

  if (status === 'live') {
    const liveCount = Number.isFinite(liveStatus.liveFixtureCount)
      ? liveStatus.liveFixtureCount
      : null
    const minute = Number.isFinite(liveStatus.minute) ? liveStatus.minute : null
    return (
      <>
        <span className="brand-header__status-dot" aria-hidden>
          <NavIcon name="pulsing-dot" size={12} className="brand-header__status-dot-svg" />
        </span>
        <span className="brand-header__status-strong">GW {liveGw}</span>
        {liveCount != null ? (
          <>
            <span className="brand-header__status-sep">—</span>
            <span>{liveCount} fixtures live</span>
          </>
        ) : null}
        {minute != null ? (
          <>
            <span className="brand-header__status-sep">·</span>
            <span className="brand-header__status-mono">{minute}&apos;</span>
          </>
        ) : null}
        {liveCount == null && minute == null ? (
          <>
            <span className="brand-header__status-sep">·</span>
            <span>Live</span>
          </>
        ) : null}
        {progressLabel ? (
          <>
            <span className="brand-header__status-sep">·</span>
            <span>{progressLabel}</span>
          </>
        ) : null}
      </>
    )
  }

  if (status === 'idle') {
    // Post-season: between FPL seasons, bootstrap reports `events.next` as null.
    // Surface that explicitly instead of leaking a placeholder `GW ?`. Pre-PR-#3.7
    // showcased this as "Season {seasonShort} complete" to keep the strip honest
    // while the new season's deadlines populate.
    if (nextGw == null) {
      return (
        <>
          <span className="brand-header__status-strong">
            GW {lastFinishedGw} complete
          </span>
          <span className="brand-header__status-sep">·</span>
          <span>Season {seasonShort} complete</span>
        </>
      )
    }
    return (
      <>
        <span className="brand-header__status-strong">
          GW {lastFinishedGw} complete
        </span>
        <span className="brand-header__status-sep">·</span>
        {idleMilestone ? (
          <BrandHeaderMilestoneTrail
            idleMilestone={idleMilestone}
            nextGw={nextGw}
            fallback={
              <span>
                GW {nextGw} of {seasonShort} starts {nextDeadlineLabel ?? 'soon'}
              </span>
            }
          />
        ) : (
          <span>
            GW {nextGw} of {seasonShort} starts {nextDeadlineLabel ?? 'soon'}
          </span>
        )}
      </>
    )
  }

  // pre-season
  return (
    <>
      <span className="brand-header__status-strong">Pre-season</span>
      <span className="brand-header__status-sep">·</span>
      {idleMilestone ? (
        <BrandHeaderMilestoneTrail
          idleMilestone={idleMilestone}
          nextGw={nextGw}
          fallback={
            kickoffLabel ? (
              <span>{seasonShort} season kicks off {kickoffLabel}</span>
            ) : (
              <span>
                {seasonShort} season starts {nextDeadlineLabel ?? 'soon'}
              </span>
            )
          }
        />
      ) : kickoffLabel ? (
        <span>{seasonShort} season kicks off {kickoffLabel}</span>
      ) : (
        <span>
          {seasonShort} season starts {nextDeadlineLabel ?? 'soon'}
        </span>
      )}
    </>
  )
}

/**
 * Header season pill. Renders as the plain label until archived seasons exist
 * (discovered via `league-data/seasons/index.json`), then becomes a button with
 * a menu switching between the current season and archives. Selecting a season
 * navigates with `?season=<label>` — a full reload; the data layer resolves the
 * archived subtree at module init (see seasonArchive.js).
 */
function SeasonSwitcher({ currentSeasonLabel, archivedSeasons = [] }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const viewingLabel = archivedSeasonLabel()
  const currentDisplay = seasonLabelDisplay(currentSeasonLabel)

  useEffect(() => {
    if (!open) return undefined
    function onDocPointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const displayLabel = viewingLabel
    ? seasonLabelDisplay(viewingLabel)
    : currentDisplay

  // No archives (and not somehow parked on one) — the original static label.
  if (!archivedSeasons.length && !viewingLabel) {
    return (
      <span className="brand-header__meta brand-header__meta--season">
        {currentDisplay}
      </span>
    )
  }

  const options = [
    { label: null, display: currentDisplay, archived: false },
    ...archivedSeasons.map((l) => ({
      label: l,
      display: seasonLabelDisplay(l),
      archived: true,
    })),
  ]

  return (
    <span
      className="brand-header__meta brand-header__meta--season season-switch"
      ref={wrapRef}
    >
      <button
        type="button"
        className="season-switch__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch season"
        onClick={() => setOpen((v) => !v)}
      >
        {displayLabel}
        <span className="season-switch__caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <span className="season-switch__menu" role="menu" aria-label="Season">
          {options.map((o) => {
            const selected = (o.label ?? null) === (viewingLabel ?? null)
            return (
              <a
                key={o.label ?? 'current'}
                role="menuitem"
                className={
                  'season-switch__item' +
                  (selected ? ' season-switch__item--selected' : '')
                }
                href={seasonHref(o.label)}
                aria-current={selected ? 'true' : undefined}
              >
                <span>{o.display}</span>
                <span className="season-switch__tag">
                  {o.archived ? 'Archive' : 'Current'}
                </span>
              </a>
            )
          })}
        </span>
      ) : null}
    </span>
  )
}

/**
 * Header tile carrying the brand pill + season meta + top-8 fantasy crests
 * (rank 1 leftmost → rank 8 rightmost), with the status strip beneath. Spec:
 * variant 4 of HEADER · POST-PR-#2 EVOLUTION (Mockup.jsx `HeroVariantBSeasonAndCrests`).
 *
 * @param {{
 *   tableRows?: object[],
 *   leagueEntries?: object[],
 *   teamLogoMap?: Record<string, string>,
 *   kitIndexByEntry?: Record<string, number>,
 *   liveStatus?: object | null,
 *   hideStatusStrip?: boolean,
 * }} props
 */
function BrandHeader({
  tableRows,
  leagueEntries,
  teamLogoMap,
  kitIndexByEntry,
  liveStatus,
  leagueInfoOpen = false,
  onOpenLeagueInfo,
  currentSeasonLabel,
  archivedSeasons = [],
  hideStatusStrip = false,
}) {
  const entryById = useMemo(() => {
    const m = new Map()
    for (const e of leagueEntries ?? []) {
      if (e?.id != null) m.set(e.id, e)
    }
    return m
  }, [leagueEntries])

  const topRows = useMemo(() => {
    const list = Array.isArray(tableRows) ? tableRows : []
    if (list.length > 0) {
      const sorted = [...list].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      return sorted.slice(0, BRAND_HEADER_TOP_N)
    }
    // Pre-season / no table yet — show joined clubs in join order.
    const entries = Array.isArray(leagueEntries) ? [...leagueEntries] : []
    return entries
      .filter((e) => e?.id != null)
      .sort((a, b) => String(a.joined_time ?? '').localeCompare(String(b.joined_time ?? '')))
      .slice(0, BRAND_HEADER_TOP_N)
      .map((e, i) => ({ league_entry: e.id, rank: i + 1 }))
  }, [tableRows, leagueEntries])

  /** Archive view: the strip's countdowns/live cues describe the *current*
   * season and would mislead against frozen data — the archive banner below
   * the header carries the context instead. */
  const showStatusStrip =
    !hideStatusStrip &&
    !isArchiveView() &&
    !!liveStatus &&
    liveStatus.status !== 'unknown'

  return (
    <section
      className="tile tile--brand-header"
      aria-label={`${LEAGUE_TITLE_ABBR} — ${leagueTitle(currentSeasonLabel)}`}
    >
      <div className="brand-header__row">
        <BrandHeaderWordmark
          label={LEAGUE_TITLE_ABBR}
          icon={<TclotLionIcon size={22} />}
          isOpen={leagueInfoOpen}
          onOpen={onOpenLeagueInfo}
        />
        <SeasonSwitcher
          currentSeasonLabel={currentSeasonLabel}
          archivedSeasons={archivedSeasons}
        />
        <span
          className="brand-header__crests"
          aria-label="League standings — top 8"
        >
          {topRows.map((r) => {
            const e = entryById.get(r.league_entry) ?? {}
            const teamName = e.entry_name ?? '—'
            const mgr = `${e.player_first_name ?? ''} ${e.player_last_name ?? ''}`.trim()
            const title = mgr
              ? `${r.rank}. ${teamName} — ${mgr}`
              : `${r.rank}. ${teamName}`
            return (
              <span
                className="brand-header__crest"
                key={r.league_entry ?? `${r.rank}-${teamName}`}
                title={title}
              >
                <TeamAvatar
                  entryId={e.id}
                  name={teamName}
                  size="sm"
                  logoMap={teamLogoMap ?? {}}
                  kitIndexByEntry={kitIndexByEntry}
                  badgeFallback
                />
              </span>
            )
          })}
        </span>
      </div>
      {showStatusStrip ? (
        <div
          className={`brand-header__status-strip brand-header__status-strip--${liveStatus.status}`}
          role="status"
          aria-live="polite"
        >
          <BrandHeaderStatusBody liveStatus={liveStatus} />
        </div>
      ) : null}
    </section>
  )
}
import {
  useLeagueData,
  FORM_LAST_N,
  WIN_MARGIN_BUCKET_KEYS,
} from './useLeagueData'
import { TeamAvatar } from './TeamAvatar'
import { useLeagueLeaderFavicon } from './useLeagueLeaderFavicon'
import { useDraftBootstrapEvents } from './useDraftBootstrapEvents'
import { useFplFixtureLiveSummary } from './useFplFixtureLiveSummary.js'
import { LiveScores } from './LiveScores'
import { PlayerDetailOverlayProvider } from './PlayerDetailOverlay.jsx'
import { TeamDetailOverlayProvider, ClickableTeamName } from './TeamDetailOverlay.jsx'
import { PlayerHistoryProvider, ClickablePlayerName } from './PlayerHistoryContext.jsx'
import { PremWindow } from './PremWindow'
import { DraftBoard } from './DraftBoard'
import { SeasonPredictions } from './SeasonPredictions'
import { WeeklyRecap } from './WeeklyRecap'
import { ThemeToggle } from './ThemeToggle'
import { DashboardNav, DashboardMorePanel } from './DashboardNav'
import { MobileBottomNav } from './MobileBottomNav'
import { SettingsPage } from './SettingsPage'
import { BrandHeaderWordmark } from './BrandHeaderWordmark'
import { LeagueInfoModal } from './LeagueInfoModal'
import { PointsCell } from './PointsCell.jsx'
import {
  DEFAULT_TAB_STORAGE_KEY,
  readStoredDefaultTab,
} from './settingsStorage'
import { initialDashboardView, initialMovesTab } from './seasonOpenLanding.js'
import { useAutoHideBottomNav } from './useAutoHideBottomNav'
import { WaiverSummaryShare } from './WaiverSummaryShare'
import { ForbiddenWaivers } from './ForbiddenWaivers'
import {
  WeeklyWaivers,
  WaiverTotalsToggle,
  FirstWaiverPicks,
  WaiverPickupsToggle,
} from './WaiversPanel.jsx'
import {
  sortGroupsByFirstWaiverOrder,
  sortMovesWaiverThenFa,
} from './waiverMovesSort.js'
import {
  HALL_SEASON_FINAL_TABLES,
  buildManagerFullNameByHallKey,
  computeHallAlgorithmRows,
  computeHallManagerJourney,
  computeHallRecords,
  computeLiveHallManagerCareerRows,
  hallManagerDisplayKey,
  hallManagerInitials,
} from './hallManagerHistory'
import {
  resolveDefaultWaiverGameweek,
  resolveLiveGameweek,
} from './h2hScheduleGw.js'
import { StandingsScheduleSubview } from './StandingsScheduleSubview.jsx'
import { StandingsStatsSubview } from './StandingsStatsSubview.jsx'
import { PlayersWorkbench } from './PlayersWorkbench.jsx'
import { CompactSelectPill } from './CompactSelectPill.jsx'
import {
  COFC_LIVE_COLUMNS,
  nextCofcLiveSort,
  sortCofcLiveRows,
} from './heritageCofcSort.js'
import { parsePlayersHash, stripPlayersHash } from './playerRoutes.js'
import { firstWord, standingsMobileTeamName } from './teamNameUtils.js'
import { useMobileLayout, useMobileNarrowViewport } from './usePortraitMobile.js'
import './App.css'

/**
 * Complete / future GW tiles: full club name at every width — matching the
 * Schedule tab — with the one standing exception that MSFG stays `MSFG`.
 */
function GwFixtureTightTeamName({ name }) {
  const label = standingsMobileTeamName(name)
  return (
    <span
      className="gw-fixture-name-text team-name team-name--sidebar"
      title={label || undefined}
    >
      {label || '—'}
    </span>
  )
}

/**
 * Past champions — sorted latest-season first. Each record carries the central
 * artwork PNG plus the dominant solid background color (`bg`) and Bebas Neue
 * overlay color (`ink`). Per-banner `artScale` and `artY` let us tune the
 * transform-scale crop on each PNG so the baked-in script text at top/bottom
 * stays masked off behind the HTML overlay.
 *
 * @type {Array<{
 *   season: string,
 *   team: string,
 *   bannerImage: string,
 *   bg: string,
 *   ink: string,
 *   artScale?: number,
 *   artY?: string,
 * }>}
 */
const HALL_OF_CHAMPIONS = [
  {
    season: '2025-26',
    team: 'Crouch End Oashisu',
    bannerImage: 'hall-champions/crouch-end-oashisu.png',
    bg: '#99afbf',
    ink: '#f0c441',
    artScale: 1.32,
    artY: '50%',
  },
  {
    season: '2024-25',
    team: 'Seoul Ze Moles',
    bannerImage: 'hall-champions/soul-ze-moles.png',
    bg: '#e71b74',
    ink: '#f0c441',
    artScale: 1.32,
    artY: '50%',
  },
  {
    season: '2023-24',
    team: 'Toronto Wiggum',
    bannerImage: 'hall-champions/toronto-wiggum.png',
    bg: '#2c85cf',
    ink: '#f0c441',
    artScale: 1.32,
    artY: '50%',
  },
  {
    season: '2022-23',
    team: 'Dalston Benoit',
    bannerImage: 'hall-champions/dalston-benoit.png',
    bg: '#272421',
    ink: '#f0c441',
    artScale: 0.85,
    artY: '50%',
    artFit: 'contain',
  },
  {
    season: '2021-22',
    team: 'Dalston Bellsprouts',
    bannerImage: 'hall-champions/dalston-bellsprouts.png',
    bg: '#3c6a51',
    ink: '#f0c441',
    artScale: 0.85,
    artY: '50%',
    artFit: 'contain',
  },
  {
    season: '2020-21',
    team: 'Essex Ratigans',
    bannerImage: 'hall-champions/essex-ratigans.png',
    bg: '#9d4c83',
    ink: '#f0c441',
    artScale: 0.85,
    artY: '50%',
    artFit: 'contain',
  },
]

/* ------------------------------------------------------------------ */
/* TCLOT Heritage — sub-nav + 3 sub-tabs (ported from Mockup variants)  */
/* ------------------------------------------------------------------ */

const HERITAGE_TABS = [
  { key: 'trophy', label: 'Trophy Room' },
  { key: 'history', label: 'History' },
  { key: 'cofc', label: 'Champion of Champions' },
]

function HeritageSubnav({ active, onSelect }) {
  return (
    <div className="heritage-subnav-strip">
      <div
        className="subnav heritage-subnav"
        role="tablist"
        aria-label="TCLOT Heritage sub-views"
      >
        {HERITAGE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`tab-heritage-${tab.key}`}
            aria-selected={active === tab.key}
            aria-controls="heritage-subview-panel"
            className={
              'subnav__tab' + (active === tab.key ? ' subnav__tab--active' : '')
            }
            onClick={() => onSelect(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Trophy Room (sub-tab 1) ---------------- */

/** Single trophy banner card — HTML-composed layout that masks the script
 * text baked into each PNG (top + bottom bands) by zooming `object-fit:
 * cover` past those bands, then overlays uniform Bebas Neue HTML text in
 * the top and bottom strips. `--banner-bg` / `--banner-ink` plus the
 * per-banner `--art-scale` / `--art-y` tuning vars come from the record's
 * `bg`, `ink`, `artScale`, `artY` fields. */
function TrophyBannerCard({ row }) {
  const style = {
    '--banner-bg': row.bg,
    '--banner-ink': row.ink,
    '--art-scale': row.artScale ?? 1.32,
    '--art-y': row.artY ?? '50%',
    '--art-fit': row.artFit ?? 'cover',
  }
  return (
    <article className="hof-banner-card" style={style}>
      <div className="hof-banner-card__top">
        <h3 className="hof-banner-card__team">{row.team}</h3>
      </div>
      <div className="hof-banner-card__art">
        <img
          className="hof-banner-card__img"
          src={`${import.meta.env.BASE_URL}${row.bannerImage}`}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="hof-banner-card__bottom">
        <span className="hof-banner-card__season">{row.season}</span>
      </div>
    </article>
  )
}

/** Detects desktop layout for Trophy Room (≥1024px). Desktop locks the wide
 * carousel — no toggle pill, no swipe gestures, cross-fade with scale
 * between slides. */
function useTrophyRoomDesktopLayout() {
  const subscribe = useCallback((onChange) => {
    if (typeof window === 'undefined') return () => {}
    const mq = window.matchMedia('(min-width: 1024px)')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(min-width: 1024px)').matches
  }, [])
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

function TrophyRoomCarouselArrow({ direction, onClick }) {
  return (
    <button
      type="button"
      className={'hof-troom-dt__arrow hof-troom-dt__arrow--' + direction}
      aria-label={direction === 'prev' ? 'Previous banner' : 'Next banner'}
      onClick={onClick}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {direction === 'prev' ? (
          <polyline points="15 6 9 12 15 18" />
        ) : (
          <polyline points="9 6 15 12 9 18" />
        )}
      </svg>
    </button>
  )
}

function TrophyRoomCarouselDots({ count, activeIdx, onSelect, idPrefix }) {
  return (
    <div className="hof-troom-dt__dots" role="tablist" aria-label="Banner">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          className={'hof-troom-dt__dot' + (i === activeIdx ? ' is-active' : '')}
          role="tab"
          aria-selected={i === activeIdx}
          aria-label={`Show banner ${i + 1}`}
          aria-controls={idPrefix ? `${idPrefix}-active` : undefined}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  )
}

/** Segmented carousel ⇄ grid toggle for the Trophy Room. Shared by the
 * mobile and desktop layouts; the glass-pill styling sits on the dark
 * celebration backdrop. "Grid" reveals every winner banner at once. */
function TrophyRoomViewToggle({ mode, onChange }) {
  return (
    <div className="hof-troom__viewtoggle" role="group" aria-label="Trophy Room view">
      <button
        type="button"
        className={'hof-troom__viewtoggle-btn' + (mode === 'carousel' ? ' is-active' : '')}
        aria-pressed={mode === 'carousel'}
        aria-label="Carousel view — one banner at a time"
        onClick={() => onChange('carousel')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="8" y="5" width="8" height="14" rx="1.5" />
          <line x1="4.5" y1="8" x2="4.5" y2="16" />
          <line x1="19.5" y1="8" x2="19.5" y2="16" />
        </svg>
      </button>
      <button
        type="button"
        className={'hof-troom__viewtoggle-btn' + (mode === 'grid' ? ' is-active' : '')}
        aria-pressed={mode === 'grid'}
        aria-label="Grid view — show all winners"
        onClick={() => onChange('grid')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
        </svg>
      </button>
    </div>
  )
}

/** Grid of every champion banner, rendered in the same banner-card style
 * as the carousel slides, on the shared dark celebration backdrop. */
function TrophyRoomGrid({ banners }) {
  return (
    <div className="hof-troom__grid">
      {banners.map((b) => (
        <div className="hof-troom__grid-cell" key={b.season}>
          <TrophyBannerCard row={b} />
        </div>
      ))}
    </div>
  )
}

function HeritageTrophyRoom() {
  const banners = HALL_OF_CHAMPIONS
  const total = banners.length
  /* Banners are sorted latest-first, so the default active card is index 0
   * (the most recent champion). */
  const [activeIdx, setActiveIdx] = useState(0)
  /* View mode — default carousel (latest season first); "grid" shows all
   * six winner banners at once. Mobile-only: the desktop layout is always
   * a carousel, so only the mobile branch reads/writes this. */
  const [viewMode, setViewMode] = useState('carousel')
  const isDesktop = useTrophyRoomDesktopLayout()

  const goPrev = useCallback(
    () => setActiveIdx((i) => (i - 1 + total) % total),
    [total],
  )
  const goNext = useCallback(
    () => setActiveIdx((i) => (i + 1) % total),
    [total],
  )

  /* Touch-swipe handlers for the mobile carousel. Threshold 40px so casual
   * scrolls don't accidentally advance the banner. */
  const touchStartRef = useRef(null)
  const onTouchStart = (e) => {
    touchStartRef.current = e.touches?.[0]?.clientX ?? null
  }
  const onTouchEnd = (e) => {
    if (touchStartRef.current == null) return
    const endX = e.changedTouches?.[0]?.clientX ?? touchStartRef.current
    const dx = endX - touchStartRef.current
    touchStartRef.current = null
    if (Math.abs(dx) < 40) return
    if (dx < 0) goNext()
    else goPrev()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goPrev()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      goNext()
    }
  }

  if (total === 0) return null

  const cur = banners[activeIdx]
  const prev = banners[(activeIdx - 1 + total) % total]
  const next = banners[(activeIdx + 1) % total]

  return (
    <section
      className="tile hall-of-champions heritage-trophy-room"
      aria-labelledby="heritage-trophy-heading"
    >
      <h2 id="heritage-trophy-heading" className="sr-only">Trophy Room</h2>
      {isDesktop ? (
        <div
          className="hof-troom-dt hof-troom-dt--wide"
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          {/* Viewport wraps stage + arrows so the arrows always sit
              tight against the card edges, regardless of how wide the
              outer Heritage tile is. The viewport is the same width as
              the stage card (with a small gutter on each side to host
              the glass arrow pills), centered in the tile, and acts as
              the positioning context for both arrows. */}
          <div className="hof-troom-dt__viewport">
            <TrophyRoomCarouselArrow direction="prev" onClick={goPrev} />
            <div className="hof-troom-dt__stage" id="heritage-troom-dt-active">
              {banners.map((b, i) => (
                <div
                  key={b.season}
                  className={
                    'hof-troom-dt__slide' +
                    (i === activeIdx ? ' is-active' : '')
                  }
                  aria-hidden={i === activeIdx ? 'false' : 'true'}
                >
                  <TrophyBannerCard row={b} />
                </div>
              ))}
            </div>
            <TrophyRoomCarouselArrow direction="next" onClick={goNext} />
          </div>
          <TrophyRoomCarouselDots
            count={total}
            activeIdx={activeIdx}
            onSelect={setActiveIdx}
            idPrefix="heritage-troom-dt"
          />
        </div>
      ) : (
        <div
          className="hof-troom hof-troom--swipe"
          onTouchStart={viewMode === 'carousel' ? onTouchStart : undefined}
          onTouchEnd={viewMode === 'carousel' ? onTouchEnd : undefined}
          tabIndex={0}
          onKeyDown={viewMode === 'carousel' ? onKeyDown : undefined}
        >
          <div className="hof-troom__bar">
            <TrophyRoomViewToggle mode={viewMode} onChange={setViewMode} />
          </div>
          {viewMode === 'grid' ? (
            <TrophyRoomGrid banners={banners} />
          ) : (
            <>
              <div className="hof-troom__swipe-stage">
                <div className="hof-troom__swipe-peek hof-troom__swipe-peek--prev" aria-hidden="true">
                  <TrophyBannerCard row={prev} />
                </div>
                <div className="hof-troom__swipe-active">
                  <TrophyBannerCard row={cur} />
                </div>
                <div className="hof-troom__swipe-peek hof-troom__swipe-peek--next" aria-hidden="true">
                  <TrophyBannerCard row={next} />
                </div>
              </div>
              <TrophyRoomCarouselDots
                count={total}
                activeIdx={activeIdx}
                onSelect={setActiveIdx}
                idPrefix="heritage-troom-mob"
              />
            </>
          )}
        </div>
      )}
    </section>
  )
}

/* ---------------- TCLOT Records (sits below the trophy carousel) ----
 * League-wide all-time records — derived from `HALL_SEASON_FINAL_TABLES`
 * via `computeHallRecords()`. Records auto-refresh as new seasons land
 * (or when the live `2026-27` season exceeds an existing ceiling/floor)
 * — no UI edits required. The two GW-level records (highest losing /
 * lowest winning GW points) are still manually curated since we don't
 * archive fixture-level history yet; flagged in the data via `_static`. */

/* Tones drive per-tile color treatment via `heritage-record-tile--{tone}`:
 *   apex   — peak achievements (highest pts, highest For, highest 2nd) — gold
 *   nadir  — wooden-spoon / floor records (lowest pts, lowest For)    — muted red
 *   margin — winning / losing margins (1↔2 gap, 7↔8 gap)              — violet
 *   range  — end-of-season top-vs-bottom spread (1↔8 gap)             — cyan-violet
 *   edge   — single-GW outliers (highest losing GW, lowest winning GW)— teal */
function HeritageRecords({ tableRows }) {
  const records = useMemo(() => computeHallRecords(tableRows), [tableRows])
  if (!records?.items?.length) return null

  return (
    <section
      className="tile heritage-records"
      aria-labelledby="heritage-records-heading"
    >
      <header className="heritage-records__head">
        <h2 id="heritage-records-heading" className="heritage-records__title">
          TCLOT Records
        </h2>
        <p className="heritage-records__sub">
          All-time league bests, worsts, and margins — updated automatically
          as seasons unfold.
        </p>
      </header>
      <ul className="heritage-records__grid">
        {records.items.map((rec) => (
          <li
            key={rec.key}
            className={`heritage-record-tile heritage-record-tile--${rec.tone}`}
          >
            <span className="heritage-record-tile__label">{rec.label}</span>
            <span className="heritage-record-tile__value tabular">
              {rec.value}
              {rec.unit ? (
                <span className="heritage-record-tile__unit">{rec.unit}</span>
              ) : null}
            </span>
            <span className="heritage-record-tile__team" title={rec.team}>
              {rec.team}
            </span>
            <span className="heritage-record-tile__season">{rec.season}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ---------------- Team History (sub-tab 2) ---------------- */

/** `2020-21` → `20/21` for the manager-journey card season chips. */
function shortenHallSeasonLabel(season) {
  const m = /^(\d{2})(\d{2})-(\d{2})$/.exec(String(season))
  return m ? `${m[2]}/${m[3]}` : String(season)
}

function MobileViewToggle({ mode, onList, onMatrix }) {
  return (
    <div
      className="mobile-view-toggle"
      role="group"
      aria-label="Team history view"
    >
      <button
        type="button"
        className={'mobile-view-toggle__btn' + (mode === 'list' ? ' is-active' : '')}
        aria-pressed={mode === 'list'}
        aria-label="Accordion list view"
        onClick={onList}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="8" y1="6" x2="20" y2="6" />
          <line x1="8" y1="12" x2="20" y2="12" />
          <line x1="8" y1="18" x2="20" y2="18" />
          <circle cx="4" cy="6" r="1.4" />
          <circle cx="4" cy="12" r="1.4" />
          <circle cx="4" cy="18" r="1.4" />
        </svg>
      </button>
      <button
        type="button"
        className={'mobile-view-toggle__btn' + (mode === 'matrix' ? ' is-active' : '')}
        aria-pressed={mode === 'matrix'}
        aria-label="Transposed matrix view"
        onClick={onMatrix}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      </button>
    </div>
  )
}

/** Same CSS hook as the mockup so position-based heatmap tints apply. */
function heritageCellPosClass(rank) {
  if (!rank) return 'is-empty'
  return 'is-pos-' + rank
}

function ManagerCrest({ displayKey, managerFull, className = 'heritage-mgr-crest' }) {
  return (
    <span className={className} aria-hidden="true">
      {hallManagerInitials(displayKey, managerFull)}
    </span>
  )
}

/** Resolve a manager's full name from a `Map<displayKey, fullName>` lookup. */
function resolveManagerFull(displayKey, fallbackFull, fullNameMap) {
  if (fallbackFull) return fallbackFull
  if (fullNameMap && displayKey && fullNameMap.get(displayKey)) {
    return fullNameMap.get(displayKey)
  }
  return null
}

/** Titles (gold pill) · Titan (top-4 count) · Minnow (bottom-4 count). */
function TeamJourneyStatCols({ row, titleWins }) {
  const titleTooltip =
    titleWins.length > 0
      ? titleWins
          .map(
            (s) =>
              `${shortenHallSeasonLabel(s.season)}${s.team ? ` · ${s.team}` : ''}`,
          )
          .join(', ')
      : 'Seasons finished 1st'
  /* Flat grid children — no `display: contents` row wrappers (those can
   * drop cells in some WebKit layouts and hide Titan/Minnow). */
  return (
    <div
      className="merged-history-timeline__mgr-cols merged-history-timeline__mgr-cols--3"
      role="group"
      aria-label="Titles, Titan, and Minnow finishes"
    >
      <div
        className="merged-history-timeline__mgr-col-label"
        title="Seasons finished 1st"
      >
        Titles
      </div>
      <div
        className="merged-history-timeline__mgr-col-label"
        title="Seasons finishing 1st–4th (top half)"
      >
        Titan
      </div>
      <div
        className="merged-history-timeline__mgr-col-label"
        title="Seasons finishing 5th–8th (bottom half)"
      >
        Minnow
      </div>
      <div
        className="merged-history-timeline__mgr-col-num merged-history-timeline__mgr-col-num--titles"
        title={titleTooltip}
      >
        <span
          className="merged-history-timeline__titles-pill merged-history-mv__pos-chip is-pos-1"
          aria-label={`${row.titles} titles`}
        >
          {row.titles}
        </span>
      </div>
      <div
        className="merged-history-timeline__mgr-col-num tabular"
        title="Seasons finishing 1st–4th (top half)"
      >
        <span className="merged-history-timeline__plain-count">{row.titanCount}</span>
      </div>
      <div
        className="merged-history-timeline__mgr-col-num tabular"
        title="Seasons finishing 5th–8th (bottom half)"
      >
        <span className="merged-history-timeline__plain-count">{row.minnowCount}</span>
      </div>
    </div>
  )
}

function TeamHistoryDesktop({ journey, fullNameMap }) {
  return (
    <div className="merged-history-timeline">
      {journey.map((row) => {
        const seasonsPlayed = row.seasons.length
        const managerFull = resolveManagerFull(row.key, row.managerFull, fullNameMap)
        const titleWins = row.seasons.filter((s) => Number(s.rank) === 1)
        return (
          <div key={row.key} className="merged-history-timeline__row">
            <div className="merged-history-timeline__mgr">
              <div className="merged-history-timeline__mgr-head">
                <ManagerCrest
                  displayKey={row.key}
                  managerFull={managerFull}
                  className="merged-history-timeline__crest"
                />
                <div className="merged-history-timeline__mgr-name">
                  {managerFull ?? row.key}
                </div>
              </div>
              <div
                className="merged-history-timeline__mgr-stats"
                role="group"
                aria-label={`Career stats for ${row.key}`}
              >
                <TeamJourneyStatCols row={row} titleWins={titleWins} />
              </div>
              <div className="merged-history-timeline__mgr-meta muted tabular">
                {seasonsPlayed} {seasonsPlayed === 1 ? 'season' : 'seasons'}
              </div>
            </div>
            <div className="merged-history-timeline__cards">
              {row.seasons.map((s) => (
                <div
                  key={s.season}
                  className={
                    'merged-history-timeline__card ' + heritageCellPosClass(s.rank)
                  }
                  title={s.team ?? ''}
                >
                  <div className="merged-history-timeline__card-season">
                    {shortenHallSeasonLabel(s.season)}
                  </div>
                  <div className="merged-history-timeline__card-team">{s.team ?? '—'}</div>
                  <div className="merged-history-timeline__card-pos">{s.rank ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TeamHistoryMobileAccordion({ journey, fullNameMap }) {
  /* MV-A list view — titles leaderboard. Stable sort by titles desc so
   * the lone champion sits at the top and unproven first-season
   * managers stack at the bottom. Original input order is preserved on
   * ties courtesy of `Array.prototype.sort` being stable in ES2019+. */
  const sortedJourney = useMemo(() => {
    return [...journey].sort(
      (a, b) => (b.titles ?? 0) - (a.titles ?? 0),
    )
  }, [journey])

  /* Multi-open accordion: every section starts collapsed and the user can
   * expand as many as they like simultaneously. Toggling a row only adds or
   * removes its own key from the Set, so opening one never closes another. */
  const [openKeys, setOpenKeys] = useState(() => new Set())
  const toggleKey = (key) =>
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="merged-history-mv merged-history-mv--accordion merged-history-mv--leaderboard">
      <ul className="merged-history-mv__accordion-list">
        {sortedJourney.map((row, idx) => {
          const open = openKeys.has(row.key)
          const managerFull = resolveManagerFull(row.key, row.managerFull, fullNameMap)
          const place = idx + 1
          const titleWins = row.seasons.filter((s) => Number(s.rank) === 1)
          return (
            <li key={row.key} className="merged-history-mv__accordion-item">
              <button
                type="button"
                aria-expanded={open}
                aria-label={`${managerFull ?? row.key}, ${row.titles ?? 0} titles, ${row.titanCount} titan, ${row.minnowCount} minnow. Tap for per-season journey.`}
                className={
                  'merged-history-mv__accordion-toggle' + (open ? ' is-open' : '')
                }
                onClick={() => toggleKey(row.key)}
              >
                <span
                  className={
                    'merged-history-mv__accordion-place is-pos-' +
                    Math.max(1, Math.min(8, place))
                  }
                  aria-hidden="true"
                >
                  {place}
                </span>
                <span className="merged-history-mv__accordion-mgr-name">
                  {managerFull ?? row.key}
                </span>
                <span
                  className="merged-history-mv__chevron"
                  aria-hidden="true"
                >
                  ›
                </span>
              </button>
              <div
                className="merged-history-mv__journey-stats"
                role="group"
                aria-label={`Career stats for ${row.key}`}
              >
                <TeamJourneyStatCols row={row} titleWins={titleWins} />
              </div>
              {open ? (
                <div className="merged-history-mv__journey-wrap">
                  <ul className="merged-history-mv__journey">
                    {row.seasons.map((s) => (
                      <li
                        key={s.season}
                        className={
                          'merged-history-mv__journey-row ' + heritageCellPosClass(s.rank)
                        }
                      >
                        <span className="merged-history-mv__journey-season tabular">
                          {shortenHallSeasonLabel(s.season)}
                        </span>
                        <span className="merged-history-mv__journey-team">{s.team ?? '—'}</span>
                        <span
                          className={
                            'merged-history-mv__pos-chip ' + heritageCellPosClass(s.rank)
                          }
                        >
                          {s.rank ?? '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TeamHistoryMobileMatrix({ journey, fullNameMap }) {
  /* Build (season → manager → entry) lookup from journey. */
  const allSeasonsSet = new Set()
  for (const row of journey) {
    for (const s of row.seasons) allSeasonsSet.add(s.season)
  }
  const seasons = [...allSeasonsSet].sort()
  /* Task 3b — tap-to-reveal. The footer copy ("Tap a cell to reveal the
   * team name that season.") promised this behaviour, but cells previously
   * only carried an HTML `title` attribute (desktop hover tooltip only —
   * mobile taps produced nothing). We now track a single revealed cell:
   * key is `${season}::${managerKey}`, tapping toggles. On desktop the
   * title attribute still provides the hover tooltip; mobile taps swap the
   * cell content from rank → team name (with rank in a small caption).
   * Tapping anywhere else (including the same cell again) closes. */
  const [revealedCellKey, setRevealedCellKey] = useState(null)

  return (
    <div className="merged-history-mv merged-history-mv--transposed">
      <div className="merged-history-mv__transposed-scroll">
        <table>
          <thead>
            <tr>
              <th className="merged-history-mv__transposed-corner" />
              {journey.map((row) => {
                const managerFull = resolveManagerFull(row.key, row.managerFull, fullNameMap)
                return (
                  <th
                    key={row.key}
                    className="merged-history-mv__transposed-th-mgr"
                    title={`${row.key}${managerFull ? ' · ' + managerFull : ''}`}
                  >
                    <ManagerCrest
                      displayKey={row.key}
                      managerFull={managerFull}
                      className="merged-history-mv__transposed-initials"
                    />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {seasons.map((season) => (
              <tr key={season}>
                <th className="merged-history-mv__transposed-th-season tabular">
                  {shortenHallSeasonLabel(season)}
                </th>
                {journey.map((row) => {
                  const entry = row.seasons.find((s) => s.season === season)
                  const rank = entry?.rank ?? null
                  const cellKey = `${season}::${row.key}`
                  const isRevealed = revealedCellKey === cellKey
                  const teamName = entry?.team ?? null
                  return (
                    <td
                      key={row.key}
                      className={
                        'merged-history-mv__transposed-cell ' +
                        heritageCellPosClass(rank) +
                        (isRevealed ? ' is-revealed' : '') +
                        (teamName ? '' : ' is-empty')
                      }
                      title={teamName ?? '—'}
                      onClick={() =>
                        setRevealedCellKey((prev) =>
                          prev === cellKey ? null : cellKey,
                        )
                      }
                    >
                      {isRevealed && teamName ? (
                        <span className="merged-history-mv__transposed-cell-team">
                          {firstWord(teamName)}
                        </span>
                      ) : (
                        rank ?? '—'
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="merged-history-mv__transposed-note muted">
        Tap a cell to reveal the team name that season.
      </p>
    </div>
  )
}

function HeritageTeamHistory({ tableRows, fullNameMap, isStandalone = true }) {
  const journey = useMemo(() => computeHallManagerJourney(tableRows), [tableRows])
  const [mobileMode, setMobileMode] = useState('list')

  return (
    <section
      className={
        'heritage-team-history' + (isStandalone ? ' tile hall-of-champions' : '')
      }
      aria-labelledby={
        isStandalone ? 'heritage-team-history-heading' : undefined
      }
    >
      {isStandalone ? (
        <h2 id="heritage-team-history-heading" className="sr-only">
          Team Journeys
        </h2>
      ) : null}
      <div className="heritage-team-history__mobile-bar">
        <MobileViewToggle
          mode={mobileMode}
          onList={() => setMobileMode('list')}
          onMatrix={() => setMobileMode('matrix')}
        />
      </div>
      <div className="heritage-team-history__desktop">
        <TeamHistoryDesktop journey={journey} fullNameMap={fullNameMap} />
      </div>
      <div className="heritage-team-history__mobile">
        {mobileMode === 'matrix' ? (
          <TeamHistoryMobileMatrix journey={journey} fullNameMap={fullNameMap} />
        ) : (
          <TeamHistoryMobileAccordion journey={journey} fullNameMap={fullNameMap} />
        )}
      </div>
    </section>
  )
}

/* ---------------- Historic Standings (sub-tab 3) ---------------- */

/** e.g. "2024-25" → "2024/25" — re-export of the old helper without renaming. */
function formatHeritageSeasonLabel(seasonKey) {
  const [y1, y2] = String(seasonKey ?? '').split('-')
  if (y1 && y2) return `${y1}/${y2}`
  return seasonKey
}

/** When rendered embedded inside the History sub-tab, `headingTag` is `'h3'`. */
function HeritageHistoricStandings({ fullNameMap, headingTag = 'h3' }) {
  /* Completed historic seasons only — current 26/27 lives on the Standings tab. */
  const seasonOptions = useMemo(
    () => [...HALL_SEASON_FINAL_TABLES].reverse(),
    [],
  )
  const [selectedSeason, setSelectedSeason] = useState(
    () => HALL_SEASON_FINAL_TABLES[HALL_SEASON_FINAL_TABLES.length - 1]?.season ?? '',
  )
  const activeTable = useMemo(
    () => HALL_SEASON_FINAL_TABLES.find((s) => s.season === selectedSeason),
    [selectedSeason],
  )
  const rows = activeTable?.rows ?? []
  const nTeams = rows.length
  const HeadingTag = headingTag === 'h2' ? 'h2' : 'h3'

  return (
    <section
      className="heritage-historic-standings"
      aria-labelledby="heritage-historic-standings-heading"
    >
      <div className="heritage-history__section-head">
        <HeadingTag
          id="heritage-historic-standings-heading"
          className="tile-title tile-title--sm heritage-history__section-title"
        >
          Historic Standings
        </HeadingTag>
        {seasonOptions.length > 0 ? (
          <CompactSelectPill
            label="Season"
            ariaLabel="Completed season"
            align="right"
            value={selectedSeason}
            onChange={(next) => setSelectedSeason(String(next))}
            options={seasonOptions.map(({ season }) => ({
              value: season,
              label: formatHeritageSeasonLabel(season),
            }))}
          />
        ) : null}
      </div>
      <div className="table-scroll table-scroll--standings-open">
        <table className="standings-table standings-table--sidebar standings-table--historic heritage-historic-standings__table">
          <thead>
            <tr>
              <th className="col-rank">#</th>
              <th className="col-team">Team</th>
              <th className="col-num col-pl heritage-col--hide-portrait">PL</th>
              <th className="col-num col-wdl">W</th>
              <th className="col-num col-wdl">D</th>
              <th className="col-num col-wdl">L</th>
              <th
                className="col-num col-for"
                title="Total FPL points scored across H2H gameweeks that season"
              >
                For
              </th>
              <th
                className="col-num col-pts"
                title="League points (3 / 1 / 0 per H2H)"
              >
                PTS
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pl = row.w + row.d + row.l
              const isLeader = row.rank === 1
              const isLast = nTeams > 0 && row.rank === nTeams
              const rowClass = [
                isLeader ? 'row-highlight' : '',
                isLeader ? 'standings-row--divider-below' : '',
                isLast ? 'standings-row--divider-above standings-row--8th' : '',
              ]
                .filter(Boolean)
                .join(' ')
              const displayKey = hallManagerDisplayKey(row.team, row.manager)
              const managerFull = resolveManagerFull(displayKey, null, fullNameMap)
              return (
                <tr
                  key={`${selectedSeason}-${row.team}-${row.rank}`}
                  className={rowClass || undefined}
                >
                  <td className="col-rank">
                    {isLast ? (
                      <span
                        role="img"
                        className="standings-rank-last"
                        aria-label={String(nTeams)}
                        title="Last place"
                      >
                        L
                      </span>
                    ) : (
                      row.rank
                    )}
                  </td>
                  <td className="col-team">
                    <span className="heritage-team-cell">
                      <span
                        className="heritage-team-cell__crest"
                        aria-hidden="true"
                        title={managerFull ?? displayKey}
                      >
                        {hallManagerInitials(displayKey, managerFull)}
                      </span>
                      <span className="heritage-team-cell__name">
                        <span className="heritage-team-cell__name-full">{row.team}</span>
                        <span className="heritage-team-cell__name-short">
                          {firstWord(row.team)}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="col-num col-pl tabular heritage-col--hide-portrait">{pl}</td>
                  <td className="col-num col-wdl">{row.w}</td>
                  <td className="col-num col-wdl">{row.d}</td>
                  <td className="col-num col-wdl">{row.l}</td>
                  <td className="col-num col-for tabular" title="Points for, that season">
                    {row.pf}
                  </td>
                  <td className="col-num col-pts tabular">
                    <PointsCell
                      value={row.pts}
                      size="md"
                      showLabel={false}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Combined History sub-tab: Historic Standings (top) + Team Journeys (bottom). */
function HeritageHistory({ tableRows, fullNameMap }) {
  return (
    <section
      className="tile hall-of-champions heritage-history"
      aria-label="History"
    >
      <HeritageHistoricStandings fullNameMap={fullNameMap} headingTag="h3" />
      <div className="heritage-history__divider" aria-hidden="true" />
      <div className="heritage-history__journeys">
        <h3 className="tile-title tile-title--sm heritage-history__section-title">
          Team Journeys
        </h3>
        <HeritageTeamHistory
          tableRows={tableRows}
          fullNameMap={fullNameMap}
          isStandalone={false}
        />
      </div>
    </section>
  )
}

/* ---------------- Champion of Champions (sub-tab 4) ---------------- */

function cofcColumnKindClass(col) {
  if (col.key === 'key') return ' heritage-cofc__th--mgr'
  if (col.key === 'totalW' || col.key === 'totalD' || col.key === 'totalL') {
    return ' col-num col-wdl heritage-cofc__th--wdl'
  }
  if (col.key === 'totalPf') return ' col-num col-for'
  if (col.key === 'totalPts') return ' col-pts heritage-cofc__th--pts'
  return ''
}

function cofcCellKindClass(col) {
  if (col.key === 'totalW' || col.key === 'totalD' || col.key === 'totalL') {
    return ' col-num col-wdl'
  }
  if (col.key === 'totalPf') return ' col-num col-for'
  if (col.key === 'totalPts') return ' col-pts'
  return ''
}

function CofcLiveSortTh({ col, sort, onSort }) {
  const isPts = col.key === 'totalPts'
  const active = sort?.key === col.key
  const dir = active ? sort.dir : null
  /** League table is ordered by points high → low; show green ↓ on PTS in that order */
  const ptsLeagueDefault = isPts && sort === null

  let arrowGlyph = '↕'
  let arrowClass = 'standings-sort-arrow'
  if (isPts) {
    if (ptsLeagueDefault) {
      arrowGlyph = '↓'
      arrowClass += ' standings-sort-arrow--active standings-sort-arrow--desc'
    } else if (active) {
      arrowGlyph = dir === 'asc' ? '↑' : '↓'
      arrowClass += ` standings-sort-arrow--active standings-sort-arrow--${dir}`
    }
  } else if (active) {
    arrowGlyph = dir === 'asc' ? '↑' : '↓'
    arrowClass += ` standings-sort-arrow--active standings-sort-arrow--${dir}`
  }

  const ariaSort = ptsLeagueDefault
    ? 'descending'
    : active
      ? dir === 'asc'
        ? 'ascending'
        : 'descending'
      : undefined
  const ariaLabel = isPts
    ? ptsLeagueDefault
      ? 'League order (points high to low). Click to sort by points.'
      : active
        ? `PTS: sorted ${dir === 'desc' ? 'high to low' : 'low to high'}. Click to reverse.`
        : 'Sort by points'
    : active
      ? `${col.label}: sorted ${dir === 'desc' ? 'high to low' : 'low to high'}. Click to reverse.`
      : `Sort by ${col.label}`

  return (
    <th
      scope="col"
      className={
        'heritage-cofc__th heritage-cofc__th--' + col.align +
        cofcColumnKindClass(col) +
        (col.mobile ? '' : ' heritage-col--hide-portrait') +
        (active ? ' is-active' : '') +
        (ptsLeagueDefault ? ' is-league-default' : '')
      }
      aria-sort={ariaSort}
      title={col.title || undefined}
    >
      <button
        type="button"
        className="standings-sort-btn heritage-cofc__sort-btn"
        onClick={() => onSort(col.key)}
        aria-label={ariaLabel}
      >
        <span className="standings-sort-btn__label">{col.label}</span>
        <span className={arrowClass} aria-hidden="true">{arrowGlyph}</span>
      </button>
    </th>
  )
}

function CofcLiveTable({ rows, fullNameMap }) {
  const [sort, setSort] = useState(null)
  const sortedRows = useMemo(() => sortCofcLiveRows(rows, sort), [rows, sort])
  const handleSort = useCallback((key) => {
    setSort((prev) => nextCofcLiveSort(prev, key))
  }, [])

  return (
    <div className="table-scroll table-scroll--standings-open">
      <table className="standings-table standings-table--sidebar standings-table--hall-career heritage-cofc__table">
        <thead>
          <tr>
            {COFC_LIVE_COLUMNS.map((col) => (
              <CofcLiveSortTh
                key={col.key}
                col={col}
                sort={sort}
                onSort={handleSort}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r) => (
            <tr key={r.key}>
              {COFC_LIVE_COLUMNS.map((col) => {
                const isMobileOnly = col.mobile
                const tdClass =
                  'heritage-cofc__td heritage-cofc__td--' + col.align +
                  cofcCellKindClass(col) +
                  (isMobileOnly ? '' : ' heritage-col--hide-portrait')
                if (col.key === 'key') {
                  const managerFull = resolveManagerFull(r.key, r.managerFull, fullNameMap)
                  return (
                    <th key={col.key} scope="row" className={tdClass + ' heritage-cofc__td-mgr'}>
                      <span className="heritage-cofc__mgr-cell" title={managerFull ?? r.key}>
                        <ManagerCrest
                          displayKey={r.key}
                          managerFull={managerFull}
                          className="heritage-cofc__crest"
                        />
                        <span className="heritage-cofc__mgr-name">
                          <span className="heritage-cofc__mgr-name-full">
                            {managerFull ?? r.key}
                          </span>
                          <span className="heritage-cofc__mgr-name-short">{r.key}</span>
                        </span>
                      </span>
                    </th>
                  )
                }
                if (col.key === 'avgRank') {
                  return (
                    <td key={col.key} className={tdClass + ' tabular'}>
                      {Number(r.avgRank ?? 0).toFixed(2)}
                    </td>
                  )
                }
                if (col.key === 'lastRank') {
                  return (
                    <td key={col.key} className={tdClass + ' tabular'}>
                      {r.lastRank ?? '—'}
                    </td>
                  )
                }
                if (col.key === 'totalPa') {
                  return (
                    <td key={col.key} className={tdClass + ' tabular'}>
                      {r.hasFaced ? r.totalPa : '—'}
                    </td>
                  )
                }
                if (col.key === 'totalPts') {
                  return (
                    <td key={col.key} className={tdClass + ' tabular'}>
                      <PointsCell
                        value={r[col.key]}
                        size="md"
                        showLabel={false}
                      />
                    </td>
                  )
                }
                return (
                  <td key={col.key} className={tdClass + ' tabular'}>
                    {r[col.key]}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CofcAlgorithmMatrix({ rows, seasonLabels, fullNameMap }) {
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.total - b.total),
    [rows],
  )
  /* Mobile uses the leaderboard variant (Option A: tap row → detail sheet). */
  const [selectedKey, setSelectedKey] = useState(null)
  const selectedRow = useMemo(
    () => sortedRows.find((r) => r.key === selectedKey) ?? null,
    [sortedRows, selectedKey],
  )
  const closeDetail = useCallback(() => setSelectedKey(null), [])

  useEffect(() => {
    if (!selectedKey) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') closeDetail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedKey, closeDetail])

  return (
    <>
      <div className="heritage-cofc-algo__desktop">
        <div className="table-scroll heritage-cofc-algo__scroll">
          <table className="standings-table heritage-cofc-algo__table">
            <thead>
              <tr>
                <th scope="col" className="heritage-cofc-algo__th heritage-cofc-algo__th-mgr">
                  Manager
                </th>
                {seasonLabels.map((s) => (
                  <th
                    key={s}
                    scope="col"
                    className="heritage-cofc-algo__th heritage-cofc-algo__th-season tabular"
                  >
                    {shortenHallSeasonLabel(s)}
                  </th>
                ))}
                <th
                  scope="col"
                  className="heritage-cofc-algo__th heritage-cofc-algo__th-total"
                  title="Sum of finishing positions (lowest wins)"
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const managerFull = resolveManagerFull(row.key, row.managerFull, fullNameMap)
                return (
                  <tr key={row.key}>
                    <th scope="row" className="heritage-cofc-algo__td heritage-cofc-algo__td-mgr">
                      <span className="heritage-cofc__mgr-cell">
                        <ManagerCrest
                          displayKey={row.key}
                          managerFull={managerFull}
                          className="heritage-cofc__crest"
                        />
                        <span className="heritage-cofc__mgr-name">
                          {managerFull ?? row.key}
                        </span>
                      </span>
                    </th>
                    {row.ranks.map((rank, i) => (
                      <td
                        key={seasonLabels[i]}
                        className={
                          'heritage-cofc-algo__td heritage-cofc-algo__td-cell ' +
                          heritageCellPosClass(rank)
                        }
                        title={rank ? `Finished ${rank} → ${rank} pts (lower = better)` : '—'}
                      >
                        {rank ?? '—'}
                      </td>
                    ))}
                    <td className="heritage-cofc-algo__td heritage-cofc-algo__td-total tabular">
                      <strong>{row.total}</strong>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="heritage-cofc-algo__mobile">
        <CofcAlgorithmMobileLeaderboard
          sortedRows={sortedRows}
          fullNameMap={fullNameMap}
          onSelect={setSelectedKey}
        />
        {selectedRow ? (
          <CofcAlgorithmDetailSheet
            row={selectedRow}
            seasonLabels={seasonLabels}
            fullNameMap={fullNameMap}
            onClose={closeDetail}
          />
        ) : null}
      </div>
    </>
  )
}

function CofcAlgorithmMobileLeaderboard({ sortedRows, fullNameMap, onSelect }) {
  return (
    <ul className="heritage-cofc-algo-lb" role="list">
      {sortedRows.map((row, idx) => {
        const managerFull = resolveManagerFull(row.key, row.managerFull, fullNameMap)
        const place = idx + 1
        return (
          <li key={row.key} className="heritage-cofc-algo-lb__item">
            <button
              type="button"
              className="heritage-cofc-algo-lb__btn"
              onClick={() => onSelect(row.key)}
              aria-label={`${managerFull ?? row.key}, total ${row.total}. Tap for season breakdown.`}
            >
              <span
                className={
                  'heritage-cofc-algo-lb__place is-pos-' +
                  Math.max(1, Math.min(8, place))
                }
                aria-hidden="true"
              >
                {place}
              </span>
              <ManagerCrest
                displayKey={row.key}
                managerFull={managerFull}
                className="heritage-cofc-algo-lb__crest"
              />
              <span className="heritage-cofc-algo-lb__name">
                {managerFull ?? row.key}
              </span>
              <PointsCell
                value={row.total}
                size="sm"
                className="heritage-cofc-algo-lb__total"
              />
              <span className="heritage-cofc-algo-lb__chev" aria-hidden="true">›</span>
            </button>
          </li>
        )
      })}
      <li className="heritage-cofc-algo-lb__hint muted">
        Tap a row to view per-season scoring.
      </li>
    </ul>
  )
}

function CofcAlgorithmDetailSheet({ row, seasonLabels, fullNameMap, onClose }) {
  const managerFull = resolveManagerFull(row.key, row.managerFull, fullNameMap)
  return (
    <div
      className="heritage-cofc-algo-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="heritage-cofc-algo-sheet-title"
    >
      <button
        type="button"
        className="heritage-cofc-algo-sheet__backdrop"
        aria-label="Close season breakdown"
        onClick={onClose}
      />
      <div className="heritage-cofc-algo-sheet__card">
        <div className="heritage-cofc-algo-sheet__head">
          <ManagerCrest
            displayKey={row.key}
            managerFull={managerFull}
            className="heritage-cofc-algo-sheet__crest"
          />
          <h4
            id="heritage-cofc-algo-sheet-title"
            className="heritage-cofc-algo-sheet__name"
          >
            {managerFull ?? row.key}
          </h4>
          <button
            type="button"
            className="heritage-cofc-algo-sheet__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <ul className="heritage-cofc-algo-sheet__list" role="list">
          {seasonLabels.map((season, i) => {
            const rank = row.ranks[i]
            return (
              <li
                key={season}
                className={
                  'heritage-cofc-algo-sheet__row ' + heritageCellPosClass(rank)
                }
              >
                <span className="heritage-cofc-algo-sheet__row-season tabular">
                  {shortenHallSeasonLabel(season)}
                </span>
                <span className="heritage-cofc-algo-sheet__row-rank tabular">
                  {rank ?? '—'}
                </span>
                <span className="heritage-cofc-algo-sheet__row-pts muted tabular">
                  {rank ? `${rank} pt${rank === 1 ? '' : 's'}` : '—'}
                </span>
              </li>
            )
          })}
          <li className="heritage-cofc-algo-sheet__row heritage-cofc-algo-sheet__row--total">
            <span className="heritage-cofc-algo-sheet__row-season">Total</span>
            <span className="heritage-cofc-algo-sheet__row-rank tabular">
              <strong>{row.total}</strong>
            </span>
            <span className="heritage-cofc-algo-sheet__row-pts muted">
              lowest wins
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}

function HeritageChampionOfChampions({ tableRows, fullNameMap }) {
  /* Default to "Algorithm" view — the at-a-glance leaderboard reads as the
   * primary scoreboard for the tab; the cumulative ("Live") career table
   * is a deeper drill-down users opt into. */
  const [view, setView] = useState('algorithm')
  const liveRows = useMemo(
    () => computeLiveHallManagerCareerRows(tableRows),
    [tableRows],
  )
  const algoData = useMemo(
    () => computeHallAlgorithmRows(tableRows),
    [tableRows],
  )

  return (
    <section
      className="tile hall-of-champions tile--standings heritage-cofc"
      aria-labelledby="heritage-cofc-heading"
    >
      <div className="heritage-cofc__head">
        <h2
          id="heritage-cofc-heading"
          className="tile-title tile-title--sm heritage-cofc__title"
        >
          {view === 'live' ? 'All Time Standings' : 'Algorithm Table'}
        </h2>
        <CompactSelectPill
          label="View"
          ariaLabel="Champion of Champions view"
          align="right"
          value={view}
          onChange={(next) => setView(String(next))}
          options={[
            { value: 'live', label: 'Live' },
            { value: 'algorithm', label: 'Algorithm' },
          ]}
        />
      </div>
      {view === 'live' ? (
        <CofcLiveTable rows={liveRows} fullNameMap={fullNameMap} />
      ) : (
        <div className="heritage-cofc-algo">
          <CofcAlgorithmMatrix
            rows={algoData.rows}
            seasonLabels={algoData.seasonLabels}
            fullNameMap={fullNameMap}
          />
        </div>
      )}
    </section>
  )
}

/* Top-level Heritage view: sub-nav + 3 sub-tabs. `dashboardView === 'hall'` continues
 * to mount this component (view ID is unchanged). The big "TCLOT Heritage" eyebrow
 * heading lives in this wrapper; each sub-tab supplies its own sr-only h2 so the
 * outline stays informative without visual heading clutter. */
function HallOfChampions({ tableRows = [] }) {
  const [tab, setTab] = useState('trophy')

  /* Map<displayKey, fullName> sourced from the live FPL roster; falls back to the
   * static `HISTORIC_MANAGER_FULL_NAMES` table for archived managers / initial render. */
  const fullNameMap = useMemo(
    () => buildManagerFullNameByHallKey(tableRows),
    [tableRows],
  )

  return (
    <div className="heritage-shell">
      <HeritageSubnav active={tab} onSelect={setTab} />
      <div
        id="heritage-subview-panel"
        role="tabpanel"
        aria-labelledby={`tab-heritage-${tab}`}
        className="heritage-subview-panel"
      >
        {tab === 'trophy' ? (
          <>
            <HeritageTrophyRoom />
            {/* TCLOT Records hidden for now (per request 2026-05-28); re-enable by restoring <HeritageRecords tableRows={tableRows} /> */}
          </>
        ) : null}
        {tab === 'history' ? (
          <HeritageHistory tableRows={tableRows} fullNameMap={fullNameMap} />
        ) : null}
        {tab === 'cofc' ? (
          <HeritageChampionOfChampions
            tableRows={tableRows}
            fullNameMap={fullNameMap}
          />
        ) : null}
      </div>
    </div>
  )
}

function FormCircles({ form }) {
  return (
    <div className="form-circles" aria-label="Last matches form">
      {form.map((r, i) => {
        if (r == null) {
          return <span key={i} className="form-dot form-dot--empty" aria-label="No result" />
        }
        const result = typeof r === 'object' ? r.result : r
        const tooltip =
          typeof r === 'object' && r.opponentName
            ? `GW${r.event} · ${r.scoreStr} · vs ${r.opponentName}`
            : result === 'W' ? 'Win' : result === 'L' ? 'Loss' : 'Draw'
        return (
          <span
            key={i}
            className={`form-dot form-dot--${result === 'W' ? 'win' : result === 'L' ? 'loss' : 'draw'}`}
            data-tooltip={tooltip}
            aria-label={tooltip}
          >
            {result}
          </span>
        )
      })}
    </div>
  )
}

/** Club crest badge (not a shirt) for a trade leg, with text fallback. */
function TradeClubBadge({ player }) {
  const [err, setErr] = useState(false)
  const url = player?.badgeUrl
  if (!url || err) {
    return (
      <span className="trade2__badge trade2__badge--text">
        {(player?.teamShort ?? '?').slice(0, 3)}
      </span>
    )
  }
  return (
    <span className="trade2__badge">
      <img src={url} alt="" loading="lazy" decoding="async" onError={() => setErr(true)} />
    </span>
  )
}

/** Tenure — single line: coloured status dot + either the GW range the
 *  acquired player was dropped over ("GW 9–35") or "on squad for X GWs". */
function TradeTenure({ leg }) {
  const kept = leg.stillOnTeam
  const weeks = Math.max((leg.endGw ?? 0) - (leg.startGw ?? 0) + 1, 1)
  const range =
    leg.gwRangeLabel ??
    (leg.startGw != null && leg.endGw != null && leg.startGw !== leg.endGw
      ? `${leg.startGw}\u2013${leg.endGw}`
      : `${leg.startGw ?? leg.endGw ?? ''}`)
  return (
    <span className={'trade2__tenure' + (kept ? ' is-kept' : ' is-gone')}>
      <span className="trade2__tenure-dot" aria-hidden />
      <span className="trade2__tenure-label">
        {kept ? (
          <>
            on squad
            <span className="trade2__tenure-weeks">
              {' '}(<span className="tabular">{weeks}</span> GW{weeks === 1 ? '' : 's'})
            </span>
          </>
        ) : (
          <>
            GW <span className="tabular">{range}</span>
          </>
        )}
      </span>
    </span>
  )
}

function tradeSumLegs(pairs, side) {
  return (pairs || []).reduce((s, p) => s + (Number(p?.[side]?.totalPoints) || 0), 0)
}

/** First word of a team name — keeps the face-off headers compact. */
function tradeTeamFirstWord(name) {
  const word = (name ?? '').trim().split(/\s+/)[0]
  return word || name || ''
}

/** Team header for one side of the face-off (crest + first-word name). */
function TradeTeamHead({ trade, side, teamLogoMap, kitIndexByEntry }) {
  const isOff = side === 'offered'
  const name = isOff ? trade.offeredTeamName : trade.receivedTeamName
  const entry = isOff
    ? trade.offeredLeagueEntry ?? trade.offeredFplEntry
    : trade.receivedLeagueEntry ?? trade.receivedFplEntry
  return (
    <div className={'trade2__team' + (isOff ? '' : ' trade2__team--away')}>
      <TeamAvatar
        entryId={entry}
        name={name}
        size="sm"
        logoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
      />
      <span className="trade2__team-name" title={name}>
        {tradeTeamFirstWord(name)}
      </span>
    </div>
  )
}

/** One traded player (crest + name + tenure); mirrored on the received side. */
function TradePlayerCell({ leg, side }) {
  const player = leg?.gained
  const cls = 'trade2__pl' + (side === 'received' ? ' trade2__pl--away' : '')
  if (!player) return <div className={cls} />
  return (
    <div className={cls}>
      <TradeClubBadge player={player} />
      <div className="trade2__pl-id">
        <ClickablePlayerName
          element={player.elementId}
          web_name={player.web_name}
          teamShort={player.teamShort}
          className="trade2__pl-name"
        >
          <span className="trade2__pl-name-text">{player.web_name}</span>
        </ClickablePlayerName>
        <TradeTenure leg={leg} />
      </div>
    </div>
  )
}

/** Per-swap row: offered player · pts–pts score (winner glass) · received. */
function TradePairRow({ pair }) {
  const offPts = Number(pair?.offeredLeg?.totalPoints) || 0
  const recPts = Number(pair?.receivedLeg?.totalPoints) || 0
  const offWin = offPts >= recPts
  const recWin = recPts > offPts
  return (
    <div className="trade2__pair">
      <TradePlayerCell leg={pair?.offeredLeg} side="offered" />
      <span className="trade2__pl-score tabular" aria-label={`${offPts} to ${recPts}`}>
        <span className={'trade2__pl-score-num' + (offWin ? ' is-win' : '')}>{offPts}</span>
        <span className="trade2__pl-score-sep" aria-hidden>
          {'\u2013'}
        </span>
        <span className={'trade2__pl-score-num' + (recWin ? ' is-win' : '')}>{recPts}</span>
      </span>
      <TradePlayerCell leg={pair?.receivedLeg} side="received" />
    </div>
  )
}

/** Single processed-trade card — face-off layout: team totals at the top
 *  centre (winner glass pill, Option D), then one row per swapped player
 *  with the same winner treatment and kept/dropped tenure under each name. */
function TradeCardArticle({ trade, teamLogoMap, kitIndexByEntry = {} }) {
  const offeredPts = tradeSumLegs(trade.pairs, 'offeredLeg')
  const receivedPts = tradeSumLegs(trade.pairs, 'receivedLeg')
  const offWin = offeredPts >= receivedPts
  const recWin = receivedPts > offeredPts
  return (
    <article className="trade2">
      <div className="trade2__head">
        {trade.event != null ? (
          <span className="trade2__gw">GW {trade.event}</span>
        ) : (
          <span />
        )}
        {trade.responseTime ? (
          <time className="trade2__date" dateTime={trade.responseTime}>
            {new Date(trade.responseTime).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </time>
        ) : null}
      </div>
      <div className="trade2__heads">
        <TradeTeamHead
          trade={trade}
          side="offered"
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
        <span
          className="trade2__total tabular"
          aria-label={`${trade.offeredTeamName} ${offeredPts}, ${trade.receivedTeamName} ${receivedPts}`}
        >
          <span className={'trade2__total-num' + (offWin ? ' is-win' : '')}>{offeredPts}</span>
          <span className="trade2__total-sep" aria-hidden>
            {'\u2013'}
          </span>
          <span className={'trade2__total-num' + (recWin ? ' is-win' : '')}>{receivedPts}</span>
        </span>
        <TradeTeamHead
          trade={trade}
          side="received"
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
      </div>
      <div className="trade2__pairs">
        {(trade.pairs || []).map((pair, i) => (
          <TradePairRow key={i} pair={pair} />
        ))}
      </div>
    </article>
  )
}

/** Aggregate per-team trade outcomes: net = points won in minus points given away. */
function buildTradeLedger(trades) {
  const byTeam = new Map()
  const touch = (key, name, entryId) => {
    if (!byTeam.has(key)) {
      byTeam.set(key, { key, name, entryId, in: 0, out: 0, count: 0 })
    }
    return byTeam.get(key)
  }
  for (const t of trades) {
    const offKey = t.offeredLeagueEntry ?? t.offeredFplEntry
    const recKey = t.receivedLeagueEntry ?? t.receivedFplEntry
    const off = touch(offKey, t.offeredTeamName, offKey)
    const rec = touch(recKey, t.receivedTeamName, recKey)
    const offPts = tradeSumLegs(t.pairs, 'offeredLeg')
    const recPts = tradeSumLegs(t.pairs, 'receivedLeg')
    off.in += offPts
    off.out += recPts
    rec.in += recPts
    rec.out += offPts
    off.count += 1
    rec.count += 1
  }
  return [...byTeam.values()]
    .map((r) => ({ ...r, net: r.in - r.out }))
    .sort((a, b) => b.net - a.net)
}

/** Per-team net trade ledger — diverging bars sorted by net points. */
function TradeLedger({ trades = [], teamLogoMap, kitIndexByEntry = {} }) {
  const rows = useMemo(() => buildTradeLedger(trades), [trades])
  if (!rows.length) return null
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.net)))
  return (
    <section className="tile tile--compact" aria-labelledby="trade-ledger-heading">
      <h2 id="trade-ledger-heading" className="tile-title tile-title--sm">
        Trade ledger
      </h2>
      <p className="muted muted--tight trade2-ledger__intro">
        Net points won at the trade table — points gained from incoming players minus the points
        the players they gave up scored elsewhere.
      </p>
      <div className="trade2-ledger">
        {rows.map((r) => {
          const pos = r.net >= 0
          const w = (Math.abs(r.net) / maxAbs) * 100
          return (
            <div key={r.key} className="trade2-ledger__row">
              <div className="trade2-ledger__team">
                <TeamAvatar
                  entryId={r.entryId}
                  name={r.name}
                  size="sm"
                  logoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                />
                <span className="trade2-ledger__name" title={r.name}>
                  {firstWord(r.name)}
                </span>
                <span className="trade2-ledger__count">
                  {r.count} trade{r.count === 1 ? '' : 's'}
                </span>
              </div>
              <div className="trade2-ledger__bar">
                <span
                  className={'trade2-ledger__fill' + (pos ? ' is-pos' : ' is-neg')}
                  style={{ width: `${Math.max(w, 4)}%` }}
                />
              </div>
              <div className={'trade2-ledger__net tabular' + (pos ? ' is-pos' : ' is-neg')}>
                {pos ? '+' : '−'}
                {Math.abs(r.net)}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Resolve initial dashboard view: players hash > archive > Moves/Draft.
 * Season-open default is Moves (Draft until the first Thursday waivers).
 * Stored Settings prefs do not override that landing. */
function initialDashboardViewForViewport() {
  if (typeof window === 'undefined') return 'teamSelection'
  return initialDashboardView({
    hasPlayersHash: Boolean(parsePlayersHash()),
    archiveView: isArchiveView(),
  })
}

const STANDINGS_SORT_KEYS = /** @type {const} */ (['gf', 'ga', 'gd', 'total'])

/** Listens to the same `(max-width: 767px)` breakpoint the Standings
 * Variant C CSS uses, so the JSX rendering branches (mobile vs desktop
 * thead/columns/team-name truncation) stay locked to the same line as
 * the visual styling. Wraps the shared {@link useMobileNarrowViewport}
 * hook (also used by the Live GW fixture rows) so both surfaces flip on
 * the same matchMedia listener. */
function useIsMobileStandingsViewport() {
  return useMobileNarrowViewport()
}

/** Sortable header for For / Faced / GD / PTS — `null` sortState = league order. */
function StandingsSortTh({ columnKey, sortState, onSort, label, title, className }) {
  const isPts = columnKey === 'total'
  const active = sortState?.key === columnKey
  const dir = active ? sortState.dir : null
  /** League table is ordered by points high → low; show green ↓ on PTS when using that order */
  const ptsLeagueDefault = isPts && sortState === null

  let arrowGlyph = '↕'
  let arrowClass = 'standings-sort-arrow'
  if (isPts) {
    if (ptsLeagueDefault) {
      arrowGlyph = '↓'
      arrowClass += ' standings-sort-arrow--active standings-sort-arrow--desc'
    } else if (active) {
      arrowGlyph = dir === 'asc' ? '↑' : '↓'
      arrowClass += ` standings-sort-arrow--active standings-sort-arrow--${dir}`
    }
  } else if (active) {
    arrowGlyph = dir === 'asc' ? '↑' : '↓'
    arrowClass += ` standings-sort-arrow--active standings-sort-arrow--${dir}`
  }

  const ariaSort =
    ptsLeagueDefault
      ? 'descending'
      : active
        ? dir === 'asc'
          ? 'ascending'
          : 'descending'
        : undefined

  const ariaLabel = isPts
    ? ptsLeagueDefault
      ? 'League order (points high to low). Click to sort by points.'
      : active
        ? `PTS: sorted ${dir === 'desc' ? 'high to low' : 'low to high'}. Click to reverse.`
        : 'Sort by points'
    : active
      ? `${label}: sorted ${dir === 'desc' ? 'high to low' : 'low to high'}. Click to reverse.`
      : `Sort by ${label}`

  return (
    <th scope="col" className={className} title={title}>
      <button
        type="button"
        className="standings-sort-btn"
        onClick={() => onSort(columnKey)}
        aria-sort={ariaSort}
        aria-label={ariaLabel}
      >
        <span className="standings-sort-btn__label">{label}</span>
        <span className={arrowClass} aria-hidden>
          {arrowGlyph}
        </span>
      </button>
    </th>
  )
}

const EMPTY_LEAGUE_ENTRIES = []
const EMPTY_TEAM_LOGO_MAP = {}

/** localStorage key for the user's theme preference. Key name preserved
 * across the PR #3 ThemeToggle redesign so existing users who already
 * picked light/dark keep their choice. */
const THEME_STORAGE_KEY = 'tclot-theme'

/** Possible values: 'light' | 'dark' | 'system'. 'system' means "follow
 * `prefers-color-scheme`". Users who haven't picked a theme yet get LIGHT
 * (the app's default look); dark and follow-OS are opt-in via Settings.
 * Older stored values ('light'/'dark'/'system') remain valid prefs — no
 * migration needed, and any explicit choice still wins. */
function readStoredThemePref() {
  if (typeof window === 'undefined') return 'light'
  try {
    const s = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (s === 'light' || s === 'dark' || s === 'system') return s
  } catch {
    /* ignore */
  }
  return 'light'
}

/** Resolve `'system'` to a concrete 'light' | 'dark' via prefers-color-scheme. */
function resolveSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function App() {
  const { data, error, loading } = useLeagueData()
  /** Minute-resolution clock for between-GW waiver / deadline countdowns. */
  const [statusNow, setStatusNow] = useState(() => new Date())
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const id = window.setInterval(() => setStatusNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  const [seasonCatalog, setSeasonCatalog] = useState(() => ({
    current: wallClockSeasonLabel(),
    archived: /** @type {string[]} */ ([]),
  }))
  useEffect(() => {
    let cancelled = false
    fetchSeasonCatalog().then((cat) => {
      if (cancelled) return
      setSeasonCatalog({
        current: cat.current || wallClockSeasonLabel(),
        archived: cat.archived,
      })
    })
    return () => {
      cancelled = true
    }
  }, [])
  const {
    tableRows = [],
    teamsForFormSelect = [],
    nextEvent = null,
    previousGameweek = null,
    isSampleData = false,
    fetchFailedDemo = false,
    teamLogoMap = {},
    defaultKitIndexByLeagueEntry: kitIndexByEntry = {},
    mostWaiveredPlayers = [],
    waiverOutPointsByTeam = [],
    waiverInTenureTopRows = [],
    waiverInPointsByTeam = [],
    winMarginBucketRows = [],
    lossMarginBucketRows = [],
    tradesPanelRows = [],
    league = null,
    matches = [],
    waiverOutGwRows = [],
    firstWaiverOrderPicks = [],
    gwRankExtremesMeta = { maxGw: 0, teamCount: 0 },
    gwWeeksAtFirst = [],
    gwWeeksAtLast = [],
  } = data ?? {}
  const leagueEntries = data?.leagueEntries ?? EMPTY_LEAGUE_ENTRIES
  const [dashboardView, setDashboardView] = useState(initialDashboardViewForViewport) // standings | teamSelection | hall | fplLive | players | more | settings
  const [teamSelectionTab, setTeamSelectionTab] = useState(
    /** @type {'waivers' | 'trades' | 'draft'} */ ('draft'),
  )
  const [movesTabPrimed, setMovesTabPrimed] = useState(false)
  /* FPL Live sub-tab. `null` = no explicit choice yet — the rendered tab then
   * follows the season phase (see `fplLiveTab` below, derived after the brand
   * header status). Legacy values are coerced to `'live'` so a persisted pref
   * or stale deep link cannot leave the Live tab blank: `'vibes'` (cinematics,
   * moved to the Preseason hub) and `'forecast'` (player forecast leaderboard,
   * hidden — the forecast data still powers the fixture Odds tab). */
  const [fplLiveTabRaw, setFplLiveTabRaw] = useState(
    /** @type {null | 'squads' | 'live' | 'recap' | 'predictions'} */ (null),
  )
  const setFplLiveTab = useCallback((next) => {
    setFplLiveTabRaw(next === 'vibes' || next === 'forecast' ? 'live' : next)
  }, [])
  /** `null` = API league order; otherwise sort by numeric column */
  const [standingsSort, setStandingsSort] = useState(null)
  /** Mobile (≤767px) renders a separate condensed Standings table with
   * static headers, no sort UI, and rows fixed to PTS-desc order — even
   * if the user previously sorted by another column on desktop. The
   * desktop table keeps the existing interactive sort. */
  const isMobileStandings = useIsMobileStandingsViewport()
  /** league_entry id of the row the user has tapped to highlight, or null.
   * Toggles on click; works for both the hero card (rank 1) and the
   * condensed rows below. Visual treatment matches the leader hero so
   * the rank-1 highlight tradition still reads, plus user can mark any
   * other row for at-a-glance comparison. */
  const [selectedStandingsEntry, setSelectedStandingsEntry] = useState(null)
  const [liveGw, setLiveGw] = useState(null)
  /** Draft bootstrap `events.current` — default Live tab GW when user has not chosen one. */
  const [fplLiveLandingGw, setFplLiveLandingGw] = useState(null)
  const [waiverGwView, setWaiverGwView] = useState(null)
  /** latest = rich cards; summary = compact share / screenshot layout */
  /** Standings sub-tab nav (Phase 2 redesign): `'table' | 'schedule' | 'stats'`.
   * Persisted in `sessionStorage` so a refresh keeps the user on the
   * sub-tab they were viewing. Default `'table'`. Earlier `'schedule'
   * | 'stats'` values still resolve unchanged (forward-compatible). */
  const [standingsSubView, setStandingsSubView] = useState(() => {
    if (typeof window === 'undefined') return 'table'
    try {
      const v = window.sessionStorage.getItem('standingsSubView')
      if (v === 'table' || v === 'schedule' || v === 'stats') return v
    } catch {
      /* ignore */
    }
    return 'table'
  })
  /** Schedule sub-tab — `'all'` shows the full league chronological list;
   * a number is a `league_entry` id (compact per-team view). Resets on
   * refresh per spec ("don't persist; resets on refresh"). */
  const [scheduleTeamFilter, setScheduleTeamFilter] = useState('all')
  const [scheduleResultsFilter, setScheduleResultsFilter] = useState('all')
  /** Stats sub-tab — margin direction toggle (`wins | losses`). */
  const [statsMarginMode, setStatsMarginMode] = useState('wins')
  /** Stats sub-tab — weeks-at-1st-vs-last toggle (`first | last`). */
  const [statsWeeksMode, setStatsWeeksMode] = useState('first')
  /** Stats sub-tab — H2H rivals team picker (defaults to rank-1 once data loads). */
  const [statsH2hTeamId, setStatsH2hTeamId] = useState(null)
  const [themePref, setThemePref] = useState(() => readStoredThemePref())
  const [systemTheme, setSystemTheme] = useState(() => resolveSystemTheme())
  const colorTheme = themePref === 'system' ? systemTheme : themePref
  const [playerDetailOverlayOpen, setPlayerDetailOverlayOpen] = useState(false)
  /** League Info modal disclosure — opened by the BrandHeaderWordmark
   * trigger in the brand header. Lives here at the App level so the
   * trigger (deep inside `<BrandHeader>`) and the modal mount (sibling
   * of the dashboard layout) share the same open state. */
  const [leagueInfoOpen, setLeagueInfoOpen] = useState(false)

  const draftGate = useMemo(
    () => resolveDraftGate(league, statusNow, { archiveView: isArchiveView() }),
    [league, statusNow],
  )
  const mobileLayout = useMobileLayout()
  const hideMobileStatusStrip =
    mobileLayout && draftGate.hideMobileStatusStrip

  const bottomNavHidden = useAutoHideBottomNav({
    enabled:
      !draftGate.navLocked &&
      dashboardView !== 'more' &&
      !playerDetailOverlayOpen,
  })

  const selectDashboardView = useCallback((view) => {
    if (draftGate.navLocked && !isPreDraftAllowedView(view)) {
      setDashboardView('teamSelection')
    } else {
      setDashboardView(view)
    }
    setPlayerDetailOverlayOpen(false)
    if (view !== 'players') {
      stripPlayersHash()
    }
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
    }
  }, [draftGate.navLocked])

  /** Contextual centre button: routes to FPL Live AND lands on the sub-tab
   * matching the season phase (Scores when live, Recap/Predictions otherwise). */
  const selectLiveHub = useCallback(
    (view, tab) => {
      if (tab) setFplLiveTab(tab)
      selectDashboardView(view)
    },
    [selectDashboardView, setFplLiveTab],
  )

  useEffect(() => {
    if (!draftGate.navLocked) return
    if (!isPreDraftAllowedView(dashboardView)) {
      setDashboardView('teamSelection')
    }
  }, [draftGate.navLocked, dashboardView])

  useLayoutEffect(() => {
    document.body.dataset.tclotTheme = colorTheme
  }, [colorTheme])



  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    function onPlayersHashNavigate() {
      if (draftGate.navLocked) return
      if (parsePlayersHash()) setDashboardView('players')
    }
    window.addEventListener('hashchange', onPlayersHashNavigate)
    return () => window.removeEventListener('hashchange', onPlayersHashNavigate)
  }, [draftGate.navLocked])

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themePref)
    } catch {
      /* ignore */
    }
  }, [themePref])

  /** Persist Standings sub-tab choice in `sessionStorage` so a refresh keeps
   * the user where they were. Per spec: only persists `schedule` / `stats`
   * (no `form` value possible). */
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem('standingsSubView', standingsSubView)
    } catch {
      /* ignore */
    }
  }, [standingsSubView])

  /** Listen for OS-level prefers-color-scheme flips so 'system' mode
   * tracks the OS without a reload. No-op when the user picked an
   * explicit light/dark pref. */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => setSystemTheme(e.matches ? 'dark' : 'light')
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  /** Default landing tab (Settings → Default landing tab). Stored in
   * localStorage (key DEFAULT_TAB_STORAGE_KEY); state is mirrored in
   * React so the Settings page's <select> reflects changes immediately. */
  const [defaultTabPref, setDefaultTabPrefState] = useState(() => readStoredDefaultTab())
  const setDefaultTabPref = useCallback((tabId) => {
    setDefaultTabPrefState(tabId)
    try {
      window.localStorage.setItem(DEFAULT_TAB_STORAGE_KEY, tabId)
    } catch {
      /* ignore */
    }
  }, [])

  const onBootstrapLiveMeta = useCallback((meta) => {
    setFplLiveLandingGw(meta?.currentGw ?? null)
  }, [])

  /** FPL draft calendar — fetched on mount so Waivers tab does not depend on opening Live first. */
  const draftBootstrapEvents = useDraftBootstrapEvents()

  /** Draft until GW1 waivers_time, then Waivers. Only applied once so later tab clicks stick. */
  useEffect(() => {
    if (movesTabPrimed) return
    const list = draftBootstrapEvents.events
    if (!list) return
    setTeamSelectionTab(initialMovesTab(list, statusNow))
    setMovesTabPrimed(true)
  }, [draftBootstrapEvents.events, movesTabPrimed, statusNow])

  /**
   * Page-global fixture summary for the brand-header status strip. PR #4 chose
   * Option B (a thin hook that polls only `classic fixtures?event={gw}` while
   * the GW is actually live) over hoisting `useLiveScores` — that hook also
   * pulls draft bootstrap, event/live, ESPN Prem, and per-team picks, which
   * would have multiplied off-tab network traffic for header data we don't
   * need. Shared `fetchFplJsonCached` means the Live tab still gets a warm
   * cache when the user opens it.
   */
  const {
    liveFixtureCount: brandLiveFixtureCount,
    minute: brandLiveMinute,
    finishedFixtureCount: brandFinishedFixtureCount,
    totalFixtureCount: brandTotalFixtureCount,
  } = useFplFixtureLiveSummary({
    currentEvent: draftBootstrapEvents.currentEvent,
  })

  /**
   * Brand-header status strip state. Derived from the cheap bootstrap pull
   * plus the lightweight fixture summary above. Re-derives every render
   * (cheap object construction) so the strip stays correct after the
   * bootstrap auto-refetches across the GW deadline.
   */
  const brandHeaderStatus = useMemo(
    () =>
      deriveBrandHeaderStatus({
        currentEvent: draftBootstrapEvents.currentEvent,
        nextEvent: draftBootstrapEvents.nextEvent,
        lastFinishedEvent: draftBootstrapEvents.lastFinishedEvent,
        season: seasonLabelDisplay(seasonCatalog.current),
        now: statusNow,
        liveFixtureCount: brandLiveFixtureCount,
        minute: brandLiveMinute,
        finishedFixtureCount: brandFinishedFixtureCount,
        totalFixtureCount: brandTotalFixtureCount,
      }),
    [
      draftBootstrapEvents.currentEvent,
      draftBootstrapEvents.nextEvent,
      draftBootstrapEvents.lastFinishedEvent,
      seasonCatalog.current,
      statusNow,
      brandLiveFixtureCount,
      brandLiveMinute,
      brandFinishedFixtureCount,
      brandTotalFixtureCount,
    ],
  )

  /* Effective FPL Live sub-tab. Until the user picks one, the default follows
   * the season phase: live GW → Scores; between GWs → Recap; pre-season (and
   * unknown) → Predictions before GW1 else Scores. Any explicit choice —
   * sub-tab tap or the contextual centre button — wins from then on. */
  const fplLiveTab =
    fplLiveTabRaw ??
    (brandHeaderStatus?.status === 'idle'
      ? 'recap'
      : brandHeaderStatus?.status === 'pre-season'
        ? 'predictions'
        : 'live')

  const rankByEntryId = useMemo(() => {
    const m = new Map()
    for (const row of data?.tableRows ?? []) {
      m.set(row.league_entry, row.rank)
    }
    return m
  }, [data?.tableRows])

  /** `league_entries.id` for the best current rank (usually 1 — league leader). */
  const leagueLeaderEntryId = useMemo(() => {
    const rows = data?.tableRows
    if (!Array.isArray(rows) || rows.length === 0) return null
    let bestEntry = null
    let bestRank = Infinity
    for (const r of rows) {
      const rank = Number(r.rank)
      if (!Number.isFinite(rank)) continue
      if (rank < bestRank) {
        bestRank = rank
        bestEntry = Number(r.league_entry)
      }
    }
    return bestEntry != null && Number.isFinite(bestEntry) ? bestEntry : null
  }, [data?.tableRows])

  useLeagueLeaderFavicon(
    leagueLeaderEntryId,
    data?.teamLogoMap ?? EMPTY_TEAM_LOGO_MAP
  )

  /** GWs present in waiver / FA analytics (drops-gw-live). */
  const processedWaiverGws = useMemo(() => {
    const s = new Set()
    for (const r of waiverOutGwRows) {
      const g = Number(r.gameweek)
      if (Number.isFinite(g) && g >= 1 && g <= 38) s.add(g)
    }
    return [...s].sort((a, b) => a - b)
  }, [waiverOutGwRows])

  const firstUpcomingGw = useMemo(() => {
    const ev = (matches ?? [])
      .filter((m) => !m.finished)
      .map((m) => Number(m.event))
      .filter(Number.isFinite)
    if (!ev.length) return null
    return Math.min(...ev)
  }, [matches])

  const latestProcessedWaiverGw =
    processedWaiverGws.length > 0
      ? processedWaiverGws[processedWaiverGws.length - 1]
      : null

  /**
   * `useDraftBootstrapEvents` can be one snapshot behind; `fplLiveLandingGw` updates on each
   * live load. Take the max so Squads & Results / Live roll forward when FPL bumps `current`.
   */
  const mergedFplCalendarCurrent = useMemo(() => {
    const a = Number(draftBootstrapEvents.current)
    const b = Number(fplLiveLandingGw)
    const aOk = Number.isFinite(a) && a >= 1 && a <= 38
    const bOk = Number.isFinite(b) && b >= 1 && b <= 38
    if (aOk && bOk) return Math.max(a, b)
    if (aOk) return a
    if (bOk) return b
    return null
  }, [draftBootstrapEvents.current, fplLiveLandingGw])

  const draftGwCalendarCurrent =
    mergedFplCalendarCurrent ??
    draftBootstrapEvents.current ??
    fplLiveLandingGw
  const draftGwCalendarNext = draftBootstrapEvents.next

  /**
   * Last draft-bootstrap “current” GW we saw. Used so we only clear `liveGw` when the calendar
   * actually rolls forward past the GW the user had pinned — not when they pick an earlier GW to
   * browse history while `mergedFplCalendarCurrent` stays higher (that used to snap the select back).
   */
  const liveGwCalendarRollRef = useRef(/** @type {number | null} */ (null))

  /** Drop explicit GW pick when the live calendar advances across the pinned GW (season rolls on). */
  useEffect(() => {
    const curNum = Number(mergedFplCalendarCurrent)
    if (!Number.isFinite(curNum)) return

    const prevCal = liveGwCalendarRollRef.current
    liveGwCalendarRollRef.current = curNum

    const pinned = liveGw
    if (pinned == null || !Number.isFinite(Number(pinned))) return

    const pinNum = Number(pinned)
    if (
      prevCal != null &&
      Number.isFinite(prevCal) &&
      curNum > prevCal &&
      curNum > pinNum
    ) {
      setLiveGw(null)
    }
  }, [mergedFplCalendarCurrent, liveGw])

  /** Mobile (tabbed single-column) layout for the waivers panel — drives the
   *  compact "GW38" GW pill so it fits on the same row as the view toggle. */

  /** Waiver GW picker: drops-gw-live GWs plus draft bootstrap current/next (shows GW35 before redeploy). */
  const waiverGwPickerOptions = useMemo(() => {
    const s = new Set(processedWaiverGws)
    const cur = Number(draftGwCalendarCurrent)
    const nxt = Number(draftGwCalendarNext)
    if (Number.isFinite(cur) && cur >= 1 && cur <= 38) s.add(cur)
    if (Number.isFinite(nxt) && nxt >= 1 && nxt <= 38) s.add(nxt)
    return [...s].sort((a, b) => a - b)
  }, [processedWaiverGws, draftGwCalendarCurrent, draftGwCalendarNext])

  /**
   * Default waiver tab GW: when static JSON lags FPL (e.g. GW35 waivers in API but build not yet),
   * follow `events.next` so the upcoming waiver week is selected automatically.
   */
  const waiverGwNumericFallback = useMemo(
    () =>
      resolveDefaultWaiverGameweek({
        matches,
        latestProcessedWaiverGw,
        waiverOutGwRows,
        bootstrapCurrent: draftGwCalendarCurrent,
        bootstrapNext: draftGwCalendarNext,
        previousGameweek,
      }),
    [
      matches,
      latestProcessedWaiverGw,
      waiverOutGwRows,
      draftGwCalendarCurrent,
      draftGwCalendarNext,
      previousGameweek,
    ],
  )

  const waiverGwEffective = useMemo(() => {
    const opts = waiverGwPickerOptions
    const fallback = waiverGwNumericFallback
    const raw = waiverGwView ?? fallback
    if (!opts.length) {
      return Number.isFinite(raw) && raw >= 1 ? raw : 1
    }
    if (opts.includes(raw)) return raw
    if (opts.includes(fallback)) return fallback
    return opts[opts.length - 1]
  }, [waiverGwView, waiverGwNumericFallback, waiverGwPickerOptions])

  /** Next gameweek to be played — drives the "Next gameweek" full-width tile below
   * the standings table and the cap on the schedule sub-tab "fixtures" filter. */
  const nextGwForFixtureTile = useMemo(() => {
    if (Number.isFinite(firstUpcomingGw)) return firstUpcomingGw
    if (Number.isFinite(nextEvent)) return nextEvent
    return null
  }, [firstUpcomingGw, nextEvent])

  const entryNameByLeagueId = useMemo(() => {
    const m = new Map()
    for (const r of tableRows ?? []) {
      m.set(r.league_entry, r.teamName)
    }
    return m
  }, [tableRows])

  const handleStandingsSort = useCallback((columnKey) => {
    if (!STANDINGS_SORT_KEYS.includes(columnKey)) return
    setStandingsSort((prev) => {
      if (prev?.key === columnKey) {
        return { key: columnKey, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      }
      return { key: columnKey, dir: 'desc' }
    })
  }, [])

  /** Toggle the user-selected standings row (hero card + condensed rows). */
  const toggleStandingsHighlight = useCallback((leagueEntryId) => {
    if (leagueEntryId == null) return
    setSelectedStandingsEntry((prev) => (prev === leagueEntryId ? null : leagueEntryId))
  }, [])

  const sortedStandingsRows = useMemo(() => {
    if (!standingsSort) return tableRows
    const { key, dir } = standingsSort
    const out = [...tableRows]
    out.sort((a, b) => {
      const va = Number(a[key])
      const vb = Number(b[key])
      if (!Number.isFinite(va) && !Number.isFinite(vb)) return 0
      if (!Number.isFinite(va)) return 1
      if (!Number.isFinite(vb)) return -1
      const cmp = dir === 'desc' ? vb - va : va - vb
      if (cmp !== 0) return cmp
      return Number(a.rank) - Number(b.rank)
    })
    return out
  }, [tableRows, standingsSort])

  /** Rank-1 row always renders in the hero card at the top — independent
   * of the current sort. The condensed table below renders the other 7
   * rows in whatever order the user sorted (or league order if unsorted),
   * with rank-1 removed. Preserves the "first-place row highlight
   * tradition" by making the hero card the visual celebration of #1. */
  const leaderStandingsRow = useMemo(() => {
    return (tableRows ?? []).find((r) => r.rank === 1) ?? null
  }, [tableRows])

  const nonLeaderStandingsRows = useMemo(() => {
    return sortedStandingsRows.filter((r) => r.rank !== 1)
  }, [sortedStandingsRows])

  /** Mobile always renders PTS-desc — which is league order
   * (`tableRows` is already sorted by total desc with tiebreakers).
   * We just drop the leader (rendered in the hero card). */
  const mobileNonLeaderStandingsRows = useMemo(() => {
    return (tableRows ?? []).filter((r) => r.rank !== 1)
  }, [tableRows])

  /** Next-GW H2H fixtures for the full-width "Next gameweek" tile below the
   * standings table. Hidden entirely when the season is complete. */
  const nextGwFixtures = useMemo(() => {
    if (!Number.isFinite(nextGwForFixtureTile)) return []
    const gw = Number(nextGwForFixtureTile)
    return (matches ?? [])
      .filter((m) => !m.finished && Number(m.event) === gw)
      .map((m) => ({
        event: m.event,
        homeId: m.league_entry_1,
        awayId: m.league_entry_2,
        homeName: entryNameByLeagueId.get(m.league_entry_1) ?? '?',
        awayName: entryNameByLeagueId.get(m.league_entry_2) ?? '?',
      }))
  }, [matches, nextGwForFixtureTile, entryNameByLeagueId])

  const waiversForSelectedGw = useMemo(() => {
    const rows = waiverOutGwRows
    const fplToLeague = new Map()
    for (const t of teamsForFormSelect ?? []) {
      if (t.fplEntryId != null) fplToLeague.set(Number(t.fplEntryId), t.id)
    }
    const gw = Number(waiverGwEffective)
    if (!rows.length || !Number.isFinite(gw)) return { gw: null, groups: [] }
    const inGw = rows.filter((r) => Number(r.gameweek) === gw)
    if (!inGw.length) return { gw, groups: [] }
    /** League waiver run order — same keys as First Waiver Picks: `index` then `id` on cleared waivers. */
    const txKey = (id) => {
      const n = Number(id)
      return Number.isFinite(n) ? n : String(id ?? '')
    }
    const waiverRows = inGw.filter((r) => r.transactionKind === 'w')
    const leagueRunOrder = [...waiverRows].sort((a, b) => {
      const ia = Number(a.waiverWireIndex)
      const ib = Number(b.waiverWireIndex)
      const aHas = Number.isFinite(ia)
      const bHas = Number.isFinite(ib)
      if (aHas && bHas && ia !== ib) return ia - ib
      if (aHas && !bHas) return -1
      if (!aHas && bHas) return 1
      if (!aHas && !bHas) {
        const da = a.added ? Date.parse(a.added) : 0
        const db = b.added ? Date.parse(b.added) : 0
        if (da !== db) return da - db
      }
      return (Number(a.transactionId) || 0) - (Number(b.transactionId) || 0)
    })
    const waiverRunRankByTxId = new Map(
      leagueRunOrder.map((r, i) => [txKey(r.transactionId), i + 1]),
    )
    const byEntry = new Map()
    for (const r of inGw) {
      const k = r.entry
      if (!byEntry.has(k)) {
        const leagueEntryId = fplToLeague.get(Number(k)) ?? Number(k)
        byEntry.set(k, {
          entry: k,
          leagueEntryId,
          teamName: r.teamName,
          moves: [],
        })
      }
      const waiverProcessOrder =
        r.transactionKind === 'w'
          ? (waiverRunRankByTxId.get(txKey(r.transactionId)) ?? null)
          : null
      byEntry.get(k).moves.push({ ...r, waiverProcessOrder })
    }
    for (const g of byEntry.values()) {
      g.moves.sort(sortMovesWaiverThenFa)
    }
    const groups = sortGroupsByFirstWaiverOrder([...byEntry.values()])
    return { gw, groups }
  }, [waiverOutGwRows, teamsForFormSelect, waiverGwEffective])

  /** H2H rivals (Stats sub-tab) defaults to rank-1 team once data loads —
   * matches the spec's "Default to the rank-1 team" guidance. Once the user
   * picks a different team, their choice sticks for the session. */
  const effectiveStatsH2hTeamId = useMemo(() => {
    if (statsH2hTeamId != null) return statsH2hTeamId
    const leader = (tableRows ?? []).find((r) => r.rank === 1)?.league_entry
    if (leader != null) return leader
    return teamsForFormSelect[0]?.id ?? null
  }, [statsH2hTeamId, tableRows, teamsForFormSelect])

  if (loading) {
    return (
      <div className="app fotmob" data-theme={colorTheme}>
        <div className="load-screen">
          <div className="load-screen__toolbar">
            <ThemeToggle value={themePref} onChange={setThemePref} />
          </div>
          Loading league…
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="app fotmob" data-theme={colorTheme}>
        <header className="page-header">
          <BrandHeader
            liveStatus={brandHeaderStatus}
            currentSeasonLabel={seasonCatalog.current}
            archivedSeasons={seasonCatalog.archived}
          />
        </header>
        <main className="main-tiles">
          <section className="tile error-tile">
            <p className="error-msg">{error ?? 'No data'}</p>
            <p className="muted">
              Run <code>python3 ingest.py &lt;LEAGUE_ID&gt;</code> then{' '}
              <code>npm run dev</code> to copy data into the site.
            </p>
          </section>
        </main>
      </div>
    )
  }

  const liveGameweek = resolveLiveGameweek({
    matches,
    bootstrapCurrent: mergedFplCalendarCurrent,
    previousGameweek,
    nextEvent,
    fplLiveLandingGw,
    explicitLiveGw: liveGw,
  })

  const renderGwFixture = (fx, i) => {
    const homeRank = rankByEntryId.get(fx.homeId)
    const awayRank = rankByEntryId.get(fx.awayId)
    const homeWin =
      fx.homePts != null && fx.awayPts != null && fx.homePts > fx.awayPts
    const awayWin =
      fx.homePts != null && fx.awayPts != null && fx.awayPts > fx.homePts
    return (
      <li key={`${fx.event}-${fx.homeId}-${fx.awayId}-${i}`} className="gw-fixture-row">
        <div className="gw-fixture-teams">
          <span className="gw-fixture-avatar gw-fixture-avatar--home">
            <TeamAvatar
              entryId={fx.homeId}
              name={fx.homeName}
              size="sm"
              logoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
            />
          </span>
          <span
            className={`gw-fixture-name-cell gw-fixture-name-cell--home${homeWin ? ' gw-fixture-name--winner' : ''}`}
          >
            <GwFixtureTightTeamName name={fx.homeName} />
            {homeRank != null ? (
              <span className="gw-fixture-rank muted"> ({homeRank})</span>
            ) : null}
          </span>
          {fx.homePts != null ? (
            <span className="gw-fixture-score gw-fixture-mid">
              {fx.homePts} – {fx.awayPts}
            </span>
          ) : (
            <span className="gw-fixture-vs gw-fixture-mid">v</span>
          )}
          <span
            className={`gw-fixture-name-cell gw-fixture-name-cell--away${awayWin ? ' gw-fixture-name--winner' : ''}`}
          >
            <GwFixtureTightTeamName name={fx.awayName} />
            {awayRank != null ? (
              <span className="gw-fixture-rank muted"> ({awayRank})</span>
            ) : null}
          </span>
          <span className="gw-fixture-avatar gw-fixture-avatar--away">
            <TeamAvatar
              entryId={fx.awayId}
              name={fx.awayName}
              size="sm"
              logoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
            />
          </span>
        </div>
      </li>
    )
  }

  return (
    <PlayerDetailOverlayProvider
      dashboardView={dashboardView}
      teamsForFormSelect={teamsForFormSelect}
      leagueDataRevision={String(
        import.meta.env.VITE_LEAGUE_DATA_REVISION ?? '',
      ).trim()}
      logoMap={teamLogoMap}
      kitIndexByEntry={kitIndexByEntry}
      onOpenChange={setPlayerDetailOverlayOpen}
    >
    <TeamDetailOverlayProvider
      dashboardView={dashboardView}
      leagueEntries={leagueEntries}
      matches={matches}
      teamLogoMap={teamLogoMap}
      kitIndexByEntry={kitIndexByEntry}
    >
    <PlayerHistoryProvider>
    <div
      className="app fotmob"
      data-theme={colorTheme}
      data-bottom-nav-hidden={bottomNavHidden ? 'true' : undefined}
      data-dashboard-view={dashboardView}
    >
      <main className="dashboard-layout dashboard-layout--with-nav">
        <div className="dashboard-page-hero">
          <header className="page-header">
            <BrandHeader
              tableRows={tableRows}
              leagueEntries={leagueEntries}
              teamLogoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
              liveStatus={brandHeaderStatus}
              leagueInfoOpen={leagueInfoOpen}
              onOpenLeagueInfo={() => setLeagueInfoOpen(true)}
              currentSeasonLabel={seasonCatalog.current}
              archivedSeasons={seasonCatalog.archived}
              hideStatusStrip={hideMobileStatusStrip}
            />
            {fetchFailedDemo && (
              <div className="data-banner data-banner--error" role="alert">
                <strong>League file didn’t load</strong> (wrong URL or deploy). Showing demo only.{' '}
                Use <code>https://YOUR_USER.github.io/repo-name/</code> with your real repo name (often
                lowercase). If the repo is <code>you.github.io</code>, use <code>https://you.github.io/</code>{' '}
                — no <code>/repo/</code> path.
              </div>
            )}
            {isSampleData && !fetchFailedDemo && (
              <div className="data-banner" role="status">
                <strong>Demo data</strong> — site owner: add GitHub secret{' '}
                <code>FPL_LEAGUE_ID</code> (your draft league number) under Settings → Secrets, then redeploy.
                Or publish files: <code>python3 ingest.py ID</code>,{' '}
                <code>cd web && npm run publish-real-league</code>, commit{' '}
                <code>web/public/league-data/</code>. ID: <code>draft.premierleague.com/league/YOUR_ID</code>
              </div>
            )}
            {isArchiveView() && (
              <div className="data-banner data-banner--archive" role="status">
                <strong>
                  {seasonLabelDisplay(archivedSeasonLabel())} season archive
                </strong>{' '}
                — final standings and moves, frozen at end of season.{' '}
                <a className="data-banner__link" href={seasonHref(null)}>
                  Back to current season
                </a>
              </div>
            )}
          </header>
        </div>
        <DashboardNav
          variant="top"
          dashboardView={dashboardView}
          onSelect={selectDashboardView}
          navLocked={draftGate.navLocked}
        />
        <div className="dashboard-content">

          {dashboardView === 'standings' && (
            <>
              <div className="standings-subnav-strip">
                <div
                  className="subnav standings-subnav-capsule"
                  role="tablist"
                  aria-label="Standings sub-views"
                >
                  <button
                    type="button"
                    role="tab"
                    id="tab-standings-table"
                    aria-selected={standingsSubView === 'table'}
                    aria-controls="standings-subview-panel"
                    className={
                      'subnav__tab' +
                      (standingsSubView === 'table' ? ' subnav__tab--active' : '')
                    }
                    onClick={() => setStandingsSubView('table')}
                  >
                    Table
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="tab-standings-schedule"
                    aria-selected={standingsSubView === 'schedule'}
                    aria-controls="standings-subview-panel"
                    className={
                      'subnav__tab' +
                      (standingsSubView === 'schedule' ? ' subnav__tab--active' : '')
                    }
                    onClick={() => setStandingsSubView('schedule')}
                  >
                    Schedule
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="tab-standings-stats"
                    aria-selected={standingsSubView === 'stats'}
                    aria-controls="standings-subview-panel"
                    className={
                      'subnav__tab' +
                      (standingsSubView === 'stats' ? ' subnav__tab--active' : '')
                    }
                    onClick={() => setStandingsSubView('stats')}
                  >
                    Stats
                  </button>
                </div>
              </div>

              <div
                id="standings-subview-panel"
                role="tabpanel"
                aria-labelledby={
                  standingsSubView === 'stats'
                    ? 'tab-standings-stats'
                    : 'tab-standings-schedule'
                }
                className="standings-subview-panel"
              >
                {standingsSubView === 'table' ? (
                  <>
                  <section
                    className="tile tile--standings tile--standings-c"
                    aria-label="Standings"
                  >
                {leaderStandingsRow && (() => {
                  const leader = leaderStandingsRow
                  const isSelected = selectedStandingsEntry === leader.league_entry
                  const leaderDisplayName = isMobileStandings
                    ? standingsMobileTeamName(leader.teamName)
                    : leader.teamName
                  const leaderForm = (leader.form ?? []).slice(-5)
                  const seasonEnded = nextGwForFixtureTile == null && (leader.pl ?? 0) > 0
                  return (
                    /* Focusable div, not a <button>: the card contains an
                       interactive ClickableTeamName, and nested interactive
                       controls are invalid ARIA. Mirrors the standings <tr>
                       highlight-toggle pattern below. */
                    <div
                      className={`standings-hero-card${isSelected ? ' is-selected' : ''}`}
                      tabIndex={0}
                      aria-label={`${leaderDisplayName}, ${leader.total} points, ${seasonEnded ? 'champion' : 'top of the league'}`}
                      onClick={() => toggleStandingsHighlight(leader.league_entry)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleStandingsHighlight(leader.league_entry)
                        }
                      }}
                    >
                      <span className={`standings-hero-card__eyebrow${seasonEnded ? ' standings-hero-card__eyebrow--champion' : ''}`}>
                        {seasonEnded ? (
                          <>
                            <svg
                              aria-hidden="true"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              focusable="false"
                            >
                              <path d="M19 4h-2V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1H5a2 2 0 0 0-2 2v2a4 4 0 0 0 4 4h.36A6 6 0 0 0 11 14.91V17H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.09A6 6 0 0 0 16.64 11H17a4 4 0 0 0 4-4V6a2 2 0 0 0-2-2ZM5 6h2v3a4 4 0 0 0 .07.74A2 2 0 0 1 5 8Zm14 2a2 2 0 0 1-2.07 2A4 4 0 0 0 17 9V6h2Z" />
                            </svg>
                            Champion
                          </>
                        ) : (
                          <>
                            <span aria-hidden>★</span>
                            Top of the league
                          </>
                        )}
                      </span>
                      <div className="standings-hero-card__row">
                        <span className="standings-hero-card__crest">
                          <TeamAvatar
                            entryId={leader.league_entry}
                            name={leader.teamName}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                          />
                        </span>
                        <div className="standings-hero-card__id">
                          <div className="standings-hero-card__name">
                            <ClickableTeamName
                              leagueEntryId={leader.league_entry}
                              title={leader.teamName}
                            >
                              {leaderDisplayName}
                            </ClickableTeamName>
                          </div>
                        </div>
                        <div className="standings-hero-card__pts">
                          <div className="standings-hero-card__pts-num tabular">{leader.total}</div>
                          <div className="standings-hero-card__pts-lbl">PTS</div>
                        </div>
                      </div>
                      <div className="standings-hero-card__sub">
                        <FormCircles form={leaderForm} />
                        <div className="standings-hero-card__inline-stats">
                          <span className="standings-hero-card__inline-stat">
                            <span className="standings-hero-card__inline-stat-lbl">Played</span>
                            <span className="standings-hero-card__inline-stat-num tabular">{leader.pl}</span>
                          </span>
                          <span className="standings-hero-card__inline-sep" aria-hidden>·</span>
                          <span className="standings-hero-card__inline-stat">
                            <span className="standings-hero-card__inline-stat-lbl">For</span>
                            <span className="standings-hero-card__inline-stat-num tabular">{leader.gf}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })()}
                {isMobileStandings ? (
                  <div className="table-scroll table-scroll--standings-open">
                    <table
                      className="standings-table standings-table--variant-c standings-table--variant-c-mobile"
                      role="table"
                      aria-label="Standings — ranks 2 through 8 (sorted by points descending)"
                    >
                      <thead>
                        <tr>
                          <th scope="col" className="col-rank">#</th>
                          <th scope="col" className="col-team">Team</th>
                          <th scope="col" className="col-num col-for">For</th>
                          <th scope="col" className="col-num col-pts">PTS</th>
                          <th scope="col" className="col-form">Form</th>
                          <th scope="col" className="col-next">Nxt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mobileNonLeaderStandingsRows.map((row) => {
                          const isSelected = selectedStandingsEntry === row.league_entry
                          const rowClass = [
                            row.rank === 8 ? 'standings-row--divider-above standings-row--8th' : '',
                            isSelected ? 'is-selected' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')
                          const displayName = standingsMobileTeamName(row.teamName)
                          const form5 = (row.form ?? []).slice(-5)
                          return (
                            <Fragment key={row.league_entry}>
                            <tr
                              className={rowClass || undefined}
                              onClick={() => toggleStandingsHighlight(row.league_entry)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  toggleStandingsHighlight(row.league_entry)
                                }
                              }}
                              tabIndex={0}
                              aria-pressed={isSelected}
                            >
                              <td className="col-rank">
                                {row.rank === 8 ? (
                                  <span role="img" className="standings-rank-last" aria-label="8" title="Last place">
                                    L
                                  </span>
                                ) : (
                                  row.rank
                                )}
                              </td>
                              <td className="col-team">
                                <span className="team-cell">
                                  <TeamAvatar
                                    entryId={row.league_entry}
                                    name={row.teamName}
                                    size="sm"
                                    logoMap={teamLogoMap}
                                    kitIndexByEntry={kitIndexByEntry}
                                  />
                                  <span className="standings-team-id">
                                    <ClickableTeamName
                                      leagueEntryId={row.league_entry}
                                      className="team-name team-name--sidebar"
                                      title={row.teamName}
                                    >
                                      {displayName}
                                    </ClickableTeamName>
                                  </span>
                                </span>
                              </td>
                              <td className="col-num col-for tabular" title="Your points for, all GWs">
                                {row.gf}
                              </td>
                              <td className="col-num col-pts tabular">
                                <strong>{row.total}</strong>
                              </td>
                              <td className="col-form">
                                <FormCircles form={form5} />
                              </td>
                              <td className="col-next">
                                {row.next ? (
                                  <TeamAvatar
                                    entryId={row.next.id}
                                    name={row.next.name}
                                    size="sm"
                                    logoMap={teamLogoMap}
                                    kitIndexByEntry={kitIndexByEntry}
                                  />
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                            </tr>
                            {row.rank === 4 ? (
                              <tr
                                className="standings-divider standings-divider--minnows"
                                aria-hidden="true"
                              >
                                <td colSpan={6}>
                                  <span className="standings-divider__label">
                                    Minnows
                                  </span>
                                </td>
                              </tr>
                            ) : null}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="table-scroll table-scroll--standings-open">
                    <table className="standings-table standings-table--sidebar standings-table--variant-c">
                      <thead>
                        <tr>
                          <th className="col-rank">#</th>
                          <th className="col-team">Team</th>
                          <th className="col-num col-pl">PL</th>
                          <th className="col-num col-wdl">W</th>
                          <th className="col-num col-wdl">D</th>
                          <th className="col-num col-wdl">L</th>
                          <StandingsSortTh
                            columnKey="gf"
                            sortState={standingsSort}
                            onSort={handleStandingsSort}
                            label="For"
                            title="Your team’s total FPL points across all H2H gameweeks"
                            className="col-num col-for"
                          />
                          <StandingsSortTh
                            columnKey="ga"
                            sortState={standingsSort}
                            onSort={handleStandingsSort}
                            label="Faced"
                            title="Points against, all H2H gameweeks"
                            className="col-num col-faced"
                          />
                          <StandingsSortTh
                            columnKey="gd"
                            sortState={standingsSort}
                            onSort={handleStandingsSort}
                            label="GD"
                            title="Goal difference (points for minus points against)"
                            className="col-num col-gd"
                          />
                          <StandingsSortTh
                            columnKey="total"
                            sortState={standingsSort}
                            onSort={handleStandingsSort}
                            label="PTS"
                            title="League points (3 / 1 / 0 per H2H)"
                            className="col-num col-pts"
                          />
                          <th
                            className="col-form"
                            title={`Last ${FORM_LAST_N} H2H matches (W / D / L)`}
                          >
                            Form
                          </th>
                          <th className="col-next">Nxt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nonLeaderStandingsRows.map((row) => {
                          const isSelected = selectedStandingsEntry === row.league_entry
                          const rowClass = [
                            row.rank === 8 ? 'standings-row--divider-above standings-row--8th' : '',
                            isSelected ? 'is-selected' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')
                          const form7 = (row.form ?? []).slice(-7)
                          return (
                            <Fragment key={row.league_entry}>
                            <tr
                              className={rowClass || undefined}
                              onClick={() => toggleStandingsHighlight(row.league_entry)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  toggleStandingsHighlight(row.league_entry)
                                }
                              }}
                              tabIndex={0}
                              aria-pressed={isSelected}
                            >
                              <td className="col-rank">
                                {row.rank === 8 ? (
                                  <span role="img" className="standings-rank-last" aria-label="8" title="Last place">
                                    L
                                  </span>
                                ) : (
                                  row.rank
                                )}
                              </td>
                              <td className="col-team">
                                <span className="team-cell">
                                  <TeamAvatar
                                    entryId={row.league_entry}
                                    name={row.teamName}
                                    size="sm"
                                    logoMap={teamLogoMap}
                                    kitIndexByEntry={kitIndexByEntry}
                                  />
                                  <span className="standings-team-id">
                                    <ClickableTeamName
                                      leagueEntryId={row.league_entry}
                                      className="team-name team-name--sidebar"
                                      title={row.teamName}
                                    >
                                      {row.teamName}
                                    </ClickableTeamName>
                                  </span>
                                </span>
                              </td>
                              <td className="col-num col-pl">{row.pl}</td>
                              <td className="col-num col-wdl">{row.matches_won}</td>
                              <td className="col-num col-wdl">{row.matches_drawn}</td>
                              <td className="col-num col-wdl">{row.matches_lost}</td>
                              <td className="col-num col-for tabular" title="Your points for, all GWs">
                                {row.gf}
                              </td>
                              <td className="col-num col-faced tabular">
                                {row.ga}
                              </td>
                              <td className="col-num col-gd tabular">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                              <td className="col-num col-pts tabular">
                                <strong>{row.total}</strong>
                              </td>
                              <td className="col-form">
                                <FormCircles form={form7} />
                              </td>
                              <td className="col-next">
                                {row.next ? (
                                  <TeamAvatar
                                    entryId={row.next.id}
                                    name={row.next.name}
                                    size="sm"
                                    logoMap={teamLogoMap}
                                    kitIndexByEntry={kitIndexByEntry}
                                  />
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                            </tr>
                            {row.rank === 4 ? (
                              <tr
                                className="standings-divider standings-divider--minnows"
                                aria-hidden="true"
                              >
                                <td colSpan={12}>
                                  <span className="standings-divider__label">
                                    Minnows
                                  </span>
                                </td>
                              </tr>
                            ) : null}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

                  {nextGwForFixtureTile != null && nextGwFixtures.length > 0 ? (
                    <section
                      className="tile tile--compact tile--standings-next-gw"
                      aria-labelledby="standings-next-gw-heading"
                    >
                      <div className="tile-head-row tile-head-row--tight">
                        <h2
                          id="standings-next-gw-heading"
                          className="tile-title tile-title--sm tile--standings-next-gw__title"
                        >
                          <span className="tile--standings-next-gw__eyebrow">
                            Next
                          </span>
                          <span className="tile--standings-next-gw__sep" aria-hidden="true">
                            ·
                          </span>
                          <span className="tile--standings-next-gw__gw">
                            {gameWeekSpokenLabel(nextGwForFixtureTile)}
                          </span>
                        </h2>
                      </div>
                      <ul className="gw-fixture-list gw-fixture-list--tight tile--standings-next-gw__list">
                        {nextGwFixtures.map((fx, i) => renderGwFixture(fx, i))}
                      </ul>
                    </section>
                  ) : null}
                  </>
                ) : standingsSubView === 'schedule' ? (
                  <StandingsScheduleSubview
                    matches={matches}
                    teamsForFormSelect={teamsForFormSelect}
                    tableRows={tableRows}
                    leagueEntries={leagueEntries}
                    teamLogoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                    teamFilter={scheduleTeamFilter}
                    onTeamFilterChange={setScheduleTeamFilter}
                    resultsFilter={scheduleResultsFilter}
                    onResultsFilterChange={setScheduleResultsFilter}
                  />
                ) : (
                  <StandingsStatsSubview
                    winMarginBucketRows={winMarginBucketRows}
                    lossMarginBucketRows={lossMarginBucketRows}
                    gwWeeksAtFirst={gwWeeksAtFirst}
                    gwWeeksAtLast={gwWeeksAtLast}
                    gwRankExtremesMeta={gwRankExtremesMeta}
                    matches={matches}
                    leagueEntries={leagueEntries}
                    tableRows={tableRows}
                    teamsForFormSelect={teamsForFormSelect}
                    teamLogoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                    marginMode={statsMarginMode}
                    onMarginModeChange={setStatsMarginMode}
                    weeksMode={statsWeeksMode}
                    onWeeksModeChange={setStatsWeeksMode}
                    h2hTeamId={effectiveStatsH2hTeamId}
                    onH2hTeamChange={setStatsH2hTeamId}
                  />
                )}
              </div>
            </>
          )}

          {/* TCLOT heritage is hidden on thefos: every nav entry point to
              'hall' was removed, so this render is unreachable. Kept so the
              heritage component tree stays wired for any future archive. */}
          {dashboardView === 'hall' ? (
            <HallOfChampions tableRows={tableRows} />
          ) : null}

          {dashboardView === 'players' ? (
            <div className="dashboard-stack">
              <PlayersWorkbench
                leagueEntries={leagueEntries}
                teamsForFormSelect={teamsForFormSelect}
                leagueDataRevision={String(
                  import.meta.env.VITE_LEAGUE_DATA_REVISION ?? '',
                ).trim()}
                logoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
            </div>
          ) : null}

          {dashboardView === 'teamSelection' && (
            <>
              <div className="subview-subnav-strip">
                <div
                  className="subnav subview-subnav-capsule"
                  role="tablist"
                  aria-label="Moves views"
                >
                  <button
                    type="button"
                    role="tab"
                    id="tab-team-selection-waivers"
                    aria-selected={teamSelectionTab === 'waivers'}
                    className={
                      'subnav__tab' +
                      (teamSelectionTab === 'waivers' ? ' subnav__tab--active' : '')
                    }
                    onClick={() => setTeamSelectionTab('waivers')}
                  >
                    Waivers
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="tab-team-selection-trades"
                    aria-selected={teamSelectionTab === 'trades'}
                    className={
                      'subnav__tab' +
                      (teamSelectionTab === 'trades' ? ' subnav__tab--active' : '')
                    }
                    onClick={() => setTeamSelectionTab('trades')}
                  >
                    Trades
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="tab-team-selection-draft"
                    aria-selected={teamSelectionTab === 'draft'}
                    className={
                      'subnav__tab' +
                      (teamSelectionTab === 'draft' ? ' subnav__tab--active' : '')
                    }
                    onClick={() => setTeamSelectionTab('draft')}
                  >
                    Draft
                  </button>
                </div>
              </div>
              <div className="subview-panel">
              {teamSelectionTab === 'waivers' && (
            <div className="dashboard-stack">
              <ForbiddenWaivers />

              <section className="tile tile--compact" aria-labelledby="all-waivers-heading">
                <div className="tile-head-row tile-head-row--tight">
                  <h2 id="all-waivers-heading" className="tile-title tile-title--sm">
                    Weekly waivers
                  </h2>
                </div>
                <div id="waiver-feed-panel" role="region" aria-labelledby="all-waivers-heading">
                  <WeeklyWaivers
                    groups={waiversForSelectedGw.groups}
                    teamLogoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                    gwPill={
                      waiverGwPickerOptions.length > 0 ? (
                        <CompactSelectPill
                          label={mobileLayout ? undefined : 'GW'}
                          ariaLabel="Waivers game week"
                          align="right"
                          isActive={false}
                          value={String(waiverGwEffective)}
                          onChange={(next) => setWaiverGwView(Number(next))}
                          options={waiverGwPickerOptions.map((gw) => ({
                            value: String(gw),
                            label: mobileLayout
                              ? gameWeekShortLabel(gw)
                              : gameWeekSelectLabel(gw),
                          }))}
                        />
                      ) : null
                    }
                    summaryView={
                      <WaiverSummaryShare
                        gw={waiversForSelectedGw.gw}
                        groups={waiversForSelectedGw.groups}
                        leagueTitleAbbr={LEAGUE_TITLE_ABBR}
                        leagueTitle={leagueTitle(seasonCatalog.current)}
                        teamLogoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                        showGwPicker={false}
                      />
                    }
                    emptyMessage={
                      waiverOutGwRows.length ? (
                        <>No waiver or free-agency activity in GW {waiverGwEffective}.</>
                      ) : (
                        <>First waivers are on Thursday 20th</>
                      )
                    }
                  />
                </div>
              </section>

              <section className="tile tile--compact" aria-labelledby="first-waiver-picks-heading">
                <div className="tile-head-row tile-head-row--tight">
                  <h2 id="first-waiver-picks-heading" className="tile-title tile-title--sm">
                    First Waiver Picks
                  </h2>
                </div>
                <p className="tile-hint muted tile-hint--tight">
                  Who held waiver slot #1 each gameweek — newest first.
                </p>
                <FirstWaiverPicks
                  rows={firstWaiverOrderPicks}
                  teamLogoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                  emptyMessage={<>First waivers are on Thursday 20th</>}
                />
              </section>

          <section className="tile tile--compact" aria-labelledby="waiver-pickups-heading">
            <div className="tile-head-row tile-head-row--tight">
              <h2 id="waiver-pickups-heading" className="tile-title tile-title--sm">
                Best pickups &amp; Most waivered
              </h2>
            </div>
            <WaiverPickupsToggle
              bestRows={waiverInTenureTopRows}
              mostRows={mostWaiveredPlayers}
              teamLogoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
              emptyMessage={<>First waivers are on Thursday 20th</>}
            />
          </section>

          <section className="tile tile--compact" aria-labelledby="waiver-totals-heading">
            <div className="tile-head-row tile-head-row--tight">
              <h2 id="waiver-totals-heading" className="tile-title tile-title--sm">
                Waiver in / out — team totals
              </h2>
            </div>
            <WaiverTotalsToggle
              waiverInPointsByTeam={waiverInPointsByTeam}
              waiverOutPointsByTeam={waiverOutPointsByTeam}
              teamLogoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
            />
          </section>
            </div>
              )}

              {teamSelectionTab === 'trades' && (
            <div className="dashboard-stack">
              <section className="tile tile--compact" aria-labelledby="trades-heading">
                <h2 id="trades-heading" className="tile-title tile-title--sm">
                  Trades
                </h2>
                {tradesPanelRows?.length ? (
                  <div className="trades-list trades-list--h2h">
                    {tradesPanelRows.map((trade) => (
                      <TradeCardArticle
                        key={trade.id}
                        trade={trade}
                        teamLogoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="muted muted--tight">No Trades yet (man up lads)</p>
                )}
              </section>
              {tradesPanelRows?.length ? (
                <TradeLedger
                  trades={tradesPanelRows}
                  teamLogoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                />
              ) : null}
            </div>
              )}

              {teamSelectionTab === 'draft' && (
            <div className="dashboard-stack">
              <DraftBoard
                league={data?.league}
                leagueEntries={leagueEntries}
                tableRows={tableRows}
                teamLogoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
            </div>
              )}

              </div>
            </>
          )}

          {dashboardView === 'more' ? (
            <DashboardMorePanel
              onNavigate={selectDashboardView}
              badgeTeams={teamsForFormSelect}
              teamLogoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
            />
          ) : null}

          {dashboardView === 'settings' ? (
            <SettingsPage
              themePref={themePref}
              onThemePrefChange={setThemePref}
              defaultTab={defaultTabPref}
              onDefaultTabChange={setDefaultTabPref}
            />
          ) : null}

          {dashboardView === 'fplLive' && (
            <section
              className="tile tile--compact tile--team-selection"
              aria-label="FPL Live"
            >
              <div className="section-chrome section-chrome--sticky">
              {/* FPL Live sub-nav — variant A (text-only segmented control) from the
                  SUB-NAV · FPL LIVE mockup showcase. "Live GW" carries a pulsing-dot
                  prefix (same icon family as the main nav's FPL Live tab, scaled to
                  ~12px). See `.subnav*` rules in App.css. */}
              <div
                className="subnav"
                role="tablist"
                aria-label="FPL Live views"
              >
                <button
                  type="button"
                  role="tab"
                  id="tab-fpl-live-scores"
                  aria-selected={fplLiveTab === 'live'}
                  className={
                    'subnav__tab' +
                    (fplLiveTab === 'live' ? ' subnav__tab--active' : '')
                  }
                  onClick={() => setFplLiveTab('live')}
                >
                  Scores
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-fpl-live-squads"
                  aria-selected={fplLiveTab === 'squads'}
                  className={
                    'subnav__tab' +
                    (fplLiveTab === 'squads' ? ' subnav__tab--active' : '')
                  }
                  onClick={() => setFplLiveTab('squads')}
                >
                  Lineups
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-fpl-live-recap"
                  aria-selected={fplLiveTab === 'recap'}
                  className={
                    'subnav__tab' +
                    (fplLiveTab === 'recap' ? ' subnav__tab--active' : '')
                  }
                  onClick={() => setFplLiveTab('recap')}
                >
                  Recap
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-fpl-live-predictions"
                  aria-selected={fplLiveTab === 'predictions'}
                  className={
                    'subnav__tab' +
                    (fplLiveTab === 'predictions' ? ' subnav__tab--active' : '')
                  }
                  onClick={() => setFplLiveTab('predictions')}
                >
                  Predictions
                </button>
              </div>
              </div>
              <div className="section-body">
              {fplLiveTab === 'squads' ? (
                <PremWindow
                  teams={teamsForFormSelect}
                  gameweek={liveGameweek}
                  onGameweekChange={setLiveGw}
                  onBootstrapLiveMeta={onBootstrapLiveMeta}
                  teamLogoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                />
              ) : null}
              {fplLiveTab === 'live' ? (
                <LiveScores
                  teams={teamsForFormSelect}
                  tableRows={tableRows}
                  matches={matches ?? []}
                  gameweek={liveGameweek}
                  onGameweekChange={setLiveGw}
                  onBootstrapLiveMeta={onBootstrapLiveMeta}
                  teamLogoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                  leagueId={data?.league?.id ?? null}
                  waiverOutGwRows={waiverOutGwRows}
                  fplDraftCurrentGw={mergedFplCalendarCurrent ?? fplLiveLandingGw}
                  liveStatus={brandHeaderStatus}
                  compactMobileChrome
                />
              ) : null}
              {fplLiveTab === 'recap' ? (
                <div className="dashboard-stack">
                  <WeeklyRecap
                    teamLogoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                </div>
              ) : null}
              {fplLiveTab === 'predictions' ? (
                <div className="dashboard-stack">
                  <SeasonPredictions
                    teamLogoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                </div>
              ) : null}
              </div>
            </section>
          )}

        </div>
      </main>
      <MobileBottomNav
        dashboardView={dashboardView}
        onSelect={selectDashboardView}
        onCenterSelect={selectLiveHub}
        liveStatus={brandHeaderStatus}
        navLocked={draftGate.navLocked}
      />
      <LeagueInfoModal
        open={leagueInfoOpen}
        onClose={() => setLeagueInfoOpen(false)}
        leagueEntries={leagueEntries}
        teamLogoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
        gw={liveGameweek}
        themePref={themePref}
        onThemePrefChange={setThemePref}
        defaultTab={defaultTabPref}
        onDefaultTabChange={setDefaultTabPref}
      />
    </div>
    </PlayerHistoryProvider>
    </TeamDetailOverlayProvider>
    </PlayerDetailOverlayProvider>
  )
}

export default App
