/**
 * Twelve default kits for shirt avatars (no uploaded logo). Assigned by standings order
 * (1st → 0, …) with wrap `(rank - 1) % 12` when a league has more than 12 teams.
 *
 * Modes: solid | stripes-v (vertical) | stripes-h (horizontal bands).
 */
export const TEAM_KIT_COUNT = 12

/**
 * Twelve distinct circle-badge colours (bg + legible text) for the default
 * team avatar — a coloured disc with the manager's initials. Index-aligned
 * with {@link TEAM_KITS} (same standings-order assignment) so hues stay
 * stable per team across surfaces.
 */
export const TEAM_CIRCLES = [
  { bg: '#7dd3fc', text: '#0c4a6e' }, // sky
  { bg: '#1d4ed8', text: '#eff6ff' }, // royal blue
  { bg: '#9f1b2e', text: '#fff5f5' }, // maroon
  { bg: '#14532d', text: '#ecfdf3' }, // forest green
  { bg: '#171717', text: '#fafafa' }, // black
  { bg: '#65a30d', text: '#f7fee7' }, // olive
  { bg: '#f8fafc', text: '#0f172a' }, // white
  { bg: '#c41e1e', text: '#fef2f2' }, // red
  { bg: '#0f766e', text: '#f0fdfa' }, // teal
  { bg: '#facc15', text: '#422006' }, // yellow
  { bg: '#ec4899', text: '#fdf2f8' }, // pink
  { bg: '#ea580c', text: '#fff7ed' }, // orange
]

export const TEAM_KITS = [
  {
    mode: 'solid',
    fill: '#7dd3fc',
    text: '#0c4a6e',
    outline: 'dark',
  },
  {
    mode: 'stripes-v',
    a: '#e0f2fe',
    b: '#1d4ed8',
    text: '#ffffff',
    outline: 'dark',
  },
  {
    mode: 'solid',
    fill: '#9f1b2e',
    text: '#fff5f5',
    outline: 'dark',
  },
  {
    mode: 'solid',
    fill: '#14532d',
    text: '#ecfdf3',
    outline: 'dark',
  },
  {
    mode: 'stripes-v',
    a: '#fafafa',
    b: '#171717',
    text: '#ffffff',
    outline: 'dark',
  },
  {
    mode: 'stripes-v',
    a: '#eab308',
    b: '#166534',
    text: '#ffffff',
    outline: 'dark',
  },
  {
    mode: 'solid',
    fill: '#f8fafc',
    text: '#0f172a',
    outline: 'light',
  },
  {
    mode: 'stripes-h',
    a: '#ffffff',
    b: '#c41e1e',
    text: '#ffffff',
    outline: 'dark',
  },
  {
    mode: 'solid',
    fill: '#1e3a8a',
    text: '#eff6ff',
    outline: 'dark',
  },
  {
    mode: 'solid',
    fill: '#facc15',
    text: '#422006',
    outline: 'dark',
  },
  {
    mode: 'solid',
    fill: '#ec4899',
    text: '#fdf2f8',
    outline: 'dark',
  },
  {
    mode: 'solid',
    fill: '#ea580c',
    text: '#fff7ed',
    outline: 'dark',
  },
]
