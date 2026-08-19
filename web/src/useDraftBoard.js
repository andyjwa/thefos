import { useState, useEffect, useMemo } from 'react'
import { draftEntryEventUrl, draftResourceUrl } from './fplDraftUrl'
import { reconstructDraftPicks } from './draftBoardPicks'
import { picksFromDraftChoices } from './draftChoicesPicks'
import {
  draftCurrentGameweek,
  buildFirstLeftGameweekMap,
  mergeRosterStatusIntoPicks,
} from './draftBoardRosterStatus'
import { fetchSquadSetsForGw } from './draftSquadsFetch'
import { leagueDataBase } from './seasonArchive.js'

const DATA_BASE = leagueDataBase()

async function fetchOptionalJson(path) {
  try {
    const r = await fetch(`${DATA_BASE}/${path}`)
    if (!r.ok) return null
    return r.json()
  } catch {
    return null
  }
}

async function fetchOptionalJsonUrl(url) {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return r.json()
  } catch {
    return null
  }
}

function displayEntryName(e) {
  if (!e) return 'Unknown'
  const name = (e.entry_name || '').trim()
  if (name) return name
  const mgr = `${e.player_first_name || ''} ${e.player_last_name || ''}`.trim()
  if (mgr) return mgr
  if (e.short_name) return String(e.short_name)
  const id = e.id ?? e.entry_id
  return id != null ? `Team ${id}` : 'Unknown'
}

/**
 * Optional static file: `{ picks: [{ overallPick, round, pickInRound, entryId, leagueEntryId, teamName, element, playerName, teamShort, pos }] }`
 * When present, skips live API reconstruction.
 */
function normalizeStaticPicks(raw, leagueEntries) {
  const list = raw?.picks
  if (!Array.isArray(list) || !list.length) return null
  const nameByFpl = new Map()
  const leagueIdByFpl = new Map()
  for (const e of leagueEntries || []) {
    if (e?.entry_id == null) continue
    const fid = Number(e.entry_id)
    if (!Number.isFinite(fid)) continue
    nameByFpl.set(fid, displayEntryName(e))
    if (e?.id != null) leagueIdByFpl.set(fid, e.id)
  }
  return list.map((p) => {
    const fidPick = Number(p.entryId)
    const entryId = Number.isFinite(fidPick) ? fidPick : p.entryId
    return {
    overallPick: p.overallPick,
    round: p.round,
    pickInRound: p.pickInRound,
    entryId,
    leagueEntryId: p.leagueEntryId ?? leagueIdByFpl.get(entryId) ?? null,
    teamName: nameByFpl.get(entryId) || p.teamName || '—',
    element: p.element,
    playerName: p.playerName ?? `Player #${p.element}`,
    teamShort: p.teamShort ?? '—',
    pos: p.pos ?? '—',
    wasAuto: p.wasAuto === true,
  }
  })
}

/**
 * Committed draft_picks.json from another league (e.g. forked TCLOT) would show wrong teams,
 * avatars, and trade alignment. Skip static file when it clearly does not match this league.
 */
function staticDraftPicksMatchLeague(raw, normalizedPicks, league, leagueEntries) {
  if (!normalizedPicks?.length) return false
  const metaId = raw?._meta?.leagueId
  const currentId = league?.id
  // Forked TCLOT draft_picks.json always has _meta.leagueId (6802). Reject unless details match.
  if (metaId != null) {
    if (currentId == null || Number(metaId) !== Number(currentId)) {
      return false
    }
  }
  const entryIds = new Set(
    (leagueEntries || [])
      .map((e) => e.entry_id)
      .filter((x) => x != null)
      .map((x) => Number(x)),
  )
  if (!entryIds.size) return false
  return normalizedPicks.every((p) => entryIds.has(Number(p.entryId)))
}

function enrichPicksFromBootstrap(boot, picks) {
  if (!boot || !picks?.length) return picks
  const elementById = new Map((boot.elements || []).map((e) => [e.id, e]))
  const teamById = new Map((boot.teams || []).map((t) => [t.id, t]))
  return picks.map((p) => {
    const el = elementById.get(p.element)
    const tm = el != null ? teamById.get(el.team) : null
    const code = tm?.code
    const badgeUrl =
      code != null
        ? `https://resources.premierleague.com/premierleague/badges/50/t${code}.png`
        : null
    let totalPoints = null
    if (el?.total_points != null) {
      const n = Number(el.total_points)
      if (Number.isFinite(n)) totalPoints = n
    }
    const full = [el?.first_name, el?.second_name].filter(Boolean).join(' ').trim()
    const playerFullName = full || el?.web_name || p.playerName
    return { ...p, totalPoints, playerFullName, badgeUrl }
  })
}

async function applyRosterStatus(picks, leagueEntries, boot) {
  if (!picks?.length || !leagueEntries?.length) return picks
  if (!boot) {
    return picks.map((p) => ({
      ...p,
      rosterOnSquad: null,
      rosterLeftGameweek: null,
      rosterLeftKind: null,
    }))
  }
  const [tx, tr] = await Promise.all([
    fetchOptionalJson('transactions.json'),
    fetchOptionalJson('trades.json'),
  ])
  const firstLeft = buildFirstLeftGameweekMap(tx, tr)
  const gw = draftCurrentGameweek(boot)
  const squads = await fetchSquadSetsForGw(leagueEntries, gw)
  return mergeRosterStatusIntoPicks(picks, squads, firstLeft)
}

export function useDraftBoard(league, leagueEntries) {
  const [picks, setPicks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [source, setSource] = useState('')

  const entriesKey = useMemo(() => {
    if (!leagueEntries?.length) return ''
    return [...leagueEntries]
      .map((e) => `${e.entry_id}:${e.id}`)
      .sort()
      .join('|')
  }, [leagueEntries])

  const startGw = Number(league?.start_event) >= 1 ? Number(league.start_event) : 1

  useEffect(() => {
    if (!entriesKey) {
      setPicks([])
      setLoading(false)
      setError(null)
      setSource('')
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      try {
        const staticRaw = await fetchOptionalJson('draft_picks.json')
        let staticPicks = normalizeStaticPicks(staticRaw, leagueEntries)
        if (
          staticPicks?.length &&
          !staticDraftPicksMatchLeague(staticRaw, staticPicks, league, leagueEntries)
        ) {
          staticPicks = null
        }
        if (staticPicks?.length) {
          const boot = await fetchOptionalJson('bootstrap_draft.json')
          let enriched = enrichPicksFromBootstrap(boot, staticPicks)
          enriched = await applyRosterStatus(enriched, leagueEntries, boot)
          if (!cancelled) {
            setPicks(enriched)
            setSource('file')
            setLoading(false)
          }
          return
        }

        const bootRes = await fetch(`${DATA_BASE}/bootstrap_draft.json`)
        if (!bootRes.ok) throw new Error(`bootstrap_draft.json (${bootRes.status})`)
        const boot = await bootRes.json()
        const elementById = new Map((boot.elements || []).map((e) => [e.id, e]))
        const teamById = new Map((boot.teams || []).map((t) => [t.id, t]))

        /**
         * Draft pick log first: true pick order, and available as soon as the draft ends.
         * The GW-squad reconstruction below needs /entry/{id}/event/{gw}, which 404s
         * until the gameweek starts (draft done, GW1 not kicked off → dead Draft tab).
         */
        let reconstructed = null
        if (league?.id != null) {
          const choicesRaw = await fetchOptionalJsonUrl(
            draftResourceUrl(`draft/${league.id}/choices`),
          )
          reconstructed = picksFromDraftChoices(
            choicesRaw,
            leagueEntries,
            elementById,
            teamById,
          )
        }
        const usedChoices = Boolean(reconstructed?.length)

        if (!usedChoices) {
          const orderRaw = await fetchOptionalJson('draft_round1_order.json')
          const round1FplEntryIds = Array.isArray(orderRaw?.fplEntryIds)
            ? orderRaw.fplEntryIds
            : null

          const picksByFpl = new Map()
          await Promise.all(
            leagueEntries.map(async (le) => {
              const urlGw1 = draftEntryEventUrl(le.entry_id, startGw)
              const r1 = await fetch(urlGw1)
              if (!r1.ok) {
                throw new Error(
                  `GW${startGw} picks for entry ${le.entry_id}: HTTP ${r1.status}`,
                )
              }
              const j1 = await r1.json()
              const els = (j1.picks || []).map((p) => p.element).filter((x) => x != null)
              picksByFpl.set(le.entry_id, els)
            }),
          )

          reconstructed = reconstructDraftPicks(
            leagueEntries,
            picksByFpl,
            elementById,
            teamById,
            15,
            { round1FplEntryIds },
          )
        }

        let enriched = enrichPicksFromBootstrap(boot, reconstructed)
        enriched = await applyRosterStatus(enriched, leagueEntries, boot)

        if (!cancelled) {
          setPicks(enriched)
          setSource(usedChoices ? 'choices' : 'api')
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          let msg = e?.message || String(e)
          const looksLikeNetworkBlock =
            /Failed to fetch|NetworkError|Load failed|CORS|network/i.test(msg)
          if (looksLikeNetworkBlock && !import.meta.env.DEV) {
            const proxy = (import.meta.env.VITE_FPL_PROXY_URL || '').trim()
            if (!proxy) {
              msg +=
                ' Hosted pages cannot call the draft API from the browser without a proxy. Set VITE_FPL_PROXY_URL when building (see DEPLOY.md), and ensure GitHub Actions has FPL_LEAGUE_ID so draft_picks.json is generated for this league.'
            }
          }
          setError(msg)
          setPicks([])
          setSource('')
          setLoading(false)
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [entriesKey, startGw, league, leagueEntries])

  const teamCount = leagueEntries?.length ?? 0

  return { picks, loading, error, source, teamCount, startGw }
}
