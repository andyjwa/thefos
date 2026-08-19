import { useState, useMemo } from 'react'
import { TEAM_CIRCLES, TEAM_KIT_COUNT } from './teamKitStyles'
import {
  initialsFromDisplayName,
  managerInitialsForEntry,
} from './managerDirectory.js'

const RAW_BASE = `${import.meta.env.BASE_URL}team-logos/`
const WEB_BASE = `${import.meta.env.BASE_URL}team-logos-web/`
const LOGO_EXTS = ['png', 'PNG', 'jpg', 'JPG', 'jpeg', 'JPEG', 'webp', 'WEBP']

/**
 * FPL draft `id` (passed as `entryId` to TeamAvatar) — logos that are a small circle on a
 * square canvas get `team-avatar-frame--logo-zoom`; everyone else stays 1:1 in the clip.
 */
const LOGO_ZOOM_ENTRY_IDS = new Set([39219, 26587, 40206, 27370])


/**
 * @param {boolean} [customLogoOnly] If true, skip auto-generated team-logos-web assets; only
 *   `logoMap` entries and raw files under team-logos/ (custom uploads).
 */
function buildSrcList(entryId, logoMap, customLogoOnly) {
  const key = String(entryId)
  const mapped = logoMap[key]
  if (mapped) {
    const mappedRaw = `${RAW_BASE}${mapped}`
    // Named LOTR sources may live only under team-logos-web/ (preseason drop).
    const mappedWeb = `${WEB_BASE}${mapped}`
    if (customLogoOnly) return [mappedRaw, mappedWeb]
    // Prefer 192×192 pipeline output keyed by entry id (avoids huge JPG decode).
    return [`${WEB_BASE}${entryId}.png`, mappedWeb, mappedRaw]
  }

  const rawList = []
  for (const ext of LOGO_EXTS) {
    rawList.push(`${RAW_BASE}${entryId}.${ext}`)
  }

  if (customLogoOnly) {
    return rawList
  }
  // Prefer uploads in team-logos/ before pipeline output in team-logos-web/
  return [...rawList, `${WEB_BASE}${entryId}.png`]
}

/**
 * Same URL list as {@link TeamAvatar} (for favicon / preload).
 * @param {number | string | null | undefined} entryId
 * @param {Record<string, string>} logoMap
 * @param {boolean} [customLogoOnly]
 * @returns {string[]}
 */
export function teamLogoSrcList(entryId, logoMap, customLogoOnly = false) {
  if (entryId == null || entryId === '') return []
  const n = Number(entryId)
  if (!Number.isFinite(n)) return []
  return buildSrcList(n, logoMap || {}, customLogoOnly)
}

function fnv1a32(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Map hit from standings-assigned kits; else stable hash fallback. */
function resolveKitIndex(entryId, kitIndexByEntry, name) {
  if (entryId != null && kitIndexByEntry && typeof kitIndexByEntry === 'object') {
    const n = Number(entryId)
    const raw = kitIndexByEntry[n] ?? kitIndexByEntry[String(n)]
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const m = Math.floor(raw) % TEAM_KIT_COUNT
      return ((m % TEAM_KIT_COUNT) + TEAM_KIT_COUNT) % TEAM_KIT_COUNT
    }
  }
  const key = `${entryId == null ? '' : String(entryId)}\u{1e}${name == null ? '' : String(name)}`
  const h = fnv1a32(key)
  const mixed = Math.imul(h, 2654435769) >>> 0
  return mixed % TEAM_KIT_COUNT
}

/**
 * Default team avatar — one of 12 unique coloured circles with the manager's
 * initials (falls back to team-name initials when the manager isn't in the
 * directory yet). Keeps the legacy `team-shirt team-shirt--{size}` classes so
 * every per-surface layout rule keeps sizing the badge correctly.
 */
function CircleKitBadge({ name, entryId, size, kitIndex }) {
  const circle = TEAM_CIRCLES[kitIndex] ?? TEAM_CIRCLES[0]
  const initials =
    managerInitialsForEntry(entryId) || initialsFromDisplayName(name) || '?'
  return (
    <span
      className={`team-shirt team-shirt--${size} team-kit-circle team-kit-circle--${size}`}
      style={{ background: circle.bg, color: circle.text }}
      aria-hidden
    >
      <span className="team-kit-circle__glyph">{initials}</span>
    </span>
  )
}

/**
 * Prefers pre-sized assets in team-logos-web/ (run: npm run dev / npm run build).
 */
export function TeamAvatar({
  entryId,
  name,
  size = 'md',
  logoMap = {},
  kitIndexByEntry,
  /** If true, render nothing when no custom logo image loads (no circle initials fallback). */
  noFallback = false,
  /** If true, only try custom uploads (team-logos/ + logoMap), not team-logos-web pipeline. */
  customLogoOnly = false,
  /** Legacy no-op — the coloured circle badge is now the only fallback. */
  badgeFallback = false, // eslint-disable-line no-unused-vars -- kept for caller-API stability
}) {
  const kitIndex = useMemo(
    () => resolveKitIndex(entryId, kitIndexByEntry, name),
    [entryId, kitIndexByEntry, name],
  )
  const srcList = useMemo(
    () => buildSrcList(entryId, logoMap, customLogoOnly),
    [entryId, logoMap, customLogoOnly],
  )
  const [idx, setIdx] = useState(0)
  const [showInitials, setShowInitials] = useState(false)

  const logoZoom = useMemo(() => {
    const n = Number(entryId)
    return Number.isFinite(n) && LOGO_ZOOM_ENTRY_IDS.has(n)
  }, [entryId])

  if (entryId == null || showInitials) {
    if (noFallback) return null
    return (
      <CircleKitBadge
        name={name}
        entryId={entryId}
        size={size}
        kitIndex={kitIndex}
      />
    )
  }

  const src = srcList[idx]
  if (!src) {
    if (noFallback) return null
    return (
      <CircleKitBadge
        name={name}
        entryId={entryId}
        size={size}
        kitIndex={kitIndex}
      />
    )
  }

  return (
    <span
      className={`team-avatar-frame team-avatar-frame--${size}${
        logoZoom ? ' team-avatar-frame--logo-zoom' : ''
      }`}
    >
      <img
        className="team-avatar"
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => {
          if (idx < srcList.length - 1) setIdx((i) => i + 1)
          else setShowInitials(true)
        }}
      />
    </span>
  )
}
