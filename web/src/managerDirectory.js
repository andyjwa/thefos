/**
 * Manager directory — module-level lookup from a team's FPL id to the
 * manager's name, so the shared TeamAvatar circle badge can render manager
 * initials without threading a manager prop through every call site.
 *
 * Populated by `useLeagueData` whenever league details are (re)processed;
 * keyed by both the draft `id` (used by matches/standings) and the global
 * `entry_id`, with `id` keys taking precedence on collisions (same rule as
 * `buildTeamsMap`).
 */

/** @type {Map<number, { first: string, last: string }>} */
const byEntry = new Map()

/**
 * Replace the directory from a league's entries.
 * @param {Array<{ id?: number, entry_id?: number, player_first_name?: string, player_last_name?: string }> | null | undefined} leagueEntries
 */
export function setManagerDirectory(leagueEntries) {
  byEntry.clear()
  const rows = Array.isArray(leagueEntries) ? leagueEntries : []
  const aliasQueue = []
  for (const e of rows) {
    if (!e) continue
    const first = String(e.player_first_name ?? '').trim()
    const last = String(e.player_last_name ?? '').trim()
    if (!first && !last) continue
    const rec = { first, last }
    const id = Number(e.id)
    if (Number.isFinite(id)) byEntry.set(id, rec)
    const fpl = Number(e.entry_id)
    if (Number.isFinite(fpl) && fpl !== id) aliasQueue.push([fpl, rec])
  }
  for (const [fpl, rec] of aliasQueue) {
    if (!byEntry.has(fpl)) byEntry.set(fpl, rec)
  }
}

/**
 * Initials (max 2 chars) from explicit first/last tokens.
 * @param {string} first
 * @param {string} last
 * @returns {string}
 */
function initialsFromNames(first, last) {
  const a = first ? first[0] : ''
  const b = last ? last[0] : ''
  return `${a}${b}`.toUpperCase()
}

/**
 * Initials from a free-form display name — first letter of the first and
 * last whitespace-separated words (single word → its first letter).
 * @param {string | null | undefined} text
 * @returns {string}
 */
export function initialsFromDisplayName(text) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0][0].toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

/**
 * Manager initials for a team id (draft `id` or FPL `entry_id`).
 * Returns '' when the manager isn't known (caller falls back to team name).
 * @param {number | string | null | undefined} entryId
 * @returns {string}
 */
export function managerInitialsForEntry(entryId) {
  const n = Number(entryId)
  if (!Number.isFinite(n)) return ''
  const rec = byEntry.get(n)
  if (!rec) return ''
  return initialsFromNames(rec.first, rec.last)
}
