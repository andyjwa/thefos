/**
 * LeagueInfoModal — disclosure target for the BrandHeaderWordmark
 * trigger. Renders the LP-C "sectioned cards on themed background"
 * layout from the design exploration (see `LiVariantC` in
 * `web/src/Mockup.jsx`). Layout:
 *
 *   1. Hero card        — a single branded header banner
 *                         (`/brand/tclot-header.jpg`) that carries the
 *                         TCLOT lion logo, the wordmark, the "Tri-
 *                         Continental League of Titans" subtitle, and the
 *                         three country flags in one 16:9 image. It
 *                         replaced the earlier belt + <h1> + flag-row
 *                         composition.
 *   2. Tab strip        — Lingo · Teams · Managers · Settings.
 *                         The site-standard `.subnav` segmented pill row
 *                         (same look as the Heritage / Standings sub-
 *                         tabs) that gates the four content cards beneath
 *                         it. Default landing tab is `terminology`
 *                         (Lingo); resets on close.
 *   3. Active tab card  — exactly one of the four panels is rendered
 *                         per the `activeTab` state:
 *                           • Roster      — 2-up team-crest grid
 *                           • Managers    — full names + crests
 *                           • Terminology — league-canon glossary
 *                           • Settings    — `<SettingsPanelBody>`
 *                                            (shared with /settings)
 *
 * The modal portals onto `document.body` (so it clears the
 * `.app.fotmob` stacking context). All design tokens used by the
 * `.li-*` styles imported from `Mockup.css` are mirrored on the shell
 * selector in `LeagueInfoModal.css` — same trick as
 * `.live-player-slide` in `App.css`.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TeamAvatar } from './TeamAvatar'
import { SettingsPanelBody } from './SettingsPage'
import { useOverlayDismissal } from './overlayStack.js'
import './LeagueInfoModal.css'

/** Tab order — Teams first (the default landing tab), then Managers and
 * Settings. The TCLOT-era "Lingo" glossary tab is retired on thefos —
 * its terms were league-canon in-jokes about TCLOT managers. Internal
 * `id`s are kept stable so the content-panel gating + aria wiring don't
 * change. */
const LI_TABS = /** @type {const} */ ([
  { id: 'roster',      label: 'Teams' },
  { id: 'managers',    label: 'Managers' },
  { id: 'settings',    label: 'Settings' },
])

/**
 * Returns up to `count` leading initials of `text`. Used for the
 * crest/avatar fallback letters.
 * @param {string} text
 * @param {number} [count]
 */
function liInitials(text, count = 2) {
  return String(text)
    .split(/\s+/)
    .slice(0, count)
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   leagueEntries?: Array<{ id: number, entry_name?: string, player_first_name?: string, player_last_name?: string }>,
 *   teamLogoMap?: Record<string|number, string>,
 *   kitIndexByEntry?: Record<string|number, number>,
 *   gw?: number | null,
 *   themePref: 'light' | 'dark' | 'system',
 *   onThemePrefChange: (t: 'light' | 'dark' | 'system') => void,
 *   defaultTab: string,
 *   onDefaultTabChange: (id: string) => void,
 * }} props
 */
export function LeagueInfoModal({
  open,
  onClose,
  leagueEntries = [],
  teamLogoMap = {},
  kitIndexByEntry = {},
  gw, // eslint-disable-line no-unused-vars -- kept for caller-API stability
  themePref,
  onThemePrefChange,
  defaultTab,
  onDefaultTabChange,
}) {
  const closeBtnRef = useRef(null)
  const modalRef = useRef(null)
  /* Active tab inside the modal body — Teams (`roster`) on first open,
   * then sticky for the lifetime of the open instance (resets when the
   * modal is dismissed and re-opened so the user always lands on the
   * roster first). */
  const [activeTab, setActiveTab] = useState(/** @type {string} */ ('roster'))
  /* Reset to the roster whenever the modal closes — done during render
   * (React's "adjust state when props change" pattern) instead of an
   * effect, so there's no extra post-commit render pass. */
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) setActiveTab('roster')
  }

  /* Escape + browser/Android system back — shared overlay stack, same
   * as the fixture deck / player / team overlays, so back peels this
   * layer instead of leaving the site. */
  useOverlayDismissal(open, onClose, 'leagueInfo')

  useEffect(() => {
    if (!open) return undefined
    const previousActive = typeof document !== 'undefined' ? document.activeElement : null

    /** Focus trap — Tab / Shift+Tab cycle inside the modal so keyboard
     * users can't tab into the page behind. (Escape is handled by
     * `useOverlayDismissal` above.) */
    function onKey(e) {
      if (e.key !== 'Tab') return
      const root = modalRef.current
      if (!root) return
      /* Filter out display:none controls — the × close and the mobile
       * back chevron are swapped per breakpoint, so one of them is
       * always hidden and must not be a trap anchor. */
      const focusables = Array.from(
        root.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)

    /** Move focus to the close button on open. */
    const t = window.setTimeout(() => {
      closeBtnRef.current?.focus()
    }, 0)

    /** Lock body scroll while the modal is open (mobile sheet UX). */
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
      document.body.style.overflow = prevOverflow
      if (previousActive && typeof previousActive.focus === 'function') {
        try { previousActive.focus() } catch { /* ignore */ }
      }
    }
  }, [open, onClose])

  if (!open) return null

  /* Stable ordering: by `league_entry` id ascending — the standings
   * order changes week-to-week, but this list is "the league roster",
   * which is fixed. */
  const sortedEntries = [...(leagueEntries ?? [])]
    .filter((e) => e?.id != null)
    .sort((a, b) => Number(a.id) - Number(b.id))

  const body = (
    <div
      className="league-info-modal-shell"
      role="dialog"
      aria-modal="true"
      aria-labelledby="league-info-modal-title"
      id="league-info-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={modalRef}
        className="league-info-modal li-modal li-modal--lp-c"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Mobile sheet topbar — solid purple band with the app-standard
            back chevron (matches the live-score / player / team overlay
            headers). Hidden on desktop, where the centered dialog keeps
            the conventional × close instead. Absorbs the iOS status-bar
            safe area so the sheet doesn't sit under the notch in
            standalone PWA mode. */}
        <div className="league-info-modal__topbar">
          <button
            type="button"
            className="league-info-modal__back"
            aria-label="Close League Info"
            onClick={onClose}
          >
            ‹
          </button>
        </div>

        <button
          ref={closeBtnRef}
          type="button"
          className="li-modal__close league-info-modal__close"
          aria-label="Close League Info"
          onClick={onClose}
        >
          ×
        </button>

        <div className="li-modal__body li-modal__body--scroll">
          {/* Hero — plain FOS wordmark header (the TCLOT banner image is
              retired). Keeps `id="league-info-modal-title"` so the dialog's
              `aria-labelledby` still resolves to an accessible name. */}
          <div className="li-card li-card--hero">
            <div className="li-hero li-hero--wordmark">
              <h1 className="li-hero__wordmark" id="league-info-modal-title">
                FOS
                <span className="li-hero__wordmark-sub">The FOS League</span>
              </h1>
            </div>
          </div>

          {/* Tab strip — Lingo · Teams · Managers · Settings.
              Built as a `role="tablist"` so screen readers announce
              the disclosure pattern. Reuses the site-standard `.subnav`
              segmented-pill classes (same as the Heritage / Standings
              sub-tabs) so the modal switcher matches the rest of the
              site. The `li-subnav` modifier adds only minimal scoping
              (left-align + horizontal scroll on narrow viewports). */}
          <div
            className="subnav li-subnav"
            role="tablist"
            aria-label="League info sections"
          >
            {LI_TABS.map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`li-tab-${tab.id}`}
                  aria-selected={active}
                  aria-controls={`li-tabpanel-${tab.id}`}
                  className={'subnav__tab' + (active ? ' subnav__tab--active' : '')}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Teams tab (`roster`) — 8-team grid with crests + names. */}
          {activeTab === 'roster' ? (
            <div
              className="li-card li-card--badges"
              role="tabpanel"
              id="li-tabpanel-roster"
              aria-labelledby="li-tab-roster"
            >
              <div className="li-card__eyebrow">League Roster</div>
              {sortedEntries.length === 0 ? (
                <p className="league-info-modal__placeholder">League data not loaded yet.</p>
              ) : (
                <div className="li-badges-grid league-info-modal__badges-grid">
                  {sortedEntries.map((e) => {
                    const teamName = e.entry_name ?? '—'
                    return (
                      <div className="li-badge" key={e.id}>
                        <div className="li-badge__crest league-info-modal__badge-crest">
                          <TeamAvatar
                            entryId={e.id}
                            name={teamName}
                            size="md"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                            badgeFallback
                          />
                        </div>
                        <div className="li-badge__name">{teamName}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}

          {/* Managers tab — full names + team descriptor. */}
          {activeTab === 'managers' ? (
            <div
              className="li-card li-card--managers"
              role="tabpanel"
              id="li-tabpanel-managers"
              aria-labelledby="li-tab-managers"
            >
              <div className="li-card__eyebrow">Managers</div>
              {sortedEntries.length === 0 ? (
                <p className="league-info-modal__placeholder">League data not loaded yet.</p>
              ) : (
                <div className="li-managers-list">
                  {sortedEntries.map((e) => {
                    const teamName = e.entry_name ?? '—'
                    const mgr = `${e.player_first_name ?? ''} ${e.player_last_name ?? ''}`.trim() || '—'
                    return (
                      <div className="li-mgr-row" key={e.id}>
                        <div className="li-mgr-row__avatar league-info-modal__mgr-avatar">
                          <TeamAvatar
                            entryId={e.id}
                            name={teamName}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                            badgeFallback
                          />
                        </div>
                        <div className="li-mgr-row__body">
                          <div className="li-mgr-row__name">{mgr}</div>
                          <div className="li-mgr-row__descriptor" title={teamName}>{teamName}</div>
                        </div>
                        <div className="li-mgr-row__initials" aria-hidden>
                          {liInitials(mgr)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}

          {/* Settings tab — embeds the standalone /settings route's
              SettingsPanelBody so the two surfaces never drift. */}
          {activeTab === 'settings' ? (
            <div
              className="li-card li-card--settings"
              role="tabpanel"
              id="li-tabpanel-settings"
              aria-labelledby="li-tab-settings"
            >
              <div className="li-card__eyebrow">Settings</div>
              <SettingsPanelBody
                themePref={themePref}
                onThemePrefChange={onThemePrefChange}
                defaultTab={defaultTab}
                onDefaultTabChange={onDefaultTabChange}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return body
  return createPortal(body, document.body)
}
