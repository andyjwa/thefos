/**
 * Build draft picks from the draft API pick log: `/api/draft/{leagueId}/choices`.
 *
 * Unlike the GW1-squad reconstruction (`draftBoardPicks.js`), the choices feed is the
 * *actual* pick order and — crucially — it exists as soon as the draft completes, while
 * `/api/entry/{id}/event/{gw}` returns 404 until the gameweek starts. Pre-GW1 the
 * reconstruction path cannot work at all, so callers should try choices first.
 */

const POS_SHORT = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }

/**
 * @param {object|null|undefined} raw `/api/draft/{leagueId}/choices` payload (`{ choices: [...] }`)
 * @param {object[]} leagueEntries from details.json (`league_entries`)
 * @param {Map<number, object>} [elementById] bootstrap_draft.elements by id
 * @param {Map<number, object>} [teamById] bootstrap teams by id
 * @returns {object[]|null} picks in draft_picks.json shape, or null when the payload is
 *   unusable (empty, draft incomplete, or entries don't match this league)
 */
export function picksFromDraftChoices(
  raw,
  leagueEntries,
  elementById = new Map(),
  teamById = new Map(),
) {
  const choices = Array.isArray(raw?.choices) ? raw.choices : null
  if (!choices?.length) return null

  const entries = (leagueEntries || []).filter((e) => e?.entry_id != null)
  if (!entries.length) return null

  const byLeagueId = new Map(
    entries.filter((e) => e.id != null).map((e) => [Number(e.id), e]),
  )
  const byFplId = new Map(entries.map((e) => [Number(e.entry_id), e]))

  /** `choices[].entry` is the league_entry id; accept FPL entry_id too (defensive). */
  const entriesAreLeagueIds = choices.every((c) => byLeagueId.has(Number(c?.entry)))
  if (!entriesAreLeagueIds && !choices.every((c) => byFplId.has(Number(c?.entry)))) {
    return null
  }
  const entryFor = (c) =>
    entriesAreLeagueIds ? byLeagueId.get(Number(c.entry)) : byFplId.get(Number(c.entry))

  /** A null/0 element means an un-made pick — draft still in progress; don't build. */
  const complete = choices.every((c) => {
    const el = Number(c?.element)
    return Number.isFinite(el) && el > 0
  })
  if (!complete) return null

  const n = entries.length
  const sorted = [...choices].sort((a, b) => Number(a.index) - Number(b.index))
  return sorted.map((c, i) => {
    const entry = entryFor(c)
    const idx = Number(c.index)
    const overallPick = Number.isFinite(idx) && idx > 0 ? idx : i + 1
    const roundRaw = Number(c.round)
    const round =
      Number.isFinite(roundRaw) && roundRaw > 0 ? roundRaw : Math.ceil(overallPick / n)
    const pickRaw = Number(c.pick)
    const pickInRound =
      Number.isFinite(pickRaw) && pickRaw > 0 ? pickRaw : ((overallPick - 1) % n) + 1
    const elementId = Number(c.element)
    const el = elementById.get(elementId)
    const tm = teamById.get(el?.team)
    const choiceName = [c.player_first_name, c.player_last_name]
      .filter(Boolean)
      .join(' ')
      .trim()
    return {
      overallPick,
      round,
      pickInRound,
      entryId: entry.entry_id,
      leagueEntryId: entry.id ?? null,
      teamName: String(entry.entry_name ?? '').trim() || `Team ${entry.entry_id}`,
      element: elementId,
      playerName: el?.web_name ?? (choiceName || `Player #${elementId}`),
      teamShort: tm?.short_name ?? '—',
      pos: POS_SHORT[el?.element_type] ?? '—',
      /** FPL auto-pick (manager absent / timer expired) — not a manual selection. */
      wasAuto: c.was_auto === true,
    }
  })
}
