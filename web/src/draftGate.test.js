import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DRAFT_HEADER_RESUME_MS,
  isPreDraftAllowedView,
  parseDraftInstant,
  resolveDraftGate,
} from './draftGate.js'

const DRAFT_DT = '2026-08-17T13:00:00Z'

function league(overrides = {}) {
  return {
    draft_dt: DRAFT_DT,
    draft_status: 'pre',
    transaction_mode: 'not-drafted',
    drafts: [
      {
        draft_started: false,
        draft_completed: null,
        draft_dt: DRAFT_DT,
      },
    ],
    ...overrides,
  }
}

test('parseDraftInstant — ISO / null / garbage', () => {
  assert.equal(parseDraftInstant(DRAFT_DT), Date.parse(DRAFT_DT))
  assert.equal(parseDraftInstant(null), null)
  assert.equal(parseDraftInstant('nope'), null)
})

test('pre-draft: nav locked and mobile status strip hidden', () => {
  const gate = resolveDraftGate(league(), new Date('2026-08-04T18:00:00Z'))
  assert.equal(gate.navLocked, true)
  assert.equal(gate.hideMobileStatusStrip, true)
})

test('archive view never locks chrome', () => {
  const gate = resolveDraftGate(league(), new Date('2026-08-04T18:00:00Z'), {
    archiveView: true,
  })
  assert.equal(gate.navLocked, false)
  assert.equal(gate.hideMobileStatusStrip, false)
})

test('draft_status post unlocks nav; header waits one hour', () => {
  const completed = '2026-08-17T14:10:00Z'
  const justDone = resolveDraftGate(
    league({
      draft_status: 'post',
      transaction_mode: 'waivers',
      drafts: [{ draft_started: true, draft_completed: completed, draft_dt: DRAFT_DT }],
    }),
    new Date('2026-08-17T14:20:00Z'),
  )
  assert.equal(justDone.navLocked, false)
  assert.equal(justDone.hideMobileStatusStrip, true)
  assert.equal(justDone.headerResumeAtMs, Date.parse(completed) + DRAFT_HEADER_RESUME_MS)

  const hourLater = resolveDraftGate(
    league({
      draft_status: 'post',
      transaction_mode: 'waivers',
      drafts: [{ draft_started: true, draft_completed: completed, draft_dt: DRAFT_DT }],
    }),
    new Date('2026-08-17T15:10:00Z'),
  )
  assert.equal(hourLater.navLocked, false)
  assert.equal(hourLater.hideMobileStatusStrip, false)
})

test('transaction_mode leaving not-drafted counts as complete', () => {
  const gate = resolveDraftGate(
    league({ draft_status: 'pre', transaction_mode: 'waivers' }),
    new Date('2026-08-17T14:00:00Z'),
  )
  assert.equal(gate.navLocked, false)
})

test('isPreDraftAllowedView — only Moves (Draft)', () => {
  assert.equal(isPreDraftAllowedView('teamSelection'), true)
  assert.equal(isPreDraftAllowedView('hall'), false)
  assert.equal(isPreDraftAllowedView('preseason'), false)
  assert.equal(isPreDraftAllowedView('standings'), false)
  assert.equal(isPreDraftAllowedView('settings'), false)
  assert.equal(isPreDraftAllowedView('more'), false)
})
