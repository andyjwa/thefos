import { useState, useEffect } from 'react';
import { fplElementWebName } from './fplElementNames.js';
import { fplShirtImageUrl } from './fplShirtUrl';
import { TEAM_KIT_COUNT } from './teamKitStyles';
import {
  currentSeasonNameByManagerKey,
  overlayCurrentSeasonEntryName,
} from './currentSeasonClubNames.js';

import { isArchiveView, leagueDataBase } from './seasonArchive.js';

/** Resolves to `league-data/seasons/<label>` in archive view (see seasonArchive.js). */
const DATA_BASE = leagueDataBase();
/** Set at build (`write-league-data-revision.mjs`) and mirrored in `revision.json`. */
const BUILD_LEAGUE_DATA_V = String(import.meta.env.VITE_LEAGUE_DATA_REVISION || '').trim();

async function leagueDataCacheKey() {
  if (BUILD_LEAGUE_DATA_V) return BUILD_LEAGUE_DATA_V;
  try {
    const r = await fetch(`${DATA_BASE}/revision.json`, { cache: 'no-store' });
    if (!r.ok) return '';
    const j = await r.json();
    return j?.v != null ? String(j.v) : '';
  } catch {
    return '';
  }
}

function leagueDataUrl(path, cacheKey) {
  const base = `${DATA_BASE}/${path}`;
  if (!cacheKey) return base;
  return `${base}${base.includes('?') ? '&' : '?'}v=${encodeURIComponent(cacheKey)}`;
}
const FORM_LAST_N = 7;
/** Team form tile: last N finished H2Hs (standings form column still uses FORM_LAST_N). */
const FORM_STRIP_N = 8;

async function fetchJSON(path, cacheKey = '') {
  const url = leagueDataUrl(path, cacheKey);
  const res = await fetch(url, cacheKey ? { cache: 'no-store' } : undefined);
  if (!res.ok) {
    const abs = new URL(url, window.location.href).href;
    throw new Error(`${path} (${res.status}). Tried: ${abs}`);
  }
  return res.json();
}

async function fetchJSONOptional(path, cacheKey = '') {
  try {
    const res = await fetch(leagueDataUrl(path, cacheKey), cacheKey ? { cache: 'no-store' } : undefined);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Try paths in order (ad blockers often block URLs containing "waiver"). */
async function fetchFirstOptional(paths, cacheKey = '') {
  for (const p of paths) {
    const j = await fetchJSONOptional(p, cacheKey);
    if (j != null && typeof j === 'object') return j;
  }
  return null;
}

/** H2H win margin → column key (wins/losses by exactly N pts, or range).
 *
 * Standings tab redesign (Phase 2): bucket scheme is now `1 / 2 / 3-5 / 6-10 / 10+`.
 * Boundary call: `5` belongs to `3-5` (the lower bucket); `5-10` is therefore
 * `6-10` in practice. Header label kept as `5-10` per the design screenshot. */
export const WIN_MARGIN_BUCKET_KEYS = ['1', '2', '3-5', '5-10', '10+'];

function winMarginBucketKey(margin) {
  const m = Number(margin);
  if (m === 1) return '1';
  if (m === 2) return '2';
  if (m >= 3 && m <= 5) return '3-5';
  if (m >= 6 && m <= 10) return '5-10';
  return '10+';
}

/** element_type 1 = GKP — excluded: cheap keeper churn dominates waivers but isn’t useful for this list */
const OUTFIELD_TYPES = new Set([2, 3, 4]);
/** FPL element_type → position label (matches Players-Wire `POS_LABEL`). */
const POS_BY_TYPE = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
/** FPL element IDs omitted from this list (e.g. suspected bad/misleading waiver attribution). */
const EXCLUDED_WAIVER_ELEMENT_IDS = new Set([667]);

function buildMostWaivered(transactionsPayload, fplMini) {
  if (!transactionsPayload?.transactions || !fplMini?.elements?.length) return [];
  const elemById = Object.fromEntries(fplMini.elements.map((e) => [e.id, e]));
  const teamById = Object.fromEntries((fplMini.teams || []).map((t) => [t.id, t]));
  const counts = {};
  for (const tx of transactionsPayload.transactions) {
    if (tx.kind !== 'w' || tx.result !== 'a') continue;
    const el = tx.element_in;
    if (el == null || EXCLUDED_WAIVER_ELEMENT_IDS.has(el)) continue;
    const meta = elemById[el];
    const et = meta?.element_type;
    if (et != null && !OUTFIELD_TYPES.has(et)) continue;
    counts[el] = (counts[el] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, claimCount]) => {
      const e = elemById[Number(id)];
      const tm = e ? teamById[e.team] : null;
      const teamId = e?.team;
      return {
        elementId: Number(id),
        web_name: fplElementWebName(e, id),
        teamShort: tm?.short_name ?? '—',
        teamCode: tm?.code,
        teamId,
        pos: POS_BY_TYPE[e?.element_type] ?? null,
        claims: claimCount,
        shirtUrl: fplShirtImageUrl(tm?.code, e?.element_type),
        badgeUrl:
          tm?.code != null
            ? `https://resources.premierleague.com/premierleague/badges/50/t${tm.code}.png`
            : null,
      };
    });
}

/**
 * Per gameweek: the successful waiver with the lowest FPL `index` (first slot in the
 * league waiver run that week). Joins GW pickup points from drops-gw-live when present.
 */
function buildFirstWaiverOrderPicks(
  transactionsPayload,
  teams,
  elemById,
  teamById,
  waiverOutByTxId,
) {
  const txs = transactionsPayload?.transactions;
  if (!txs?.length) return [];

  const byGw = new Map();
  for (const t of txs) {
    if (t.kind !== 'w' || t.result !== 'a') continue;
    const gw = Number(t.event);
    if (!Number.isFinite(gw) || gw < 1) continue;
    const idx = t.index;
    if (idx == null || typeof idx !== 'number' || !Number.isFinite(idx)) continue;
    if (!byGw.has(gw)) byGw.set(gw, []);
    byGw.get(gw).push(t);
  }

  const out = [];
  for (const [gw, list] of byGw) {
    let minIdx = Infinity;
    for (const t of list) {
      if (t.index < minIdx) minIdx = t.index;
    }
    if (!Number.isFinite(minIdx)) continue;
    const atSlot = list.filter((t) => t.index === minIdx);
    atSlot.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const pick = atSlot[0];
    const fplEntry = Number(pick.entry);
    const leagueEntryId = teams[fplEntry]?.id ?? fplEntry;
    const elementIn =
      pick.element_in != null && pick.element_in !== ''
        ? Number(pick.element_in)
        : null;
    const pickEl = elementIn != null ? elemById[elementIn] : null;
    const pickTm = pickEl ? teamById[pickEl.team] : null;
    const dropRow = waiverOutByTxId.get(pick.id);

    out.push({
      gameweek: gw,
      waiverRunIndex: minIdx,
      transactionId: pick.id,
      entry: fplEntry,
      leagueEntryId,
      teamName: teams[fplEntry]?.entry_name ?? `Team ${fplEntry}`,
      element_in: elementIn,
      pickedName:
        fplElementWebName(pickEl, elementIn) ??
        (elementIn != null ? `Player #${elementIn}` : '—'),
      pickedTeamShort: pickTm?.short_name ?? '—',
      pickedPos: POS_BY_TYPE[pickEl?.element_type] ?? null,
      pickedShirtUrl: fplShirtImageUrl(pickTm?.code, pickEl?.element_type),
      pickedBadgeUrl:
        pickTm?.code != null
          ? `https://resources.premierleague.com/premierleague/badges/50/t${pickTm.code}.png`
          : null,
      pickedUpPlayerGwPoints:
        typeof dropRow?.pickedUpPlayerGwPoints === 'number'
          ? dropRow.pickedUpPlayerGwPoints
          : null,
    });
  }

  out.sort((a, b) => b.gameweek - a.gameweek);
  return out;
}

function enrichTradePlayer(elementId, elemById, teamById) {
  const e = elemById[elementId];
  const tm = e ? teamById[e.team] : null;
  const teamId = e?.team;
  return {
    elementId,
    web_name: fplElementWebName(e, elementId),
    teamShort: tm?.short_name ?? '—',
    teamId,
    elementTypeId: e?.element_type,
    shirtUrl: fplShirtImageUrl(tm?.code, e?.element_type),
    badgeUrl:
      tm?.code != null
        ? `https://resources.premierleague.com/premierleague/badges/50/t${tm.code}.png`
        : null,
  };
}

/**
 * Manual UI labels when the draft trade API element id doesn’t match what the league
 * remembers (display only). GW point sums use draft `event/live` + draft element ids.
 */
const TRADE_DISPLAY_FIXES = [
  {
    tradeId: 424033,
    elementId: 661,
    web_name: 'Gyökeres',
    teamId: 1,
  },
  {
    tradeId: 543307,
    elementId: 728,
    web_name: 'Donnarumma',
    teamId: 13,
  },
];

function applyTradeDisplayFix(player, fix, teamById) {
  if (!fix || !player || player.elementId !== fix.elementId) return player;
  const tm = teamById[fix.teamId];
  return {
    ...player,
    web_name: fix.web_name,
    teamId: fix.teamId,
    teamShort: tm?.short_name ?? player.teamShort,
    shirtUrl: fplShirtImageUrl(tm?.code, player.elementTypeId),
    badgeUrl:
      tm?.code != null
        ? `https://resources.premierleague.com/premierleague/badges/50/t${tm.code}.png`
        : player.badgeUrl,
  };
}

function processTradesPanel(raw, elemById, teamById) {
  if (!raw?.trades?.length) return [];
  const fixesFor = (tradeId) =>
    TRADE_DISPLAY_FIXES.filter((f) => f.tradeId === tradeId);
  return raw.trades.map((t) => {
    const fixes = fixesFor(t.id);
    const legs = (t.legs || []).map((leg) => {
      let gained = enrichTradePlayer(leg.gainedElementId, elemById, teamById);
      let gave = enrichTradePlayer(leg.gaveElementId, elemById, teamById);
      for (const fix of fixes) {
        gained = applyTradeDisplayFix(gained, fix, teamById);
        gave = applyTradeDisplayFix(gave, fix, teamById);
      }
      return {
        ...leg,
        gained,
        gave,
        managerAvatarEntry:
          leg.leagueEntryId != null ? leg.leagueEntryId : leg.fplEntryId,
      };
    });
    const pairs = [];
    for (let i = 0; i < legs.length; i += 2) {
      pairs.push({
        offeredLeg: legs[i],
        receivedLeg: legs[i + 1],
      });
    }
    return { ...t, legs, pairs };
  });
}

export function useLeagueData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const leagueDataV = await leagueDataCacheKey();
        let details;
        let fetchFailedDemo = false;
        try {
          details = await fetchJSON('details.json', leagueDataV);
        } catch (fetchErr) {
          try {
            const mod = await import('../sample-details.json');
            details = mod.default;
            fetchFailedDemo = true;
            console.warn('[TCLOT] details.json failed, using bundled demo', fetchErr);
          } catch {
            throw fetchErr;
          }
        }
        const [transactions, fplMini, waiverOutGw, waiverInTenureTop, tradesPanel] =
          await Promise.all([
            fetchJSONOptional('transactions.json', leagueDataV),
            fetchJSONOptional('fpl-mini.json', leagueDataV),
            fetchFirstOptional(
              ['drops-gw-live.json', 'waiver-out-gw-scores.json'],
              leagueDataV,
            ),
            fetchFirstOptional(
              ['pickups-tenure.json', 'waiver-in-tenure-top.json'],
              leagueDataV,
            ),
            fetchJSONOptional('trades-panel.json', leagueDataV),
          ]);
        let teamLogoMap = {};
        try {
          const r = await fetch(
            `${import.meta.env.BASE_URL}team-logos/manifest.json`
          );
          if (r.ok) {
            const j = await r.json();
            if (j && typeof j === 'object' && !Array.isArray(j)) {
              teamLogoMap = j;
            }
          }
        } catch {
          /* optional file */
        }
        // Current-season club names apply to the live tree only — an archived
        // season must keep the entry names it finished with, not the manager's
        // 26/27 rebrand (badges already stay archival via the season logo map).
        let currentSeasonNameByManager = new Map();
        if (!isArchiveView()) {
          try {
            const r = await fetch(
              `${import.meta.env.BASE_URL}team-logos/preseason-manifest.json`,
            );
            if (r.ok) {
              currentSeasonNameByManager = currentSeasonNameByManagerKey(
                await r.json(),
              );
            }
          } catch {
            /* optional file — keep FPL entry_name */
          }
        }
        if (!cancelled)
          setData({
            ...processLeagueData(details, {
              transactions,
              fplMini,
              waiverOutGw,
              waiverInTenureTop,
              tradesPanel,
              currentSeasonNameByManager,
            }),
            teamLogoMap,
            fetchFailedDemo,
          });
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error, loading };
}

function opponentId(m, entryId) {
  return m.league_entry_1 === entryId ? m.league_entry_2 : m.league_entry_1;
}

function resultForEntry(m, entryId) {
  const p1 = m.league_entry_1_points;
  const p2 = m.league_entry_2_points;
  const e1 = m.league_entry_1;
  if (e1 === entryId) {
    if (p1 > p2) return 'W';
    if (p1 < p2) return 'L';
    return 'D';
  }
  if (p2 > p1) return 'W';
  if (p2 < p1) return 'L';
  return 'D';
}

/** Last N results oldest→newest for form circles — returns rich objects */
function formSequence(entryId, finishedMatches, n, teams) {
  const mine = finishedMatches.filter(
    (m) => m.league_entry_1 === entryId || m.league_entry_2 === entryId
  );
  mine.sort(
    (a, b) =>
      a.event - b.event || (a.id ?? 0) - (b.id ?? 0) || String(a).localeCompare(String(b))
  );
  const last = mine.slice(-n);
  return last.map((m) => {
    const result = resultForEntry(m, entryId);
    const myPts =
      m.league_entry_1 === entryId ? m.league_entry_1_points : m.league_entry_2_points;
    const oppPts =
      m.league_entry_1 === entryId ? m.league_entry_2_points : m.league_entry_1_points;
    const oppId = opponentId(m, entryId);
    return {
      result,
      scoreStr: `${myPts} – ${oppPts}`,
      opponentName: teams[oppId]?.entry_name ?? '?',
      event: m.event,
    };
  });
}

function displayEntryName(e, currentSeasonNameByManager) {
  if (!e) return 'Unknown';
  const overlay = overlayCurrentSeasonEntryName(e, currentSeasonNameByManager);
  if (overlay) return overlay;
  const name = (e.entry_name || '').trim();
  if (name) return name;
  const mgr = `${e.player_first_name || ''} ${e.player_last_name || ''}`.trim();
  if (mgr) return mgr;
  if (e.short_name) return String(e.short_name);
  const id = e.id ?? e.entry_id;
  return id != null ? `Team ${id}` : 'Unknown';
}

/**
 * FPL draft uses `id` in matches/standings; `entry_id` can differ — index both.
 *
 * Two passes: `id` keys are authoritative and written first; `entry_id`
 * aliases are only added when they don't collide with another team's `id`.
 * (In leagues where the two id sequences overlap — e.g. entry_id ≈ id − 4 —
 * a single-pass write let a later team's alias clobber an earlier team's
 * real key, shifting every standings team name.)
 */
function buildTeamsMap(leagueEntries, currentSeasonNameByManager) {
  const teams = {};
  const rows = [];
  for (const e of leagueEntries || []) {
    if (!e || e.id == null) continue;
    const row = { ...e, entry_name: displayEntryName(e, currentSeasonNameByManager) };
    rows.push(row);
    teams[e.id] = row;
  }
  for (const row of rows) {
    if (row.entry_id != null && row.entry_id !== row.id && teams[row.entry_id] == null) {
      teams[row.entry_id] = row;
    }
  }
  return teams;
}

/** Standings rank order → default kit index (wraps when more teams than kits).
 * Same two-pass shape as {@link buildTeamsMap}: `league_entry` keys win,
 * `entry_id` aliases only fill gaps so overlapping id sequences can't clobber. */
function buildDefaultKitIndexByLeagueEntry(sortedByRank, teams) {
  const out = Object.create(null);
  for (let i = 0; i < sortedByRank.length; i++) {
    const idx = i % TEAM_KIT_COUNT;
    const le = sortedByRank[i].league_entry;
    if (le == null) continue;
    out[le] = idx;
  }
  for (let i = 0; i < sortedByRank.length; i++) {
    const idx = i % TEAM_KIT_COUNT;
    const le = sortedByRank[i].league_entry;
    if (le == null) continue;
    const fpl = teams[le]?.entry_id;
    if (fpl != null && Number(fpl) !== Number(le) && out[fpl] == null) {
      out[fpl] = idx;
    }
  }
  return out;
}

/**
 * Rebuild cumulative H2H table from finished matches only (same scoring order as before).
 * The draft API often updates `matches[].finished` and points shortly before `standings`
 * totals catch up after a GW — deriving here keeps PTS / PL / form / next in sync with fixtures.
 */
function deriveStandingsFromMatches(leagueEntries, matchList, teams) {
  const idSet = new Set();
  for (const e of leagueEntries || []) {
    if (e?.id != null) idSet.add(e.id);
  }
  for (const m of matchList) {
    if (!m.finished) continue;
    idSet.add(m.league_entry_1);
    idSet.add(m.league_entry_2);
  }
  const ids = [...idSet].filter((x) => x != null).sort((a, b) => a - b);
  if (ids.length === 0) return [];
  for (const id of ids) {
    if (!teams[id]) {
      teams[id] = { id, entry_id: id, entry_name: `Team ${id}` };
    }
  }
  const st = Object.fromEntries(
    ids.map((id) => [
      id,
      { league_entry: id, w: 0, d: 0, l: 0, pf: 0, pa: 0 },
    ])
  );
  for (const m of matchList) {
    if (!m.finished) continue;
    const id1 = m.league_entry_1;
    const id2 = m.league_entry_2;
    const p1 = m.league_entry_1_points ?? 0;
    const p2 = m.league_entry_2_points ?? 0;
    if (!st[id1] || !st[id2]) continue;
    st[id1].pf += p1;
    st[id1].pa += p2;
    st[id2].pf += p2;
    st[id2].pa += p1;
    if (p1 > p2) {
      st[id1].w += 1;
      st[id2].l += 1;
    } else if (p2 > p1) {
      st[id2].w += 1;
      st[id1].l += 1;
    } else {
      st[id1].d += 1;
      st[id2].d += 1;
    }
  }
  const rows = ids.map((id) => {
    const s = st[id];
    const total = s.w * 3 + s.d;
    return {
      league_entry: id,
      rank: 0,
      total,
      matches_won: s.w,
      matches_drawn: s.d,
      matches_lost: s.l,
      points_for: s.pf,
      points_against: s.pa,
    };
  });
  rows.sort(
    (a, b) =>
      b.total - a.total ||
      b.points_for - a.points_for ||
      a.points_against - b.points_against
  );
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}

/** e.g. [1,2,3,7] → "GW 1–3, GW 7" */
function formatGwWeekRangeList(gameweeks) {
  if (!gameweeks?.length) return '—';
  const g = [...gameweeks].sort((a, b) => a - b);
  const parts = [];
  let i = 0;
  while (i < g.length) {
    const start = g[i];
    let end = start;
    while (i + 1 < g.length && g[i + 1] === end + 1) {
      i += 1;
      end = g[i];
    }
    parts.push(start === end ? `GW ${start}` : `GW ${start}–${end}`);
    i += 1;
  }
  return parts.join(', ');
}

/**
 * After each finished gameweek G, cumulative H2H table through G (same ordering as
 * deriveStandingsFromMatches). Records which weeks each team ranks 1st or last.
 */
function buildGwRankExtremes(matchList, leagueEntries, teams) {
  const idSet = new Set();
  for (const e of leagueEntries || []) {
    if (e?.id != null) idSet.add(e.id);
  }
  const finished = (matchList || []).filter((m) => m.finished);
  for (const m of finished) {
    idSet.add(m.league_entry_1);
    idSet.add(m.league_entry_2);
  }
  const ids = [...idSet].filter((x) => x != null).sort((a, b) => a - b);
  const teamCount = ids.length;
  if (teamCount === 0) {
    return {
      gwRankExtremesMeta: { maxGw: 0, teamCount: 0 },
      gwWeeksAtFirst: [],
      gwWeeksAtLast: [],
    };
  }
  for (const id of ids) {
    if (!teams[id]) {
      teams[id] = { id, entry_id: id, entry_name: `Team ${id}` };
    }
  }

  const maxGw = Math.max(0, ...finished.map((m) => Number(m.event) || 0));
  const firstMap = Object.fromEntries(ids.map((id) => [id, []]));
  const lastMap = Object.fromEntries(ids.map((id) => [id, []]));

  for (let gw = 1; gw <= maxGw; gw++) {
    const st = Object.fromEntries(
      ids.map((id) => [id, { w: 0, d: 0, l: 0, pf: 0, pa: 0 }]),
    );
    for (const m of finished) {
      if (Number(m.event) > gw) continue;
      const id1 = m.league_entry_1;
      const id2 = m.league_entry_2;
      const p1 = m.league_entry_1_points ?? 0;
      const p2 = m.league_entry_2_points ?? 0;
      if (!st[id1] || !st[id2]) continue;
      st[id1].pf += p1;
      st[id1].pa += p2;
      st[id2].pf += p2;
      st[id2].pa += p1;
      if (p1 > p2) {
        st[id1].w += 1;
        st[id2].l += 1;
      } else if (p2 > p1) {
        st[id2].w += 1;
        st[id1].l += 1;
      } else {
        st[id1].d += 1;
        st[id2].d += 1;
      }
    }
    const rows = ids.map((id) => {
      const s = st[id];
      const total = s.w * 3 + s.d;
      return { id, total, pf: s.pf, pa: s.pa };
    });
    rows.sort(
      (a, b) =>
        b.total - a.total ||
        b.pf - a.pf ||
        a.pa - b.pa,
    );
    firstMap[rows[0].id].push(gw);
    lastMap[rows[teamCount - 1].id].push(gw);
  }

  function pack(map) {
    return ids
      .map((id) => {
        const gameweeks = map[id];
        return {
          league_entry: id,
          teamName: teams[id]?.entry_name ?? `Team ${id}`,
          count: gameweeks.length,
          gameweeks,
          weeksLabel: formatGwWeekRangeList(gameweeks),
          weeksTitle: gameweeks.length
            ? gameweeks
                .slice()
                .sort((a, b) => a - b)
                .map((x) => `GW ${x}`)
                .join(', ')
            : '',
        };
      })
      .filter((r) => r.count > 0)
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.teamName.localeCompare(b.teamName, undefined, {
            sensitivity: 'base',
          }),
      )
      .map((r, idx) => ({ ...r, listRank: idx + 1 }));
  }

  return {
    gwRankExtremesMeta: { maxGw, teamCount },
    gwWeeksAtFirst: pack(firstMap),
    gwWeeksAtLast: pack(lastMap),
  };
}

function nextOpponent(entryId, matches, teams) {
  const upcoming = matches
    .filter(
      (m) =>
        !m.finished &&
        (m.league_entry_1 === entryId || m.league_entry_2 === entryId)
    )
    .sort((a, b) => a.event - b.event);
  const m = upcoming[0];
  if (!m) return null;
  const oid = opponentId(m, entryId);
  return {
    id: oid,
    name: teams[oid]?.entry_name ?? 'TBC',
  };
}

function processLeagueData(raw, extras = {}) {
  const isSampleData = raw._tcMeta?.isSample === true;
  const details = { ...raw };
  delete details._tcMeta;

  let leagueEntries = (details.league_entries || []).map((e) => ({
    ...e,
    entry_name: displayEntryName(e, extras.currentSeasonNameByManager),
  }));
  const matches = details.matches || [];
  let standingsRaw = details.standings || [];

  const teams = buildTeamsMap(leagueEntries, extras.currentSeasonNameByManager);
  const finishedCount = matches.filter((m) => m.finished).length;

  if (finishedCount > 0 && leagueEntries.length > 0) {
    standingsRaw = deriveStandingsFromMatches(leagueEntries, matches, teams);
  } else if (!standingsRaw.length && finishedCount > 0 && leagueEntries.length === 0) {
    standingsRaw = deriveStandingsFromMatches([], matches, teams);
  }

  const standings = standingsRaw.map((s) => ({
    ...s,
    teamName: teams[s.league_entry]?.entry_name ?? `Team ${s.league_entry}`,
    manager: `${teams[s.league_entry]?.player_first_name ?? ''} ${teams[s.league_entry]?.player_last_name ?? ''}`.trim(),
  }));

  const sortedByRank = [...standings].sort((a, b) => a.rank - b.rank);
  const defaultKitIndexByLeagueEntry = buildDefaultKitIndexByLeagueEntry(
    sortedByRank,
    teams,
  );

  const { gwRankExtremesMeta, gwWeeksAtFirst, gwWeeksAtLast } = buildGwRankExtremes(
    matches,
    leagueEntries,
    teams,
  );

  const winMarginByEntry = {};
  for (const e of leagueEntries || []) {
    if (e?.id == null) continue;
    winMarginByEntry[e.id] = Object.fromEntries(
      WIN_MARGIN_BUCKET_KEYS.map((k) => [k, 0])
    );
  }
  for (const m of matches || []) {
    if (!m.finished) continue;
    const p1 = m.league_entry_1_points ?? 0;
    const p2 = m.league_entry_2_points ?? 0;
    if (p1 === p2) continue;
    const winner =
      p1 > p2 ? m.league_entry_1 : m.league_entry_2;
    const margin = Math.abs(p1 - p2);
    const key = winMarginBucketKey(margin);
    if (winMarginByEntry[winner]) {
      winMarginByEntry[winner][key] += 1;
    }
  }
  const winMarginBucketRows = sortedByRank.map((s) => {
    const b = winMarginByEntry[s.league_entry] ?? {};
    const totalWins = WIN_MARGIN_BUCKET_KEYS.reduce((sum, k) => sum + (b[k] ?? 0), 0);
    return {
      league_entry: s.league_entry,
      teamName: s.teamName,
      buckets: b,
      totalWins,
    };
  });

  const lossMarginByEntry = {};
  for (const e of leagueEntries || []) {
    if (e?.id == null) continue;
    lossMarginByEntry[e.id] = Object.fromEntries(
      WIN_MARGIN_BUCKET_KEYS.map((k) => [k, 0])
    );
  }
  for (const m of matches || []) {
    if (!m.finished) continue;
    const p1 = m.league_entry_1_points ?? 0;
    const p2 = m.league_entry_2_points ?? 0;
    if (p1 === p2) continue;
    const loser = p1 < p2 ? m.league_entry_1 : m.league_entry_2;
    const margin = Math.abs(p1 - p2);
    const key = winMarginBucketKey(margin);
    if (lossMarginByEntry[loser]) {
      lossMarginByEntry[loser][key] += 1;
    }
  }
  const lossMarginBucketRows = sortedByRank.map((s) => {
    const b = lossMarginByEntry[s.league_entry] ?? {};
    const totalLosses = WIN_MARGIN_BUCKET_KEYS.reduce((sum, k) => sum + (b[k] ?? 0), 0);
    return {
      league_entry: s.league_entry,
      teamName: s.teamName,
      buckets: b,
      totalLosses,
    };
  });

  const finished = matches.filter((m) => m.finished);

  const tableRows = sortedByRank.map((s) => {
    const eid = s.league_entry;
    const pl =
      (s.matches_won ?? 0) + (s.matches_drawn ?? 0) + (s.matches_lost ?? 0);
    const gf = s.points_for ?? 0;
    const ga = s.points_against ?? 0;
    const seq = formSequence(eid, finished, FORM_LAST_N, teams);
    while (seq.length < FORM_LAST_N) seq.unshift(null);
    const next = nextOpponent(eid, matches, teams);
    return {
      ...s,
      pl,
      gf,
      ga,
      gd: gf - ga,
      form: seq.slice(-FORM_LAST_N),
      next,
    };
  });

  function buildFormStrip(entryId) {
    const mine = finished
      .filter(
        (m) =>
          m.league_entry_1 === entryId || m.league_entry_2 === entryId
      )
      .sort((a, b) => a.event - b.event || (a.id ?? 0) - (b.id ?? 0))
      .slice(-FORM_STRIP_N);
    return mine.map((m) => {
      const oppId = opponentId(m, entryId);
      const myPts =
        m.league_entry_1 === entryId
          ? m.league_entry_1_points
          : m.league_entry_2_points;
      const oppPts =
        m.league_entry_1 === entryId
          ? m.league_entry_2_points
          : m.league_entry_1_points;
      const res = resultForEntry(m, entryId);
      return {
        scoreStr: `${myPts} - ${oppPts}`,
        result: res,
        opponentName: teams[oppId]?.entry_name ?? '?',
        opponentEntryId: oppId,
        event: m.event,
      };
    });
  }

  const teamFormStripByEntry = Object.fromEntries(
    sortedByRank.map((s) => [s.league_entry, buildFormStrip(s.league_entry)])
  );

  const teamsForFormSelect = sortedByRank.map((s) => {
    const lid = Number(s.league_entry);
    const entryRow = leagueEntries.find(
      (e) => e?.id != null && Number(e.id) === lid
    );
    return {
      id: s.league_entry,
      fplEntryId:
        entryRow?.entry_id != null ? Number(entryRow.entry_id) : null,
      rank: s.rank,
      teamName: s.teamName,
      /** Live scores redesign (PR #5) — manager name for face-off `mgr · #rank` sub-line. */
      manager: s.manager ?? null,
    };
  });

  const finishedSorted = [...finished].sort((a, b) => {
    if (b.event !== a.event) return b.event - a.event;
    return (b.id ?? 0) - (a.id ?? 0);
  });

  const previousFixtures = finishedSorted.slice(0, 24).map((m) => ({
    event: m.event,
    homeId: m.league_entry_1,
    awayId: m.league_entry_2,
    homeName: teams[m.league_entry_1]?.entry_name ?? '?',
    awayName: teams[m.league_entry_2]?.entry_name ?? '?',
    homePts: m.league_entry_1_points,
    awayPts: m.league_entry_2_points,
  }));

  const upcoming = matches
    .filter((m) => !m.finished)
    .sort((a, b) => a.event - b.event || (a.id ?? 0) - (b.id ?? 0));

  const nextEvent = upcoming.length ? Math.min(...upcoming.map((m) => m.event)) : null;
  const nextFixtures = upcoming
    .filter((m) => m.event === nextEvent)
    .map((m) => ({
      event: m.event,
      homeId: m.league_entry_1,
      awayId: m.league_entry_2,
      homeName: teams[m.league_entry_1]?.entry_name ?? '?',
      awayName: teams[m.league_entry_2]?.entry_name ?? '?',
    }));

  const allUpcomingByGw = {};
  for (const m of upcoming) {
    if (!allUpcomingByGw[m.event]) allUpcomingByGw[m.event] = [];
    allUpcomingByGw[m.event].push({
      event: m.event,
      homeId: m.league_entry_1,
      awayId: m.league_entry_2,
      homeName: teams[m.league_entry_1]?.entry_name ?? '?',
      awayName: teams[m.league_entry_2]?.entry_name ?? '?',
    });
  }
  const upcomingRounds = Object.keys(allUpcomingByGw)
    .map(Number)
    .sort((a, b) => a - b)
    .slice(0, 3)
    .map((ev) => ({ gameweek: ev, fixtures: allUpcomingByGw[ev] }));

  const nextMatchHeadline =
    nextFixtures[0] &&
    `${nextFixtures[0].homeName} vs ${nextFixtures[0].awayName}`;

  const lastFinishedGw = finished.length
    ? Math.max(...finished.map((m) => m.event))
    : null;
  const previousGameweekFixtures =
    lastFinishedGw != null
      ? finished
          .filter((m) => m.event === lastFinishedGw)
          .map((m) => ({
            event: m.event,
            homeId: m.league_entry_1,
            awayId: m.league_entry_2,
            homeName: teams[m.league_entry_1]?.entry_name ?? '?',
            awayName: teams[m.league_entry_2]?.entry_name ?? '?',
            homePts: m.league_entry_1_points,
            awayPts: m.league_entry_2_points,
          }))
      : [];

  const mostWaiveredPlayers = buildMostWaivered(
    extras.transactions,
    extras.fplMini
  );

  /** Sum of opponent FPL points in every finished H2H (same as standings “Faced”). */
  const elemById = Object.fromEntries(
    (extras.fplMini?.elements || []).map((e) => [e.id, e])
  );
  const teamById = Object.fromEntries(
    (extras.fplMini?.teams || []).map((t) => [t.id, t])
  );
  const waiverOutGwRows = (extras.waiverOutGw?.rows || []).map((row) => {
    const dropEl = elemById[row.element_out];
    const pickEl = elemById[row.element_in];
    const dropTm = dropEl ? teamById[dropEl.team] : null;
    const pickTm = pickEl ? teamById[pickEl.team] : null;
    return {
      ...row,
      teamName: teams[row.entry]?.entry_name ?? `Team ${row.entry}`,
      droppedName:
        fplElementWebName(dropEl, row.element_out) ??
        `Player #${row.element_out}`,
      pickedName:
        fplElementWebName(pickEl, row.element_in) ??
        `Player #${row.element_in}`,
      droppedTeamShort: dropTm?.short_name ?? '—',
      pickedTeamShort: pickTm?.short_name ?? '—',
      pickedPos: POS_BY_TYPE[pickEl?.element_type] ?? null,
      droppedPos: POS_BY_TYPE[dropEl?.element_type] ?? null,
      droppedShirtUrl: fplShirtImageUrl(dropTm?.code, dropEl?.element_type),
      droppedBadgeUrl:
        dropTm?.code != null
          ? `https://resources.premierleague.com/premierleague/badges/50/t${dropTm.code}.png`
          : null,
      pickedShirtUrl: fplShirtImageUrl(pickTm?.code, pickEl?.element_type),
      pickedBadgeUrl:
        pickTm?.code != null
          ? `https://resources.premierleague.com/premierleague/badges/50/t${pickTm.code}.png`
          : null,
    };
  });

  const waiverOutByTxId = new Map(
    waiverOutGwRows.map((r) => [r.transactionId, r]),
  );
  const firstWaiverOrderPicks = buildFirstWaiverOrderPicks(
    extras.transactions,
    teams,
    elemById,
    teamById,
    waiverOutByTxId,
  );

  const waiverInTenureTopRows = (extras.waiverInTenureTop?.rows || []).map(
    (r) => {
      const e = elemById[r.elementId];
      const tm = e ? teamById[e.team] : null;
      return {
        ...r,
        teamName: teams[r.entry]?.entry_name ?? `Team ${r.entry}`,
        leagueEntryId: teams[r.entry]?.id ?? r.entry,
        playerName: fplElementWebName(e, r.elementId),
        teamShort: tm?.short_name ?? '—',
        teamId: e?.team,
        pos: POS_BY_TYPE[e?.element_type] ?? null,
        shirtUrl: fplShirtImageUrl(tm?.code, e?.element_type),
        badgeUrl:
          tm?.code != null
            ? `https://resources.premierleague.com/premierleague/badges/50/t${tm.code}.png`
            : null,
      };
    }
  );

  const totals = extras.waiverInTenureTop?.teamWaiverInTotals || [];
  const waiverInByFplEntry = new Map(totals.map((t) => [t.entry, t]));
  const waiverInByLeagueEntry = new Map(
    totals.filter((t) => t.leagueEntry != null).map((t) => [t.leagueEntry, t])
  );
  /** Successful waiver swaps per FPL entry (kind w). Same volume as waiver-outs. */
  const waiverSwapCountByEntry = new Map();
  for (const r of waiverOutGwRows) {
    if (r.transactionKind === 'f') continue;
    const id = r.entry;
    waiverSwapCountByEntry.set(id, (waiverSwapCountByEntry.get(id) || 0) + 1);
  }
  const waiverInPointsByTeam = sortedByRank
    .map((s) => {
      const fplId = teams[s.league_entry]?.entry_id ?? s.league_entry;
      const o =
        waiverInByLeagueEntry.get(s.league_entry) ??
        waiverInByFplEntry.get(fplId) ??
        waiverInByFplEntry.get(s.league_entry);
      const totalWaiverInPoints = o?.totalWaiverInPoints ?? 0;
      const distinctWaiverPlayers = o?.distinctPlayers ?? 0;
      /* Prefer stint count from analytics; fall back to swap rows so In/Out volume matches. */
      const waiverInCount =
        o?.waiverInCount ??
        waiverSwapCountByEntry.get(fplId) ??
        0;
      const averageWaiverInPerPlayer =
        waiverInCount > 0
          ? Math.round((totalWaiverInPoints / waiverInCount) * 10) / 10
          : null;
      return {
        league_entry: s.league_entry,
        teamName: s.teamName,
        totalWaiverInPoints,
        waiverInCount,
        distinctWaiverPlayers,
        averageWaiverInPerPlayer,
      };
    })
    .sort((a, b) => {
      const avg = (t) =>
        t.waiverInCount > 0 ? t.averageWaiverInPerPlayer ?? 0 : -Infinity;
      const byAvg = avg(b) - avg(a);
      if (byAvg !== 0) return byAvg;
      return (
        b.totalWaiverInPoints - a.totalWaiverInPoints ||
        a.teamName.localeCompare(b.teamName)
      );
    });

  /** Per team: sum of dropped players’ GW points on every successful waiver (transaction.entry = entry_id). */
  const waiverOutPointsByTeam = sortedByRank
    .map((s) => {
      const tm = teams[s.league_entry];
      const entryId = tm?.entry_id ?? s.league_entry;
      let totalDroppedGwPoints = 0;
      let waiverOutCount = 0;
      let knownPtsCount = 0;
      for (const r of waiverOutGwRows) {
        if (r.entry !== entryId) continue;
        if (r.transactionKind === 'f') continue;
        waiverOutCount += 1;
        if (typeof r.droppedPlayerGwPoints === 'number') {
          totalDroppedGwPoints += r.droppedPlayerGwPoints;
          knownPtsCount += 1;
        }
      }
      const averageDroppedGwPoints =
        waiverOutCount > 0
          ? Math.round((totalDroppedGwPoints / waiverOutCount) * 10) / 10
          : null;
      return {
        league_entry: s.league_entry,
        teamName: s.teamName,
        totalDroppedGwPoints,
        waiverOutCount,
        knownPtsCount,
        averageDroppedGwPoints,
      };
    })
    .sort((a, b) => {
      const avgScore = (t) =>
        t.waiverOutCount > 0 ? t.averageDroppedGwPoints ?? 0 : -Infinity;
      const byAvg = avgScore(b) - avgScore(a);
      if (byAvg !== 0) return byAvg;
      const byTotal = b.totalDroppedGwPoints - a.totalDroppedGwPoints;
      if (byTotal !== 0) return byTotal;
      return a.teamName.localeCompare(b.teamName);
    });

  const tradesPanelRows = processTradesPanel(
    extras.tradesPanel,
    elemById,
    teamById
  );

  return {
    league: details.league,
    /** League members with current-season club names overlaid when known. */
    leagueEntries,
    /** `league_entry` / `entry_id` → 0–11 shirt kit (standings order). */
    defaultKitIndexByLeagueEntry,
    /** Raw H2H schedule (pair with `gameweek` for Live tab fixtures). */
    matches: details.matches || [],
    standings: sortedByRank,
    tableRows,
    teamFormStripByEntry,
    teamsForFormSelect,
    previousFixtures,
    nextFixtures,
    nextEvent,
    nextGameweekFixtures: nextFixtures,
    previousGameweek: lastFinishedGw,
    previousGameweekFixtures,
    upcomingRounds,
    nextMatchHeadline,
    gwRankExtremesMeta,
    gwWeeksAtFirst,
    gwWeeksAtLast,
    mostWaiveredPlayers,
    waiverOutGwRows,
    firstWaiverOrderPicks,
    waiverOutPointsByTeam,
    waiverInTenureTopRows,
    waiverInPointsByTeam,
    winMarginBucketRows,
    lossMarginBucketRows,
    tradesPanelRows,
    isSampleData,
  };
}

export { FORM_LAST_N, FORM_STRIP_N };
