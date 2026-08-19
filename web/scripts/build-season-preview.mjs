/**
 * Build the static 26/27 Season Preview (web/public/league-data/season-preview.json).
 *
 * Draft-strength model, per team:
 *  - Each drafted player gets a "weekly score": a 50/50 blend of the
 *    fpl-predictions GW1 forecast (FPL + Understat engine) and their 25/26
 *    FPL total / 38 (players new to the league use the forecast alone, since
 *    the engine already cold-starts them).
 *  - Team strength = the best legal XI (1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD)
 *    maximizing summed weekly score. Bench strength = the other four.
 *  - Weekly sigma per team from the forecast percentile spreads
 *    ((p90 - p10) / 2.56 per player, summed in quadrature).
 *
 * Season projection: Monte Carlo over the real 38-GW H2H schedule in
 * details.json — each match samples both teams' weekly scores
 * (normal, rounded to ints so draws can happen), H2H 3/1/0, then a final
 * table by points → points-for. 5000 iterations.
 *
 * Editorial verdicts live in VERDICTS below so a data refresh never
 * clobbers the writing (they are keyed by leagueEntryId, so other leagues
 * simply get no verdict text).
 *
 * Runs in the deploy chain, but a committed season-preview.json wins: the
 * preview is a pre-season prior and must not drift as forecasts update, so
 * an existing file is never overwritten unless run with --force.
 *
 * Run: node scripts/build-season-preview.mjs [--force]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { simulateSeasonAsOf } from '../src/seasonPredictionsModel.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(root, 'public/league-data')
const read = (f) => JSON.parse(readFileSync(join(dataDir, f), 'utf8'))

const outPath = join(dataDir, 'season-preview.json')
if (existsSync(outPath) && !process.argv.includes('--force')) {
  console.log('build-season-preview: season-preview.json exists — keeping it (use --force to regenerate)')
  process.exit(0)
}

/* Fail soft: forks may not have a draft or predictions yet — a missing
 * preview just hides the Preview/Predictions tabs, a crashed build ships nothing. */
let picksDoc
let predictions
let bootstrap
let details
try {
  picksDoc = read('draft_picks.json')
  predictions = read('predictions.json')
  bootstrap = read('bootstrap_draft.json')
  details = read('details.json')
} catch (err) {
  console.warn('build-season-preview: skip —', err.message)
  process.exit(0)
}
if (!Array.isArray(picksDoc?.picks) || picksDoc.picks.length === 0) {
  console.warn('build-season-preview: skip — draft_picks.json has no picks')
  process.exit(0)
}
if (picksDoc.picks.some((p) => p.leagueEntryId == null)) {
  console.warn('build-season-preview: skip — draft picks lack leagueEntryId')
  process.exit(0)
}

const SIMS = 5000
const forecastById = new Map(predictions.players.map((p) => [p.id, p]))
const carryById = new Map(bootstrap.elements.map((e) => [e.id, e.total_points]))
const statusById = new Map(bootstrap.elements.map((e) => [e.id, e.status]))
/** Manual league-confirmed corrections FPL hasn't flagged yet (see the JSON's note). Optional. */
let overrides = null
try {
  overrides = read('availability-overrides.json')
} catch {
  /* no overrides file — fine */
}
for (const o of overrides?.overrides ?? []) statusById.set(Number(o.id), o.status)

/** 3-sentence pundit verdicts, keyed by leagueEntryId. Written against the
 * simulated numbers — regenerate data freely, edit prose here only. */
const VERDICTS = {
  18279:
    'João Pedro in round one is the market’s favourite forward outside Haaland, and Cunha, Gibbs-White and Foden behind him make this the deepest midfield in the draft. Roefs in round 14 is the steal of the entire league — a projected weekly starter with the 109th pick. Best blend of floor and ceiling on any board: joint-top of the simulation’s title odds, in a dead heat with the champions.',
  6849: 'Bruno Fernandes at pick two is the consensus best non-Haaland asset in FPL, and the champions’ defensive stock — Calafiori in round four, Saliba sliding to round 14 on a back injury — gives this squad the strongest back line in the league once he’s fit. The fifteen also carried the second-most 25/26 points of any draft. Joint-top of the simulation’s title odds, locked in a dead heat with Mordor: a genuine title side.',
  10173:
    'Nobody drafted more proven scoring: this fifteen returned more 25/26 points than any squad in the league, anchored by Gabriel, Watkins and Bruno Guimarães. Doubling up on keepers with Pickford and Donnarumma by round ten was luxury shopping, though the round-14 Reijnders heist died on the vine — sold before he kicked a ball, a dead pick the model now counts as nothing. Still barely a weakness anywhere — the model’s dark horse with a live title shout.',
  4898: 'Haaland first overall is the no-brainer of the summer — the projected MVP and the one player in this league who wins weeks on his own. The model’s worry is everything after him: Wirtz and Rice are class, but the forward line behind the big man is Šeško and round-13 Solanke. Top-heavy and hostage to one hamstring; brilliant when it clicks.',
  5220: 'Palmer, Gyökeres, Mateta and Ødegaard inside four rounds is the flashiest start anyone had, and Estêvão in round 14 could be the pick of the summer by May. The catch: all that youth and churn returned the second-fewest 25/26 points of any squad, so the floor is unproven. Highest variance in the league — a top-two ceiling with a bottom-three tail.',
  44904:
    'Thiago spearheads the most attack-committed board in the draft — 22 league goals last season — with Semenyo, Szoboszlai and Ekitiké stacked behind him. Gvardiol and Pedro Porro are proper defenders, but the model rates the XI mid-pack once the blend of new clubs and new roles is priced in. Will win shootouts; needs the arm-wrestles to break even.',
  30728:
    'Saka and Cherki are a top-heavy one-two with genuine captain-grade ceilings, and Alisson in round 11 was smart business. Below the front pair it thins fast — Brobbey in round four is a big swing, and the squad carried the third-fewest 25/26 points in the league. Lives and dies by two players; the simulation says more Tuesday nights than title nights.',
  4259: 'Isak in round one is the draft’s boldest bet — Liverpool’s post-Salah striker coming off a season even his backers call a horror show. Mbeumo and Doku bring real pace, but this fifteen carried the fewest 25/26 points of any squad and the model has noticed. If Isak bounces back it looks clever fast; the simulation isn’t waiting up.',
}

/** Group picks by league entry. */
const teams = new Map()
for (const p of picksDoc.picks) {
  if (!teams.has(p.leagueEntryId)) {
    teams.set(p.leagueEntryId, { leagueEntryId: p.leagueEntryId, name: p.teamName, picks: [] })
  }
  teams.get(p.leagueEntryId).picks.push(p)
}

/** Blended weekly score + sigma for one drafted player. Players FPL marks
 * unavailable ('u' — left the league, e.g. "Has joined X permanently") are
 * worth nothing going forward: no forecast AND no last-season carry credit. */
function playerWeekly(pick) {
  if (statusById.get(pick.element) === 'u') {
    return { ev: 0, weekly: 0, sd: 0, carry: 0 }
  }
  const f = forecastById.get(pick.element)
  const ev = f?.forecast?.totalPoints ?? 0
  const p10 = f?.forecast?.percentiles?.p10 ?? 0
  const p90 = f?.forecast?.percentiles?.p90 ?? 0
  const carry = carryById.get(pick.element) ?? 0
  const weekly = carry > 0 ? 0.5 * ev + 0.5 * (carry / 38) : ev
  return { ev, weekly: +weekly.toFixed(2), sd: (p90 - p10) / 2.56, carry }
}

/** Best legal XI by blended weekly score. */
function bestXI(players) {
  const by = { GKP: [], DEF: [], MID: [], FWD: [] }
  for (const p of players) by[p.pos === 'GK' ? 'GKP' : p.pos]?.push(p)
  for (const k of Object.keys(by)) by[k].sort((a, b) => b.weekly - a.weekly)
  let best = null
  for (let d = 3; d <= 5; d++) {
    for (let m = 2; m <= 5; m++) {
      for (let f = 1; f <= 3; f++) {
        if (1 + d + m + f !== 11) continue
        if (by.DEF.length < d || by.MID.length < m || by.FWD.length < f || by.GKP.length < 1) {
          continue
        }
        const xi = [by.GKP[0], ...by.DEF.slice(0, d), ...by.MID.slice(0, m), ...by.FWD.slice(0, f)]
        const total = xi.reduce((s, p) => s + p.weekly, 0)
        if (!best || total > best.total) best = { total, xi, shape: `${d}-${m}-${f}` }
      }
    }
  }
  return best
}

/** Per-team model inputs. */
const modeled = [...teams.values()].map((t) => {
  const players = t.picks.map((p) => ({ ...p, ...playerWeekly(p) }))
  const { total, xi, shape } = bestXI(players)
  const xiSet = new Set(xi.map((p) => p.overallPick))
  const bench = players.filter((p) => !xiSet.has(p.overallPick))
  const benchTotal = bench.reduce((s, p) => s + p.weekly, 0)
  const sigma = Math.sqrt(xi.reduce((s, p) => s + p.sd * p.sd, 0))
  const carryTotal = players.reduce((s, p) => s + p.carry, 0)
  const keyPlayer = [...players].sort((a, b) => b.weekly - a.weekly)[0]
  return {
    ...t,
    players,
    xi,
    shape,
    strength: total,
    benchStrength: benchTotal,
    sigma,
    carryTotal,
    keyPlayer,
  }
})

/** Steal of the draft per team: biggest gap between league-wide weekly rank
 * and where the player actually went. Only counts picks after round 3 so
 * "Haaland at 1" doesn't register. */
const allDrafted = modeled
  .flatMap((t) => t.players)
  .sort((a, b) => b.weekly - a.weekly)
const weeklyRank = new Map(allDrafted.map((p, i) => [p.overallPick, i + 1]))
for (const t of modeled) {
  t.steal = [...t.players]
    .filter((p) => p.round > 3)
    .sort(
      (a, b) =>
        b.overallPick - weeklyRank.get(b.overallPick) - (a.overallPick - weeklyRank.get(a.overallPick)),
    )[0]
}

/** Monte Carlo over the real schedule. */
/** Pre-season = "as of GW0" of the shared living model: nothing banked, the
 * whole schedule simulated, and each team's strength drawn per iteration
 * around its estimate (se = sigma/√prior-weight) so the odds honestly carry
 * how little a draft alone can tell us. */
const PRIOR_WEIGHT = 6
const ids = modeled.map((t) => t.leagueEntryId)
const strengths = new Map(
  modeled.map((t) => [
    t.leagueEntryId,
    { mu: t.strength, sigma: t.sigma, se: t.sigma / Math.sqrt(PRIOR_WEIGHT) },
  ]),
)
const sim = simulateSeasonAsOf({
  matches: details.matches,
  entryIds: ids,
  throughGw: 0,
  strengths,
  sims: SIMS,
  seed: 20262027,
})

const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C']
/** Teams whose weekly projections sit within this of the team above share its
 * grade — a 0.1 pts/week gap is noise, not a tier. */
const GRADE_TIE_GAP = 0.5
const byStrength = [...modeled].sort((a, b) => b.strength - a.strength)
const gradeByEntry = new Map()
let gradeIdx = 0
byStrength.forEach((t, i) => {
  if (i > 0 && byStrength[i - 1].strength - t.strength >= GRADE_TIE_GAP) gradeIdx = i
  gradeByEntry.set(t.leagueEntryId, GRADES[gradeIdx])
})

/* ── Generated verdicts ─────────────────────────────────────────────────
 * Leagues without hand-written VERDICTS get a few sentences composed from
 * the model: key asset + value pick, the squad's most distinctive trait
 * relative to the league, and the simulation's call. */
const N = modeled.length
const ord = (n) => {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}
const rankIn = (arr, id) => arr.findIndex((x) => x.leagueEntryId === id) + 1
const byCarry = [...modeled].sort((a, b) => b.carryTotal - a.carryTotal)
const byBench = [...modeled].sort((a, b) => b.benchStrength - a.benchStrength)
const bySigma = [...modeled].sort((a, b) => b.sigma - a.sigma)
const titleFavouriteId = ids.reduce((best, id) =>
  sim.get(id).titlePct > sim.get(best).titlePct ? id : best,
)
const spoonFavouriteId = ids.reduce((worst, id) =>
  sim.get(id).lastPct > sim.get(worst).lastPct ? id : worst,
)

function makeVerdict(t, s) {
  const id = t.leagueEntryId
  const kp = t.keyPlayer
  const weekly = Number(kp.weekly).toFixed(1)

  let s1 =
    kp.round === 1
      ? `${kp.playerName} at pick ${kp.overallPick} is the headline asset, projected for ${weekly} points a week.`
      : `The best asset on this board is ${kp.playerName}, who arrived in round ${kp.round} and projects ${weekly} points a week.`
  if (t.steal && t.steal.overallPick !== kp.overallPick) {
    s1 = s1.slice(0, -1) + `, and ${t.steal.playerName} in round ${t.steal.round} was the real value of the draft.`
  }

  const traits = []
  const carryRank = rankIn(byCarry, id)
  const benchRank = rankIn(byBench, id)
  const sigmaRank = rankIn(bySigma, id)
  if (carryRank === 1) traits.push('no fifteen carried more proven 25/26 points into the season')
  if (carryRank === N) traits.push('the squad carried the fewest 25/26 points in the league, so the floor is unproven')
  if (benchRank === 1) traits.push('the bench is the deepest in the draft')
  if (benchRank === N) traits.push('the bench is the thinnest in the league, so injuries would bite hard')
  if (sigmaRank === 1) traits.push('week-to-week variance is the highest in the league — boom or bust')
  if (sigmaRank === N) traits.push('the weekly profile is the steadiest in the draft')
  const strengthRank = rankIn(byStrength, id)
  let s2
  if (traits.length) {
    const joined = traits.slice(0, 2).join(', and ')
    s2 = joined.charAt(0).toUpperCase() + joined.slice(1) + '.'
  } else {
    s2 = `The model rates this XI ${ord(strengthRank)} of ${N} in the league for weekly output.`
  }

  let s3
  if (id === titleFavouriteId) {
    s3 = `The simulation makes them the title favourite: ${s.titlePct}% to win it with a projected finish of ${ord(Math.round(s.avgFinish))}.`
  } else if (s.titlePct >= 10) {
    s3 = `A genuine contender — ${s.titlePct}% title odds and ${s.topHalfPct}% to finish top half.`
  } else if (id === spoonFavouriteId && s.lastPct >= 15) {
    s3 = `The simulation braces for a long season: ${s.lastPct}% wooden-spoon risk against ${s.titlePct}% title odds.`
  } else if (s.topHalfPct >= 50) {
    s3 = `The model calls a top-half push (${s.topHalfPct}%) with an average finish of ${ord(Math.round(s.avgFinish))}.`
  } else {
    s3 = `Mid-table is the call — an average finish of ${ord(Math.round(s.avgFinish))} and ${s.topHalfPct}% top-half odds.`
  }

  return `${s1} ${s2} ${s3}`
}

const outTeams = modeled.map((t) => {
  const s = sim.get(t.leagueEntryId)
  return {
    leagueEntryId: t.leagueEntryId,
    name: t.name,
    grade: gradeByEntry.get(t.leagueEntryId),
    shape: `1-${t.shape}`,
    weeklyProjection: +t.strength.toFixed(1),
    /** Weekly score spread — the prior sigma for the living season model. */
    weeklySigma: +t.sigma.toFixed(2),
    benchProjection: +t.benchStrength.toFixed(1),
    carryTotal: t.carryTotal,
    keyPlayer: {
      name: t.keyPlayer.playerName,
      teamShort: t.keyPlayer.teamShort,
      pos: t.keyPlayer.pos,
      weekly: t.keyPlayer.weekly,
      overallPick: t.keyPlayer.overallPick,
    },
    steal: t.steal
      ? {
          name: t.steal.playerName,
          teamShort: t.steal.teamShort,
          pos: t.steal.pos,
          round: t.steal.round,
          overallPick: t.steal.overallPick,
          weekly: t.steal.weekly,
        }
      : null,
    sim: {
      avgFinish: s.avgFinish,
      titlePct: s.titlePct,
      topHalfPct: s.topHalfPct,
      lastPct: s.lastPct,
      avgPts: s.projPts,
      avgPf: s.projPf,
      avgW: s.avgW,
      avgD: s.avgD,
      finishDistribution: s.finishDistribution,
    },
    verdict: VERDICTS[t.leagueEntryId] ?? makeVerdict(t, s),
  }
})

outTeams.sort((a, b) => a.sim.avgFinish - b.sim.avgFinish)

const steals = outTeams
  .map((t) => t.steal && { ...t.steal, teamName: t.name })
  .filter(Boolean)
  .sort((a, b) => b.overallPick - weeklyRank.get(b.overallPick) - (a.overallPick - weeklyRank.get(a.overallPick)))

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  season: '2026-27',
  method: {
    engine: 'fpl-predictions (FPL + Understat)',
    blend: '50% GW1 forecast + 50% 25/26 points ÷ 38 (forecast only for players new to the league)',
    simulations: SIMS,
    schedule: 'real 38-GW H2H fixture list',
  },
  awards: {
    mvp: (() => {
      const t = [...outTeams].sort((a, b) => b.keyPlayer.weekly - a.keyPlayer.weekly)[0]
      return { ...t.keyPlayer, teamName: t.name }
    })(),
    steal: steals[0] ?? null,
  },
  teams: outTeams,
}

writeFileSync(outPath, JSON.stringify(output, null, 1))
console.log('season-preview.json written:', outTeams.map((t) => `${t.name} ${t.sim.avgFinish}`).join(' | '))
