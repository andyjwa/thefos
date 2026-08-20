import { useMemo, useState, Fragment } from 'react'
import { useDraftBoard } from './useDraftBoard'
import { TeamAvatar } from './TeamAvatar'
import { DraftQuality } from './DraftQuality'
import { ClickablePlayerName } from './PlayerHistoryContext.jsx'
import { compareLeagueEntriesByDraftSlot, minOverallPickByEntryId } from './draftTeamOrder'
import { CompactSelectPill } from './CompactSelectPill.jsx'

const POS_OPTIONS = ['GKP', 'DEF', 'MID', 'FWD']

/** League entry id — same as standings `row.league_entry` (team-logos/, kitIndexByEntry). */
function logoLeagueEntryId(pick, fplToLeagueId) {
  if (pick?.leagueEntryId != null) return pick.leagueEntryId
  const lid = fplToLeagueId.get(pick?.entryId)
  if (lid != null) return lid
  return pick?.entryId
}

/**
 * Compact "where are they now" pill — On squad / Cut · GW# / Traded · GW#.
 * Mirrors the locked draft mockup (green / red / amber dots).
 */
function DraftStatusPill({ pick, compact = false }) {
  if (pick.rosterOnSquad === true) {
    return (
      <span className="draft-status draft-status--kept" title="Still on squad">
        <span className="draft-status__dot" />
        {compact ? 'Squad' : 'On squad'}
      </span>
    )
  }
  if (pick.rosterOnSquad === false) {
    if (pick.rosterLeftGameweek != null) {
      if (pick.rosterLeftKind === 'trade') {
        return (
          <span
            className="draft-status draft-status--traded"
            title={`Traded at Game Week ${pick.rosterLeftGameweek}`}
          >
            <span className="draft-status__dot" />
            Traded · GW{pick.rosterLeftGameweek}
          </span>
        )
      }
      return (
        <span
          className="draft-status draft-status--dropped"
          title={`Dropped at Game Week ${pick.rosterLeftGameweek}`}
        >
          <span className="draft-status__dot" />
          Cut · GW{pick.rosterLeftGameweek}
        </span>
      )
    }
    return (
      <span className="draft-status draft-status--dropped" title="No longer on squad">
        <span className="draft-status__dot" />
        Off squad
      </span>
    )
  }
  return (
    <span className="draft-status draft-status--unknown" title="Status unknown">
      <span className="draft-status__dot" />—
    </span>
  )
}

function ClubBadge({ src, className = 'draft-board-row__club-badge' }) {
  const [hidden, setHidden] = useState(false)
  if (!src || hidden) return null
  return (
    <img
      src={src}
      alt=""
      className={className}
      width={22}
      height={22}
      loading="lazy"
      decoding="async"
      onError={() => setHidden(true)}
    />
  )
}

export function DraftBoard({
  league,
  leagueEntries,
  tableRows = [],
  teamLogoMap = {},
  kitIndexByEntry = {},
}) {
  const { picks, loading, error, source, startGw } = useDraftBoard(
    league,
    leagueEntries,
  )

  /** FPL `entry_id` → season points For (standings), for Draft Quality +/- vs drafted squad. */
  const pointsForByFplEntryId = useMemo(() => {
    const gfByLeagueEntry = new Map()
    for (const r of tableRows) {
      if (r?.league_entry == null) continue
      const gf = Number(r.gf)
      if (!Number.isFinite(gf)) continue
      gfByLeagueEntry.set(Number(r.league_entry), gf)
    }
    const m = new Map()
    for (const e of leagueEntries || []) {
      const fid = e?.entry_id
      const lid = e?.id
      if (fid == null || lid == null) continue
      const g = gfByLeagueEntry.get(Number(lid))
      if (g != null) m.set(Number(fid), g)
    }
    return m
  }, [tableRows, leagueEntries])

  const [teamFilter, setTeamFilter] = useState('')
  const [roundFilter, setRoundFilter] = useState('')
  const [posFilter, setPosFilter] = useState('')

  const fplToLeagueEntryId = useMemo(() => {
    const m = new Map()
    for (const e of leagueEntries || []) {
      if (e?.entry_id != null && e?.id != null) {
        m.set(e.entry_id, e.id)
      }
    }
    return m
  }, [leagueEntries])

  const teamOptions = useMemo(() => {
    const rows = [...(leagueEntries || [])]
    const minBy = minOverallPickByEntryId(picks)
    rows.sort((a, b) => compareLeagueEntriesByDraftSlot(a, b, minBy))
    return rows.map((e) => ({
      value: String(e.entry_id),
      label: String(e.entry_name ?? '').trim() || `Team ${e.entry_id}`,
    }))
  }, [leagueEntries, picks])

  /** Whole draft ran on FPL auto-pick (nobody drafted) — board shows system picks. */
  const allAutoDraft = useMemo(
    () => picks.length > 0 && picks.every((p) => p.wasAuto === true),
    [picks],
  )

  const maxRound = useMemo(() => {
    let m = 0
    for (const p of picks) {
      if (p.round > m) m = p.round
    }
    return m || 15
  }, [picks])

  const filteredPicks = useMemo(() => {
    return picks.filter((p) => {
      if (teamFilter && String(p.entryId) !== teamFilter) return false
      if (roundFilter && String(p.round) !== roundFilter) return false
      if (posFilter && String(p.pos) !== posFilter) return false
      return true
    })
  }, [picks, teamFilter, roundFilter, posFilter])

  /** Columns = teams in draft-slot order (earliest overall pick first). */
  const teamColumns = useMemo(() => {
    const byEntry = new Map()
    for (const p of filteredPicks) {
      const c = byEntry.get(p.entryId)
      if (!c) {
        byEntry.set(p.entryId, {
          entryId: p.entryId,
          leagueEntryId: p.leagueEntryId,
          teamName: p.teamName,
          minPick: p.overallPick,
        })
      } else if (p.overallPick < c.minPick) {
        c.minPick = p.overallPick
      }
    }
    return [...byEntry.values()].sort((a, b) => a.minPick - b.minPick)
  }, [filteredPicks])

  /** `${entryId}:${round}` → pick, for grid-cell lookup. */
  const cellByKey = useMemo(() => {
    const m = new Map()
    for (const p of filteredPicks) m.set(`${p.entryId}:${p.round}`, p)
    return m
  }, [filteredPicks])

  /** Rounds that actually have picks after filtering (no empty rows). */
  const roundsToShow = useMemo(() => {
    const s = new Set(filteredPicks.map((p) => p.round))
    return [...s].sort((a, b) => a - b)
  }, [filteredPicks])

  function renderPlayerName(p, label) {
    return (
      <ClickablePlayerName
        element={p.element}
        displayName={p.playerFullName ?? p.playerName}
        web_name={p.playerName}
        teamShort={p.teamShort}
      >
        {label}
      </ClickablePlayerName>
    )
  }

  return (
    <Fragment>
      <section
        className="tile tile--standings draft-board-tile"
        aria-labelledby="draft-board-heading"
      >
        <div className="tile-head-row tile-head-row--tight draft-board-tile__head">
          <div className="draft-board-title-inline">
            <h2
              id="draft-board-heading"
              className="tile-title tile-title--sm draft-board-tile__title"
            >
              Draft
            </h2>
            <div className="draft-board-filter-scroll">
              <div className="draft-board-filters" role="group" aria-label="Draft filters">
                <CompactSelectPill
                  className="draft-board-filter-pill"
                  label="Team"
                  ariaLabel="Filter by team"
                  value={teamFilter}
                  onChange={(next) => setTeamFilter(String(next))}
                  isActive={teamFilter !== ''}
                  disabled={!teamOptions.length}
                  options={[
                    { value: '', label: 'All' },
                    ...teamOptions.map((o) => ({ value: o.value, label: o.label })),
                  ]}
                />
                <CompactSelectPill
                  className="draft-board-filter-pill"
                  label="Round"
                  ariaLabel="Filter by round"
                  value={roundFilter}
                  onChange={(next) => setRoundFilter(String(next))}
                  isActive={roundFilter !== ''}
                  disabled={!picks.length}
                  options={[
                    { value: '', label: 'All' },
                    ...Array.from({ length: maxRound }, (_, i) => i + 1).map((r) => ({
                      value: String(r),
                      label: `Round ${r}`,
                    })),
                  ]}
                />
                <CompactSelectPill
                  className="draft-board-filter-pill"
                  label="Pos"
                  ariaLabel="Filter by position"
                  value={posFilter}
                  onChange={(next) => setPosFilter(String(next))}
                  isActive={posFilter !== ''}
                  disabled={!picks.length}
                  options={[
                    { value: '', label: 'All' },
                    ...POS_OPTIONS.map((pos) => ({ value: pos, label: pos })),
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="data-banner data-banner--error draft-board-banner" role="alert">
            <strong>Could not load draft.</strong> {error}{' '}
            <span className="muted">
              Add <code>draft_picks.json</code> under league-data, set{' '}
              <code>VITE_FPL_PROXY_URL</code>, or open from an environment where the draft API is
              reachable.
            </span>
          </div>
        ) : null}

        {loading ? (
          <p className="muted draft-board-loading">Loading draft…</p>
        ) : !picks.length && !error ? (
          <p className="muted draft-board-loading">No draft data.</p>
        ) : (
          <>
            {allAutoDraft ? (
              <div className="data-banner draft-board-banner" role="status">
                <strong>FPL auto-drafted this league.</strong> Every pick in FPL&apos;s draft log
                was made by auto-pick when the scheduled draft ran without managers picking, so
                this board shows the squads the system assigned — typically each manager&apos;s
                default position-ordered queue unless they had set a watchlist. To draft for real,
                the league admin must redo the draft on{' '}
                <code>draft.premierleague.com</code> before the season&apos;s first deadline.
              </div>
            ) : null}
            {source === 'api' ? (
              <p className="draft-board-hint muted">
                Order from GW{startGw} squads and snake logic; round-1 slots need{' '}
                <code>draft_round1_order.json</code> — live <code>waiver_pick</code> follows league
                standing, not draft position. Without that file the app uses a neutral entry-id
                fallback (overall pick numbers may not match the real draft). Within-team order uses
                draft rank (approximate for reaches).
              </p>
            ) : null}

            {roundsToShow.length === 0 ? (
              <p className="muted draft-board-loading">No picks match these filters.</p>
            ) : (
              <>
                {/* DESKTOP — snake order grid (columns = teams, rows = rounds) */}
                <div
                  className="draft-grid"
                  role="table"
                  aria-label="Draft board grid"
                >
                  <div
                    className="draft-grid__inner"
                    style={{ '--draft-grid-cols': teamColumns.length }}
                  >
                  <div className="draft-grid__head" role="row">
                    <div className="draft-grid__corner" role="columnheader">
                      RND
                    </div>
                    {teamColumns.map((col) => (
                      <div className="draft-grid__th" role="columnheader" key={col.entryId}>
                        <TeamAvatar
                          entryId={logoLeagueEntryId(col, fplToLeagueEntryId)}
                          name={col.teamName}
                          size="sm"
                          logoMap={teamLogoMap}
                          kitIndexByEntry={kitIndexByEntry}
                        />
                        <span className="draft-grid__th-name">{col.teamName}</span>
                      </div>
                    ))}
                  </div>
                  {roundsToShow.map((round) => (
                    <div className="draft-grid__row" role="row" key={round}>
                      <div className="draft-grid__rnd" role="rowheader">
                        {round}
                      </div>
                      {teamColumns.map((col) => {
                        const p = cellByKey.get(`${col.entryId}:${round}`)
                        if (!p) {
                          return (
                            <div
                              className="draft-grid__cell draft-grid__cell--empty"
                              role="cell"
                              key={col.entryId}
                            />
                          )
                        }
                        return (
                          <div className="draft-grid__cell" role="cell" key={col.entryId}>
                            <span className="draft-grid__pick tabular" title="Overall pick">
                              {p.overallPick}
                            </span>
                            <div className="draft-grid__main">
                              <ClubBadge src={p.badgeUrl} className="draft-grid__club" />
                              <span className="draft-grid__id">
                                <span className="draft-grid__name-line">
                                  <span className="draft-grid__name">
                                    {renderPlayerName(p, p.playerName)}
                                  </span>
                                  {p.pos ? (
                                    <span
                                      className={`draft-pos draft-pos--${p.pos}`}
                                      title={p.pos}
                                      aria-label={p.pos}
                                    >
                                      {p.pos}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                            </div>
                            <div className="draft-grid__foot">
                              <DraftStatusPill pick={p} />
                              <span className="draft-grid__pts tabular" title="Total points">
                                {p.totalPoints != null ? p.totalPoints : '—'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                  </div>
                </div>

                {/* MOBILE — M1 stat list, grouped by round */}
                <div className="draft-rlist">
                  {roundsToShow.map((round) => {
                    const rows = filteredPicks
                      .filter((p) => p.round === round)
                      .sort((a, b) => a.overallPick - b.overallPick)
                    if (!rows.length) return null
                    return (
                      <Fragment key={round}>
                        <div className="draft-rlist__round">Round {round}</div>
                        {rows.map((p) => (
                          <div
                            className="draft-rlist__row"
                            key={`${p.overallPick}-${p.entryId}-${p.element}`}
                          >
                            <span className="draft-rlist__pick tabular">{p.overallPick}</span>
                            <ClubBadge src={p.badgeUrl} className="draft-rlist__club" />
                            <span className="draft-rlist__id">
                              <span className="draft-rlist__name-line">
                                <span className="draft-rlist__name">
                                  {renderPlayerName(p, p.playerName)}
                                </span>
                                {p.pos ? (
                                  <span
                                    className={`draft-pos draft-pos--${p.pos}`}
                                    title={p.pos}
                                    aria-label={p.pos}
                                  >
                                    {p.pos}
                                  </span>
                                ) : null}
                              </span>
                              <span className="draft-rlist__sub">
                                <span className="draft-rlist__team">
                                  <span className="draft-rlist__team-name">
                                    {p.teamName}
                                  </span>
                                </span>
                                <DraftStatusPill pick={p} />
                              </span>
                            </span>
                            <span className="draft-rlist__pts">
                              <span className="draft-rlist__pts-val tabular">
                                {p.totalPoints != null ? p.totalPoints : '—'}
                              </span>
                              <span className="draft-rlist__pts-lbl">PTS</span>
                            </span>
                          </div>
                        ))}
                      </Fragment>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </section>
      <DraftQuality
        picks={picks}
        loading={loading}
        error={error}
        pointsForByFplEntryId={pointsForByFplEntryId}
        teamLogoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
      />
    </Fragment>
  )
}
