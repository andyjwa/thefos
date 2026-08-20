#!/usr/bin/env node
/**
 * GitHub Actions scheduled deploy gate: only "proceed" when a full ingest/build is worth
 * doing — i.e. soon after a gameweek's FPL `waivers_time` (so transactions land in
 * `drops-gw-live` after build-waiver-gw-analytics), every 3 hours in the 24h leading
 * up to `waivers_time`, or at one of the thrice-daily UTC catch-alls.
 *
 * Two crons share this gate (the workflow passes `github.event.schedule` as
 * SCHEDULE_CRON): the hourly cron keeps all the windows above, while the
 * 15-minute burst cron deploys ONLY inside a tight post-waivers burst window
 * (grace → 90 min after `waivers_time`) and skips at every other time of day,
 * so results land ~15–35 min after waivers process instead of up to an hour.
 * GitHub cron has jitter — scheduled runs fire minutes late and are
 * occasionally skipped — which the burst window absorbs.
 *
 * Not invoked for push / workflow_dispatch (the workflow skips this logic there).
 * Data: draft bootstrap-static { events: { data: [{ id, waivers_time }, ...] } }.
 */
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const DRAFT_BOOTSTRAP = 'https://draft.premierleague.com/api/bootstrap-static'
/** FPL usually exposes successful waiver rows a short time after this timestamp */
const WAIVER_GRACE_START_MS = 20 * 60 * 1000
/** Re-run builds at most this long after each `waivers_time` to pick up stragglers */
const WAIVER_FRESH_WINDOW_MS = 36 * 60 * 60 * 1000
/** The 15-minute burst cron's `schedule` expression, as GitHub reports it. */
const BURST_CRON = '*/15 * * * *'
/** Burst grace: the source site typically has waiver rows ~10 min after `waivers_time`. */
const BURST_GRACE_MS = 10 * 60 * 1000
/** Burst deploys stop this long after `waivers_time`; the hourly cron owns the long tail. */
const BURST_WINDOW_MS = 90 * 60 * 1000
/**
 * After the PL GW deadline, draft `details.json` H2H rows often flip to `finished` before
 * the next `waivers_time`. Hourly cron must still ingest in that gap (otherwise the site can
 * sit on an old committed `details.json` until the next waiver window or 05:30 UTC daily).
 */
const POST_DEADLINE_INGEST_DELAY_MS = 2 * 60 * 60 * 1000
/** Stop hourly post-deadline ingests once the next GW deadline is this close */
const POST_DEADLINE_STOP_BEFORE_NEXT_DEADLINE_MS = 3 * 60 * 60 * 1000
/**
 * When a daily catch-all cron (`30 5/13/21 * * *`, ~05:30/13:30/21:30 UTC) fires,
 * always allow full refresh (also covers missed windows). Accept a few minutes' drift.
 */
const DAILY_UTC_WINDOWS = [5, 13, 21].map((h) => ({
  startMin: h * 60 + 26,
  endMin: h * 60 + 45,
}))
/** In the day before a GW's `waivers_time`, refresh on this UTC-hour cadence. */
const PRE_WAIVER_WINDOW_MS = 24 * 60 * 60 * 1000
const PRE_WAIVER_CADENCE_HOURS = 3

function minuteOfDayUtc(d) {
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

function inDailyCatchAllWindow() {
  const m = minuteOfDayUtc(new Date())
  return DAILY_UTC_WINDOWS.some((w) => m >= w.startMin && m <= w.endMin)
}

/**
 * @param {object[]} eventList — bootstrap `events.data`
 * @param {number} nowMs
 * @returns {{ id: number, deadline: string } | null}
 */
export function postDeadlineIngestEvent(eventList, nowMs) {
  if (!Array.isArray(eventList)) return null
  const now = Number(nowMs)
  if (!Number.isFinite(now)) return null

  const rows = eventList
    .map((e) => {
      const id = Number(e?.id)
      const deadline = e?.deadline_time
      if (!Number.isFinite(id) || typeof deadline !== 'string' || !deadline) return null
      const dl = Date.parse(deadline)
      if (!Number.isFinite(dl)) return null
      return {
        id,
        finished: e?.finished === true,
        deadline,
        dl,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.id - b.id)

  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i]
    if (!cur.finished) continue
    const ingestAfter = cur.dl + POST_DEADLINE_INGEST_DELAY_MS
    if (now < ingestAfter) continue

    const next = rows[i + 1]
    if (next) {
      const stopAt = next.dl - POST_DEADLINE_STOP_BEFORE_NEXT_DEADLINE_MS
      if (now >= stopAt) continue
    }

    return { id: cur.id, deadline: cur.deadline }
  }
  return null
}

/**
 * Every-3-hours refresh in the 24 hours leading up to a GW's `waivers_time`,
 * so waiver-day decisions (free agents, forbidden list, projections) run on
 * fresh data. The hourly cron fires at minute 0; this admits only runs whose
 * UTC hour is on the 3-hour cadence (00/03/06/…/21).
 *
 * @param {object[]} eventList — bootstrap `events.data`
 * @param {number} nowMs
 * @returns {{ id: number, waiversTime: string } | null}
 */
export function preWaiverRefreshEvent(eventList, nowMs) {
  if (!Array.isArray(eventList)) return null
  const now = Number(nowMs)
  if (!Number.isFinite(now)) return null
  if (new Date(now).getUTCHours() % PRE_WAIVER_CADENCE_HOURS !== 0) return null
  for (const e of eventList) {
    const raw = e?.waivers_time
    if (typeof raw !== 'string' || !raw) continue
    const wt = Date.parse(raw)
    if (!Number.isFinite(wt)) continue
    if (now >= wt - PRE_WAIVER_WINDOW_MS && now < wt) {
      return { id: e.id, waiversTime: raw }
    }
  }
  return null
}

/**
 * Tight post-waivers window for the 15-minute burst cron: allow only when now is
 * inside (`waivers_time` + BURST_GRACE_MS, `waivers_time` + BURST_WINDOW_MS).
 * Everything else — daily catch-alls, pre-waiver cadence, post-deadline ingest —
 * stays on the hourly cron so the burst cron never multiplies those windows.
 *
 * @param {object[]} eventList — bootstrap `events.data`
 * @param {number} nowMs
 * @returns {{ id: number, waiversTime: string } | null}
 */
export function burstRefreshEvent(eventList, nowMs) {
  if (!Array.isArray(eventList)) return null
  const now = Number(nowMs)
  if (!Number.isFinite(now)) return null
  for (const e of eventList) {
    const raw = e?.waivers_time
    if (typeof raw !== 'string' || !raw) continue
    const wt = Date.parse(raw)
    if (!Number.isFinite(wt)) continue
    if (now > wt + BURST_GRACE_MS && now < wt + BURST_WINDOW_MS) {
      return { id: e.id, waiversTime: raw }
    }
  }
  return null
}

async function main() {
  const isBurstCron = (process.env.SCHEDULE_CRON || '').trim() === BURST_CRON

  if (!isBurstCron && inDailyCatchAllWindow()) {
    console.log(
      'waiver-refresh-gate: in daily 05:26–05:45 UTC window — run full deploy',
    )
    process.exit(0)
  }

  const r = await fetch(DRAFT_BOOTSTRAP, {
    headers: { Accept: 'application/json' },
  })
  if (!r.ok) {
    console.error(`waiver-refresh-gate: bootstrap HTTP ${r.status} — skip deploy`)
    process.exit(1)
  }
  const j = await r.json()
  const list = j?.events?.data
  if (!Array.isArray(list)) {
    console.error('waiver-refresh-gate: no events.data — skip')
    process.exit(1)
  }

  const now = Date.now()

  if (isBurstCron) {
    const burst = burstRefreshEvent(list, now)
    if (burst) {
      console.log(
        `waiver-refresh-gate: burst cron inside post-waivers burst window for GW${burst.id} (waivers_time ${burst.waiversTime}) — run deploy`,
      )
      process.exit(0)
    }
    console.log(
      'waiver-refresh-gate: burst cron outside the post-waivers burst window — skip deploy',
    )
    process.exit(1)
  }

  for (const e of list) {
    const raw = e?.waivers_time
    if (typeof raw !== 'string' || !raw) continue
    const wt = Date.parse(raw)
    if (!Number.isFinite(wt)) continue
    const start = wt + WAIVER_GRACE_START_MS
    const end = wt + WAIVER_FRESH_WINDOW_MS
    if (now > start && now < end) {
      console.log(
        `waiver-refresh-gate: inside post-waivers window for GW${e.id} (waivers_time ${raw}) — run deploy`,
      )
      process.exit(0)
    }
  }

  const preGw = preWaiverRefreshEvent(list, now)
  if (preGw) {
    console.log(
      `waiver-refresh-gate: within 24h of GW${preGw.id} waivers (${preGw.waiversTime}), on 3-hour cadence — run deploy`,
    )
    process.exit(0)
  }

  const postGw = postDeadlineIngestEvent(list, now)
  if (postGw) {
    console.log(
      `waiver-refresh-gate: GW${postGw.id} finished and past deadline (${postGw.deadline}) — run deploy for league details`,
    )
    process.exit(0)
  }

  console.log(
    'waiver-refresh-gate: not in post-waivers, pre-waivers, post-deadline, or daily window — skip deploy',
  )
  process.exit(1)
}

const invokedDirectly =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  main().catch((e) => {
    console.error('waiver-refresh-gate:', e)
    process.exit(1)
  })
}
