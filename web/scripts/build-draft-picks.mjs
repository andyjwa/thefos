#!/usr/bin/env node
/**
 * Writes web/public/league-data/draft_picks.json from live draft API + local bootstrap_draft.
 * Run when a league id is resolvable (committed league-id / .fpl-league-id / env).
 * Runs on GitHub Actions when the workflow passes the league ID so Pages builds are not stuck
 * with a forked TCLOT draft_picks.json. Lets the Draft tab work without browser→draft CORS.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { reconstructDraftPicks } from '../src/draftBoardPicks.js'
import { picksFromDraftChoices } from '../src/draftChoicesPicks.js'
import { readLeagueId } from './readLeagueId.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '../..')
const webPublic = join(repoRoot, 'web/public/league-data')
const leagueId = readLeagueId(repoRoot)
if (!leagueId) {
  process.exit(0)
}

const DRAFT = 'https://draft.premierleague.com/api'

async function fetchJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.json()
}

try {
  const details = await fetchJson(`${DRAFT}/league/${leagueId}/details`)
  const leagueEntries = details.league_entries || []
  if (!leagueEntries.length) {
    console.warn('build-draft-picks: no league_entries')
    process.exit(0)
  }

  const bootPath = join(webPublic, 'bootstrap_draft.json')
  if (!existsSync(bootPath)) {
    console.warn('build-draft-picks: skip — no bootstrap_draft.json')
    process.exit(0)
  }
  const boot = JSON.parse(readFileSync(bootPath, 'utf8'))
  const elementById = new Map((boot.elements || []).map((e) => [e.id, e]))
  const teamById = new Map((boot.teams || []).map((t) => [t.id, t]))

  const startGw = Number(details.league?.start_event) >= 1 ? Number(details.league.start_event) : 1

  /**
   * Preferred source: the draft pick log. True pick order, and available as soon as the
   * draft completes — /entry/{id}/event/{gw} (fallback below) 404s until the GW starts,
   * which used to leave pre-GW1 builds with no draft_picks.json at all.
   */
  let picks = null
  let note = null
  try {
    const choicesRaw = await fetchJson(`${DRAFT}/draft/${leagueId}/choices`)
    picks = picksFromDraftChoices(choicesRaw, leagueEntries, elementById, teamById)
    if (picks?.length) {
      note = `Built directly from draft API /draft/${leagueId}/choices (true pick order).`
    }
  } catch (e) {
    console.warn('build-draft-picks: choices unavailable —', e.message)
  }

  if (!picks?.length) {
    const orderPath = join(webPublic, 'draft_round1_order.json')
    let round1FplEntryIds = null
    if (existsSync(orderPath)) {
      try {
        const raw = JSON.parse(readFileSync(orderPath, 'utf8'))
        if (Array.isArray(raw.fplEntryIds)) round1FplEntryIds = raw.fplEntryIds
      } catch {
        /* ignore */
      }
    } else {
      console.warn(
        'build-draft-picks: no draft_round1_order.json — using FPL entry_id fallback for round 1 (not real draft order). Add draft_round1_order.json (FPL entry_id per round-1 slot; see TCLOT web/public/league-data/draft_round1_order.json).',
      )
    }

    const picksByFpl = new Map()
    for (const le of leagueEntries) {
      const j = await fetchJson(`${DRAFT}/entry/${le.entry_id}/event/${startGw}`)
      picksByFpl.set(
        le.entry_id,
        (j.picks || []).map((p) => p.element).filter((x) => x != null),
      )
    }

    picks = reconstructDraftPicks(leagueEntries, picksByFpl, elementById, teamById, 15, {
      round1FplEntryIds,
    })
    note = round1FplEntryIds?.length
      ? 'Snake round 1 from draft_round1_order.json; player order within team from draft_rank.'
      : 'Snake round 1 from fallback FPL entry_id order (add draft_round1_order.json for true draft slots); within team from draft_rank.'
  }

  const out = {
    _meta: {
      built: new Date().toISOString(),
      leagueId: Number(leagueId),
      startGw,
      note,
    },
    picks,
  }

  mkdirSync(webPublic, { recursive: true })
  writeFileSync(join(webPublic, 'draft_picks.json'), JSON.stringify(out, null, 2))
  console.log(`build-draft-picks: wrote ${picks.length} picks → draft_picks.json`)
} catch (e) {
  console.warn('build-draft-picks: skipped —', e.message)
  // Avoid shipping another league's draft_picks.json after failed regenerate (Pages CORS fallback).
  const draftPath = join(webPublic, 'draft_picks.json')
  const detailsPath = join(webPublic, 'details.json')
  try {
    if (existsSync(draftPath) && existsSync(detailsPath)) {
      const draft = JSON.parse(readFileSync(draftPath, 'utf8'))
      const details = JSON.parse(readFileSync(detailsPath, 'utf8'))
      const lid = details?.league?.id
      const mid = draft?._meta?.leagueId
      if (lid != null && mid != null && Number(lid) !== Number(mid)) {
        unlinkSync(draftPath)
        console.warn(
          `build-draft-picks: removed stale draft_picks.json (league ${mid} ≠ details ${lid})`,
        )
      }
    }
  } catch {
    /* ignore */
  }
  process.exit(0)
}
