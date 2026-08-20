import { useMemo, useState } from 'react'
import { TeamAvatar } from './TeamAvatar'
import { PlayerKit } from './PlayerKit.jsx'
import { ClickablePlayerName } from './PlayerHistoryContext.jsx'
import { firstWord } from './teamNameUtils.js'
import { useMobileLayout } from './usePortraitMobile.js'
import { flattenWaiverGroups, sortMovesWaiverThenFa } from './waiverMovesSort.js'
import './WaiversPanel.css'

/* =================================================================== */
/* Waivers panel — production port of the locked `mockup-wv-*` redesign */
/* (Mockup.jsx → Moves › Waivers). Real league data + real crests:      */
/*  • player CLUB crests  → <PlayerKit badgeUrl> (official PL badge URL) */
/*  • fantasy-team crests → <TeamAvatar> (team logo atom)               */
/*  • position chips      → element_type-derived pos (GKP/DEF/MID/FWD)  */
/*  • clickable names     → <ClickablePlayerName> (tap-to-detail)       */
/* =================================================================== */

/** Boxed short-position badge (GKP/DEF/MID/FWD) beside the player name —
 *  same recipe as the player-detail hero badge (`.pdetail-p__hero-pos`). */
function WvPosChip({ pos }) {
  if (!pos) return null
  const label = String(pos).toUpperCase()
  return (
    <span
      className={`waivers-pos-chip waivers-pos-chip--${label}`}
      title={label}
      aria-label={label}
    >
      {label}
    </span>
  )
}

/** Player's real PL club crest (reuses PlayerKit badge rendering + fallback). */
function ClubCrest({ badgeUrl, teamShort, size = 22, out = false }) {
  return (
    <span
      className={out ? 'waivers-crest waivers-crest--out' : 'waivers-crest'}
      style={{ width: size, height: size }}
    >
      <PlayerKit badgeUrl={badgeUrl} teamShort={teamShort} />
    </span>
  )
}

/** Identity cell: optional in/out arrow + club crest + clickable name + position chip.
 *  Reads left-to-right as: arrow · club badge · name · position chip. */
function WvPlayerCell({ element, name, badgeUrl, teamShort, pos, dir }) {
  return (
    <span className="waivers-player">
      {dir ? (
        <span className={`waivers-dir waivers-dir--${dir}`} aria-hidden="true">
          {dir === 'in' ? '↑' : '↓'}
        </span>
      ) : null}
      <ClubCrest badgeUrl={badgeUrl} teamShort={teamShort} size={22} out={dir === 'out'} />
      <ClickablePlayerName
        element={element}
        web_name={name}
        teamShort={teamShort}
        className="waivers-player__name"
      >
        {name}
      </ClickablePlayerName>
      <WvPosChip pos={pos} />
    </span>
  )
}

const moveOrderKey = (m) =>
  m.waiverProcessOrder == null || !Number.isFinite(Number(m.waiverProcessOrder))
    ? Infinity
    : Number(m.waiverProcessOrder)

/** `#` cell — league-wide waiver order, or an inline FA tag for free agency. */
function WvOrderCell({ move }) {
  return move.waiverProcessOrder != null &&
    Number.isFinite(Number(move.waiverProcessOrder)) ? (
    <span className="tabular">{move.waiverProcessOrder}</span>
  ) : (
    <span className="waivers-fa-tag">FA</span>
  )
}

/* ── Section 1 · Weekly waivers ─────────────────────────────────────── */

/** Desktop flat swap table with an "All swaps" ↔ "By team" grouping filter.
 *  `gwPill` (optional node) renders inline on the same row as the toggle. */
function WeeklyWaiversTable({ groups, teamLogoMap, kitIndexByEntry, gwPill }) {
  const [group, setGroup] = useState('flat')

  const flatRows = useMemo(() => {
    const rows = flattenWaiverGroups(groups)
    return [...rows].sort(sortMovesWaiverThenFa)
  }, [groups])

  const groupedTeams = useMemo(
    () =>
      [...groups]
        .map((g) => ({
          ...g,
          moves: [...(g.moves || [])].sort(sortMovesWaiverThenFa),
        }))
        .sort((a, b) => {
          const am = Math.min(...a.moves.map(moveOrderKey))
          const bm = Math.min(...b.moves.map(moveOrderKey))
          return am - bm
        }),
    [groups],
  )

  return (
    <div className="waivers-weekly">
      <div className="waivers-weekly__bar">
        <div
          className="waivers-toggle waivers-toggle--sm"
          role="tablist"
          aria-label="Weekly waivers grouping"
        >
          {[
            { v: 'flat', label: 'All swaps' },
            { v: 'team', label: 'By team' },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              role="tab"
              aria-selected={group === opt.v}
              className={'waivers-toggle__btn' + (group === opt.v ? ' is-active' : '')}
              onClick={() => setGroup(opt.v)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {gwPill ? <span className="waivers-weekly__gw">{gwPill}</span> : null}
      </div>
      <div className="waivers-table-wrap">
        <table
          className={
            'waivers-table waivers-weekly__table' +
            (group === 'flat' ? ' waivers-weekly__table--flat' : ' waivers-weekly__table--team')
          }
        >
          <colgroup>
            <col className="waivers-col-num" />
            {group === 'flat' ? <col className="waivers-col-team" /> : null}
            <col className="waivers-col-io" />
            <col className="waivers-col-io" />
          </colgroup>
          <thead>
            <tr>
              <th className="waivers-table__num">#</th>
              {group === 'flat' ? <th>Team</th> : null}
              <th>In</th>
              <th>Out</th>
            </tr>
          </thead>
          {group === 'flat' ? (
            <tbody>
              {flatRows.map((r) => (
                <tr key={r.transactionId}>
                  <td className="waivers-table__num tabular">
                    <WvOrderCell move={r} />
                  </td>
                  <td>
                    <span className="waivers-table__team">
                      <TeamAvatar
                        entryId={r.leagueEntryId}
                        name={r.teamName}
                        size="sm"
                        logoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                      <span className="waivers-table__team-name">{firstWord(r.teamName)}</span>
                    </span>
                  </td>
                  <td>
                    <WvPlayerCell
                      element={r.element_in}
                      name={r.pickedName}
                      badgeUrl={r.pickedBadgeUrl}
                      teamShort={r.pickedTeamShort}
                      pos={r.pickedPos}
                      dir="in"
                    />
                  </td>
                  <td>
                    <WvPlayerCell
                      element={r.element_out}
                      name={r.droppedName}
                      badgeUrl={r.droppedBadgeUrl}
                      teamShort={r.droppedTeamShort}
                      pos={r.droppedPos}
                      dir="out"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          ) : (
            groupedTeams.map((g) => (
              <tbody className="waivers-weekly__group" key={g.entry}>
                <tr className="waivers-weekly__grouphead">
                  <td className="waivers-table__num waivers-weekly__grouphead-crest">
                    <TeamAvatar
                      entryId={g.leagueEntryId}
                      name={g.teamName}
                      size="sm"
                      logoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                    />
                  </td>
                  <td colSpan={2}>
                    <span className="waivers-weekly__groupname">{g.teamName}</span>
                  </td>
                </tr>
                {g.moves.map((m) => (
                  <tr key={m.transactionId}>
                    <td className="waivers-table__num tabular">
                      <WvOrderCell move={m} />
                    </td>
                    <td>
                      <WvPlayerCell
                        element={m.element_in}
                        name={m.pickedName}
                        badgeUrl={m.pickedBadgeUrl}
                        teamShort={m.pickedTeamShort}
                        pos={m.pickedPos}
                        dir="in"
                      />
                    </td>
                    <td>
                      <WvPlayerCell
                        element={m.element_out}
                        name={m.droppedName}
                        badgeUrl={m.droppedBadgeUrl}
                        teamShort={m.droppedTeamShort}
                        pos={m.droppedPos}
                        dir="out"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            ))
          )}
        </table>
      </div>
    </div>
  )
}

/** Mobile · at-a-glance by team — per-team summary, tap a row to expand its swaps. */
function WeeklyWaiversGlance({ groups, teamLogoMap, kitIndexByEntry }) {
  const MAX_CRESTS = 5
  const [open, setOpen] = useState(() => new Set())
  const toggle = (entry) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(entry)) next.delete(entry)
      else next.add(entry)
      return next
    })
  return (
    <ul className="waivers-glance__list">
      {groups.map((g) => {
        const ins = g.moves || []
        const shownCrests = ins.slice(0, MAX_CRESTS)
        const extraCrests = ins.length - shownCrests.length
        const hasMoves = ins.length > 0
        const isOpen = hasMoves && open.has(g.entry)
        return (
          <li className="waivers-glance__item" key={g.entry}>
            <button
              type="button"
              className={'waivers-glance__row' + (isOpen ? ' is-open' : '')}
              aria-expanded={hasMoves ? isOpen : undefined}
              disabled={!hasMoves}
              onClick={() => hasMoves && toggle(g.entry)}
            >
              <TeamAvatar
                entryId={g.leagueEntryId}
                name={g.teamName}
                size="sm"
                logoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
              <span className="waivers-glance__team">{firstWord(g.teamName)}</span>
              {hasMoves ? (
                <>
                  <span className="waivers-glance__crests">
                    {shownCrests.map((m) => (
                      <span className="waivers-glance__crest" key={m.transactionId}>
                        <PlayerKit badgeUrl={m.pickedBadgeUrl} teamShort={m.pickedTeamShort} />
                      </span>
                    ))}
                    {extraCrests > 0 ? (
                      <span className="waivers-glance__crest-more">+{extraCrests}</span>
                    ) : null}
                  </span>
                  <span className="waivers-glance__counts">
                    <span
                      className="waivers-glance__count waivers-pts"
                      aria-label={`${ins.length} ${ins.length === 1 ? 'move' : 'moves'}`}
                    >
                      {ins.length}
                    </span>
                  </span>
                  <span
                    className={'waivers-glance__caret' + (isOpen ? ' is-open' : '')}
                    aria-hidden="true"
                  >
                    ›
                  </span>
                </>
              ) : (
                <span className="waivers-glance__none">No moves</span>
              )}
            </button>
            {isOpen ? (
              <div className="waivers-glance__moves">
                {ins.map((m) => (
                  <div className="waivers-swap" key={m.transactionId}>
                    <WvPlayerCell
                      element={m.element_in}
                      name={m.pickedName}
                      badgeUrl={m.pickedBadgeUrl}
                      teamShort={m.pickedTeamShort}
                      pos={m.pickedPos}
                      dir="in"
                    />
                    <WvPlayerCell
                      element={m.element_out}
                      name={m.droppedName}
                      badgeUrl={m.droppedBadgeUrl}
                      teamShort={m.droppedTeamShort}
                      pos={m.droppedPos}
                      dir="out"
                    />
                    {m.transactionKind === 'f' ? (
                      <span className="waivers-fa-chip">FA</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Mobile · tap-a-team-to-expand tiles. */
function WeeklyWaiversTiles({ groups, teamLogoMap, kitIndexByEntry }) {
  const [open, setOpen] = useState(() => new Set())
  const toggle = (entry) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(entry)) next.delete(entry)
      else next.add(entry)
      return next
    })

  return (
    <div className="waivers-weekly-grid waivers-weekly-grid--compact">
      {groups.map((g) => {
        const isOpen = open.has(g.entry)
        const teamOrder = Math.min(...(g.moves || []).map(moveOrderKey))
        return (
          <article className="waivers-weekly-tile" key={g.entry}>
            <button
              type="button"
              className="waivers-weekly-tile__head"
              aria-expanded={isOpen}
              onClick={() => toggle(g.entry)}
            >
              {Number.isFinite(teamOrder) ? (
                <span
                  className="waivers-weekly-tile__rank tabular"
                  title="First waiver run order this GW (1 = first)"
                >
                  {teamOrder}
                </span>
              ) : (
                <span className="waivers-weekly-tile__rank waivers-weekly-tile__rank--empty" aria-hidden="true" />
              )}
              <TeamAvatar
                entryId={g.leagueEntryId}
                name={g.teamName}
                size="sm"
                logoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
              <span className="waivers-weekly-tile__team">{g.teamName}</span>
              <span className="waivers-weekly-tile__count muted">
                {(g.moves || []).length}
              </span>
              <span className={'waivers-weekly-tile__caret' + (isOpen ? ' is-open' : '')} aria-hidden="true">
                ›
              </span>
            </button>
            {isOpen ? (
              <div className="waivers-weekly-tile__moves">
                {(g.moves || []).map((m) => (
                  <div className="waivers-swap" key={m.transactionId}>
                    <WvPlayerCell
                      element={m.element_in}
                      name={m.pickedName}
                      badgeUrl={m.pickedBadgeUrl}
                      teamShort={m.pickedTeamShort}
                      pos={m.pickedPos}
                      dir="in"
                    />
                    <WvPlayerCell
                      element={m.element_out}
                      name={m.droppedName}
                      badgeUrl={m.droppedBadgeUrl}
                      teamShort={m.droppedTeamShort}
                      pos={m.droppedPos}
                      dir="out"
                    />
                    {m.transactionKind === 'f' ? (
                      <span className="waivers-fa-chip">FA</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

/**
 * Section 1 wrapper.
 *  • Desktop: flat / by-team swap table (toggle + inline GW pill).
 *  • Mobile: a segmented toggle of "At a glance" · "By team" · "Waiver summary"
 *    (the share view, folded in here so there's no separate top-level pill).
 * `gwPill` renders inline beside the toggle; `summaryView` is the share card.
 */
export function WeeklyWaivers({
  groups,
  teamLogoMap,
  kitIndexByEntry,
  emptyMessage,
  gwPill,
  summaryView,
}) {
  const isMobile = useMobileLayout()
  const [mobileView, setMobileView] = useState('glance')

  const hasGroups = Boolean(groups && groups.length > 0)

  if (isMobile) {
    const options = [
      { v: 'glance', label: 'At a glance' },
      { v: 'tiles', label: 'By team' },
      ...(summaryView ? [{ v: 'summary', label: 'Waiver summary' }] : []),
    ]
    return (
      <div className="waivers-weekly-mobile">
        <div className="waivers-weekly__bar">
          <div
            className="waivers-toggle waivers-toggle--sm"
            role="tablist"
            aria-label="Weekly waivers mobile view"
          >
            {options.map((opt) => (
              <button
                key={opt.v}
                type="button"
                role="tab"
                aria-selected={mobileView === opt.v}
                className={'waivers-toggle__btn' + (mobileView === opt.v ? ' is-active' : '')}
                onClick={() => setMobileView(opt.v)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {gwPill ? <span className="waivers-weekly__gw">{gwPill}</span> : null}
        </div>
        {mobileView === 'summary' ? (
          summaryView
        ) : !hasGroups ? (
          <p className="muted muted--tight">{emptyMessage}</p>
        ) : mobileView === 'glance' ? (
          <WeeklyWaiversGlance
            groups={groups}
            teamLogoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
          />
        ) : (
          <WeeklyWaiversTiles
            groups={groups}
            teamLogoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
          />
        )}
      </div>
    )
  }

  if (!hasGroups) {
    return (
      <div className="waivers-weekly">
        {gwPill ? (
          <div className="waivers-weekly__bar waivers-weekly__bar--empty">
            <span className="waivers-weekly__gw">{gwPill}</span>
          </div>
        ) : null}
        <p className="muted muted--tight">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <WeeklyWaiversTable
      groups={groups}
      teamLogoMap={teamLogoMap}
      kitIndexByEntry={kitIndexByEntry}
      gwPill={gwPill}
    />
  )
}

/* ── Section 2 · Waiver in / out team totals — condensed toggle ─────── */
export function WaiverTotalsToggle({
  waiverInPointsByTeam = [],
  waiverOutPointsByTeam = [],
  teamLogoMap,
  kitIndexByEntry,
}) {
  const [mode, setMode] = useState('in')
  const rows = useMemo(() => {
    const mapped =
      mode === 'in'
        ? waiverInPointsByTeam.map((r) => ({
            league_entry: r.league_entry,
            teamName: r.teamName,
            value: r.totalWaiverInPoints,
            count: r.waiverInCount,
            avg: r.averageWaiverInPerPlayer ?? 0,
          }))
        : waiverOutPointsByTeam.map((r) => ({
            league_entry: r.league_entry,
            teamName: r.teamName,
            value: r.totalDroppedGwPoints,
            count: r.waiverOutCount,
            avg: r.averageDroppedGwPoints ?? 0,
          }))
    return mapped.sort((a, b) => b.value - a.value)
  }, [mode, waiverInPointsByTeam, waiverOutPointsByTeam])
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0)

  return (
    <div className="waivers-totals">
      <div className="waivers-toggle" role="tablist" aria-label="Waiver totals direction">
        {[
          { v: 'in', label: 'Waivered in' },
          { v: 'out', label: 'Waived out' },
        ].map((opt) => (
          <button
            key={opt.v}
            type="button"
            role="tab"
            aria-selected={mode === opt.v}
            className={'waivers-toggle__btn' + (mode === opt.v ? ' is-active' : '')}
            onClick={() => setMode(opt.v)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="waivers-totals__hint">
        {mode === 'in'
          ? 'Total FPL points scored by every player a team waivered in, from pickup until they left.'
          : 'Sum of dropped players’ GW points in the week each waiver hit (lower = cleaner exits).'}
      </p>
      <ol className="waivers-bars">
        <li className="waivers-bar-row waivers-bars-head" aria-hidden="true">
          <span />
          <span className="waivers-bar-row__team">Team</span>
          <span className="waivers-bar-row__track-head">
            {mode === 'in' ? 'Points in' : 'Points out'}
          </span>
          <span className="waivers-bar-row__val">Pts</span>
          <span className="waivers-bar-row__col">{mode === 'in' ? 'In' : 'Out'}</span>
          <span className="waivers-bar-row__col">Avg</span>
        </li>
        {rows.map((r) => {
          const pct = max > 0 ? Math.round((r.value / max) * 100) : 0
          return (
            <li className="waivers-bar-row" key={r.league_entry}>
              <TeamAvatar
                entryId={r.league_entry}
                name={r.teamName}
                size="sm"
                logoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
              <span className="waivers-bar-row__team" title={r.teamName}>
                {r.teamName}
              </span>
              <span className="waivers-bar-row__track">
                <span className="waivers-bar-row__fill" style={{ width: pct + '%' }} />
              </span>
              <span className="waivers-bar-row__val tabular">{r.value}</span>
              <span className="waivers-bar-row__col tabular muted">{r.count}</span>
              <span className="waivers-bar-row__col tabular muted">
                {Number(r.avg).toFixed(1)}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ── Section 3 · First waiver picks tracker — fixed-height scroll ─────── */
export function FirstWaiverPicks({ rows = [], teamLogoMap, kitIndexByEntry, emptyMessage }) {
  if (!rows.length) return <p className="muted muted--tight">{emptyMessage}</p>
  return (
    <div className="waivers-first">
      {/* Fixed-height scroller: all GWs are present and scroll within the box
       *  (sticky header), so no "show all" expander is needed. */}
      <div className="waivers-first__scroll">
        <table className="waivers-table waivers-first__table">
          <colgroup>
            <col className="waivers-first__col-gw" />
            <col className="waivers-first__col-pick" />
            <col className="waivers-first__col-player" />
            <col className="waivers-first__col-pts" />
          </colgroup>
          <thead>
            <tr>
              <th className="waivers-table__num">GW</th>
              <th className="waivers-first__pick-head">Pick</th>
              <th>Player</th>
              <th className="waivers-table__num">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.gameweek}>
                <td className="waivers-table__num tabular fw-700">{r.gameweek}</td>
                <td className="waivers-first__pick">
                  <TeamAvatar
                    entryId={r.leagueEntryId}
                    name={r.teamName}
                    size="sm"
                    logoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                </td>
                <td>
                  <WvPlayerCell
                    element={r.element_in}
                    name={r.pickedName}
                    badgeUrl={r.pickedBadgeUrl}
                    teamShort={r.pickedTeamShort}
                    pos={r.pickedPos}
                  />
                </td>
                <td className="waivers-table__num tabular">
                  <span className="waivers-pts">
                    {r.pickedUpPlayerGwPoints != null ? r.pickedUpPlayerGwPoints : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Section 4 · Best pickups + Most waivered — combined toggle ─────── */
export function WaiverPickupsToggle({
  bestRows = [],
  mostRows = [],
  teamLogoMap,
  kitIndexByEntry,
  emptyMessage,
}) {
  const [mode, setMode] = useState('best')
  const list = mode === 'best' ? bestRows : mostRows
  if (!bestRows.length && !mostRows.length) {
    return <p className="muted muted--tight">{emptyMessage}</p>
  }
  return (
    <div className="waivers-pickups">
      <div className="waivers-toggle" role="tablist" aria-label="Pickup leaderboard mode">
        {[
          { v: 'best', label: 'Best pickups' },
          { v: 'most', label: 'Most waivered' },
        ].map((opt) => (
          <button
            key={opt.v}
            type="button"
            role="tab"
            aria-selected={mode === opt.v}
            className={'waivers-toggle__btn' + (mode === opt.v ? ' is-active' : '')}
            onClick={() => setMode(opt.v)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="waivers-totals__hint">
        {mode === 'best'
          ? 'Top player–team pairs by total FPL points from each waiver-in until they left the squad.'
          : 'Players claimed off waivers by the most distinct teams this season.'}
      </p>
      <ol className="waivers-rank-list">
        {mode === 'best'
          ? list.map((r, i) => (
              <li
                className="waivers-rank-row waivers-rank-row--best"
                key={`${r.entry}-${r.elementId}`}
              >
                <span className="waivers-rank-row__rank tabular">{r.rank ?? i + 1}</span>
                <WvPlayerCell
                  element={r.elementId}
                  name={r.playerName}
                  badgeUrl={r.badgeUrl}
                  teamShort={r.teamShort}
                  pos={r.pos}
                />
                <span className="waivers-rank-row__meta">
                  <span className="waivers-rank-row__owner-name">{firstWord(r.teamName)}</span>
                  <span className="waivers-rank-row__range muted">
                    GW {r.firstGw}–{r.lastGw}
                    {r.waiverStints > 1 ? ` · ${r.waiverStints}×` : ''}
                  </span>
                </span>
                <span className="waivers-pts waivers-pts--lg">{r.totalPointsForTeam}</span>
                <span className="waivers-rank-row__crest">
                  <TeamAvatar
                    entryId={r.leagueEntryId}
                    name={r.teamName}
                    size="sm"
                    logoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                </span>
              </li>
            ))
          : list.map((r, i) => (
              <li className="waivers-rank-row" key={r.elementId}>
                <span className="waivers-rank-row__rank tabular">{i + 1}</span>
                <WvPlayerCell
                  element={r.elementId}
                  name={r.web_name}
                  badgeUrl={r.badgeUrl}
                  teamShort={r.teamShort}
                  pos={r.pos}
                />
                <span aria-hidden />
                <span className="waivers-pts waivers-pts--lg">{r.claims}</span>
              </li>
            ))}
      </ol>
    </div>
  )
}
