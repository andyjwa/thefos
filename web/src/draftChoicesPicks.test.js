import assert from 'node:assert/strict'
import test from 'node:test'
import { picksFromDraftChoices } from './draftChoicesPicks.js'

/** Two-team league: league_entry ids 101/102, FPL entry_ids 11/22. */
const ENTRIES = [
  { id: 101, entry_id: 11, entry_name: 'Alpha FC' },
  { id: 102, entry_id: 22, entry_name: 'Beta United' },
]

const ELEMENTS = new Map([
  [7, { id: 7, web_name: 'Salah', team: 1, element_type: 3 }],
  [8, { id: 8, web_name: 'Haaland', team: 2, element_type: 4 }],
  [9, { id: 9, web_name: 'Raya', team: 3, element_type: 1 }],
  [10, { id: 10, web_name: 'Gabriel', team: 3, element_type: 2 }],
])

const TEAMS = new Map([
  [1, { id: 1, short_name: 'LIV' }],
  [2, { id: 2, short_name: 'MCI' }],
  [3, { id: 3, short_name: 'ARS' }],
])

function choice(overrides = {}) {
  return {
    element: 7,
    entry: 101,
    index: 1,
    round: 1,
    pick: 1,
    player_first_name: 'Mohamed',
    player_last_name: 'Salah',
    ...overrides,
  }
}

test('builds picks from league_entry-id choices with bootstrap enrichment (snake order)', () => {
  const raw = {
    choices: [
      choice({ index: 1, round: 1, pick: 1, entry: 101, element: 7 }),
      choice({ index: 2, round: 1, pick: 2, entry: 102, element: 8 }),
      // snake: round 2 reverses
      choice({ index: 3, round: 2, pick: 1, entry: 102, element: 9 }),
      choice({ index: 4, round: 2, pick: 2, entry: 101, element: 10 }),
    ],
  }
  const picks = picksFromDraftChoices(raw, ENTRIES, ELEMENTS, TEAMS)
  assert.equal(picks.length, 4)
  assert.deepEqual(picks[0], {
    overallPick: 1,
    round: 1,
    pickInRound: 1,
    entryId: 11,
    leagueEntryId: 101,
    teamName: 'Alpha FC',
    element: 7,
    playerName: 'Salah',
    teamShort: 'LIV',
    pos: 'MID',
  })
  assert.equal(picks[2].entryId, 22)
  assert.equal(picks[2].round, 2)
  assert.equal(picks[2].pos, 'GKP')
  assert.equal(picks[3].entryId, 11)
})

test('sorts by index regardless of payload order', () => {
  const raw = {
    choices: [
      choice({ index: 2, round: 1, pick: 2, entry: 102, element: 8 }),
      choice({ index: 1, round: 1, pick: 1, entry: 101, element: 7 }),
    ],
  }
  const picks = picksFromDraftChoices(raw, ENTRIES, ELEMENTS, TEAMS)
  assert.deepEqual(
    picks.map((p) => p.overallPick),
    [1, 2],
  )
  assert.equal(picks[0].element, 7)
})

test('accepts FPL entry_id space for choices[].entry', () => {
  const raw = {
    choices: [
      choice({ index: 1, entry: 11, element: 7 }),
      choice({ index: 2, pick: 2, entry: 22, element: 8 }),
    ],
  }
  const picks = picksFromDraftChoices(raw, ENTRIES, ELEMENTS, TEAMS)
  assert.equal(picks[0].entryId, 11)
  assert.equal(picks[0].leagueEntryId, 101)
  assert.equal(picks[1].entryId, 22)
})

test('null when a choice belongs to no league entry (another league\u2019s log)', () => {
  const raw = {
    choices: [choice({ entry: 999 })],
  }
  assert.equal(picksFromDraftChoices(raw, ENTRIES, ELEMENTS, TEAMS), null)
})

test('null while draft in progress (un-made pick has null element)', () => {
  const raw = {
    choices: [
      choice({ index: 1, entry: 101, element: 7 }),
      choice({ index: 2, pick: 2, entry: 102, element: null }),
    ],
  }
  assert.equal(picksFromDraftChoices(raw, ENTRIES, ELEMENTS, TEAMS), null)
})

test('null on empty / missing payload', () => {
  assert.equal(picksFromDraftChoices(null, ENTRIES), null)
  assert.equal(picksFromDraftChoices({}, ENTRIES), null)
  assert.equal(picksFromDraftChoices({ choices: [] }, ENTRIES), null)
})

test('falls back to choice name when element missing from bootstrap', () => {
  const raw = {
    choices: [
      choice({
        element: 555,
        player_first_name: 'New',
        player_last_name: 'Signing',
      }),
      choice({ index: 2, pick: 2, entry: 102, element: 8 }),
    ],
  }
  const picks = picksFromDraftChoices(raw, ENTRIES, ELEMENTS, TEAMS)
  assert.equal(picks[0].playerName, 'New Signing')
  assert.equal(picks[0].teamShort, '—')
  assert.equal(picks[0].pos, '—')
})
