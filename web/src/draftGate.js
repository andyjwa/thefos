/**
 * Pre-draft chrome gate.
 *
 * Until the FPL draft is complete, desktop + mobile nav only expose Moves
 * (Draft). On mobile, the brand-header status strip ("Pre-season · …")
 * stays hidden until one hour after the draft finishes, then returns.
 * The wordmark + season row stays visible throughout.
 */

export const DRAFT_HEADER_RESUME_MS = 60 * 60 * 1000

const PRE_DRAFT_ALLOWED_VIEWS = new Set(['teamSelection'])

/** @param {unknown} value */
export function parseDraftInstant(value) {
  if (value == null || value === '') return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

/**
 * @param {object | null | undefined} league `details.league` payload
 * @param {Date | number} [now]
 * @param {{ archiveView?: boolean }} [opts]
 */
export function resolveDraftGate(league, now = new Date(), opts = {}) {
  if (opts.archiveView) {
    return {
      navLocked: false,
      hideMobileStatusStrip: false,
      draftCompletedAtMs: null,
      headerResumeAtMs: null,
    }
  }

  const status = String(league?.draft_status ?? '').toLowerCase()
  const transactionMode = String(league?.transaction_mode ?? '').toLowerCase()
  const drafts = Array.isArray(league?.drafts) ? league.drafts : []
  const primary = drafts[0] ?? null
  const completedAtMs = parseDraftInstant(primary?.draft_completed)
  const nowMs = now instanceof Date ? now.getTime() : Number(now)

  const isComplete =
    status === 'post' ||
    completedAtMs != null ||
    (transactionMode !== '' && transactionMode !== 'not-drafted')

  const headerResumeAtMs = isComplete
    ? (completedAtMs ?? (Number.isFinite(nowMs) ? nowMs : Date.now())) +
      DRAFT_HEADER_RESUME_MS
    : null

  const hideMobileStatusStrip =
    !isComplete ||
    (headerResumeAtMs != null &&
      Number.isFinite(nowMs) &&
      nowMs < headerResumeAtMs)

  return {
    navLocked: !isComplete,
    hideMobileStatusStrip,
    draftCompletedAtMs: completedAtMs,
    headerResumeAtMs,
  }
}

/** @param {string} view */
export function isPreDraftAllowedView(view) {
  return PRE_DRAFT_ALLOWED_VIEWS.has(view)
}
