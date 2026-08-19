import { useEffect, useRef, useState } from 'react'
import { TeamAvatar } from './TeamAvatar'
import {
  MARGIN_BUCKET_KEYS,
  MARGIN_BUCKET_LABELS,
  currentStreak,
  ordinal,
} from './teamCardStats.js'
import { archivedSeasonLabel } from './seasonArchive.js'
import { getSeasonLabel } from './seasonString.js'
import './TeamDetailView.css'

const NET_POS = 'var(--tc-pos)'
const NET_NEG = 'var(--tc-neg)'
const NET_MUTED = 'var(--tc-text-muted)'

function netColor(net) {
  return net > 0 ? NET_POS : net < 0 ? NET_NEG : NET_MUTED
}

/** Circular crest via the shared TeamAvatar (logo → shirt-initials fallback). */
function Crest({ entryId, name, logoMap, kitIndexByEntry, className }) {
  return (
    <span className={className}>
      <TeamAvatar
        entryId={entryId}
        name={name}
        size="sm"
        logoMap={logoMap}
        kitIndexByEntry={kitIndexByEntry}
      />
    </span>
  )
}

function H2HRivals({ rivals, idToName, logoMap, kitIndexByEntry }) {
  return (
    <div className="h2h-c">
      {rivals.map((r) => {
        const diff = r.pf - r.pa
        return (
          <div key={r.oid} className="h2h-c__card">
            <Crest
              className="tc-riv__crest"
              entryId={r.oid}
              name={idToName[r.oid]}
              logoMap={logoMap}
              kitIndexByEntry={kitIndexByEntry}
            />
            <div className="h2h-c__body">
              <div className="h2h-c__name">{idToName[r.oid]}</div>
              <div className="h2h-c__rec" style={{ color: netColor(r.net) }}>
                {r.w}
                {'\u2013'}
                {r.d}
                {'\u2013'}
                {r.l}
              </div>
            </div>
            <span
              className="h2h-c__diff"
              style={{
                color: diff >= 0 ? NET_POS : NET_NEG,
                background:
                  diff >= 0
                    ? 'color-mix(in srgb,var(--tc-pos) 15%,transparent)'
                    : 'color-mix(in srgb,var(--tc-neg) 15%,transparent)',
              }}
            >
              {diff >= 0 ? '+' : ''}
              {diff}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Team detail card body — 1:1 port of the approved mockup
 * (`web/public/team-card-options.html` `render()`), driven by
 * {@link computeTeamCardData} output instead of embedded JSON. Logos use the
 * shared {@link TeamAvatar} so uploads / kit fallbacks match the rest of the app.
 *
 * @param {object} props
 * @param {number} props.teamId
 * @param {ReturnType<import('./teamCardStats.js').computeTeamCardData>} props.data
 * @param {(id: number) => void} props.onSelectTeam
 * @param {() => void} props.onBack
 * @param {Record<string, string>} props.teamLogoMap
 * @param {Record<number, number>} props.kitIndexByEntry
 */
export function TeamDetailView({
  teamId,
  data,
  onSelectTeam,
  onBack,
  teamLogoMap = {},
  kitIndexByEntry = {},
}) {
  const [marginMode, setMarginMode] = useState('wins')
  const bodyRef = useRef(null)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [teamId])

  if (!data || !data.S[teamId]) return null

  const {
    S,
    table,
    rankOf,
    luck,
    luckIdx,
    heroDef,
    vilVic,
    idToName,
    rivalsFor,
  } = data

  const id = teamId
  const s = S[id]
  const rank = rankOf[id]
  const lk = luck[id]
  const lkPos = lk.delta >= 0
  const rivals = rivalsFor(id)
  const last5 = s.seq.slice(-5)
  const mData = marginMode === 'wins' ? s.mw : s.ml
  const mMax = Math.max(1, ...MARGIN_BUCKET_KEYS.map((k) => mData[k]))

  const st = currentStreak(s.seq)
  const streakCls = st.res === 'W' ? 'v-pos' : st.res === 'L' ? 'v-neg' : 'is-zero'
  const streakVal = st.n ? st.n : '\u2013'

  /** Pre-season / no finished games: the stat seeds (high -1, GW0, an
   * all-tied luck rank) are meaningless — render placeholder tiles instead. */
  const played = s.seq.length > 0

  return (
    <div className="tc-card" aria-label={`${s.name} team detail`}>
      <div className="tc-hero">
        <button type="button" className="tc-back" aria-label="Back" onClick={onBack}>
          <span aria-hidden>{'\u2039'}</span>
        </button>
        <Crest
          className="tc-crest"
          entryId={id}
          name={s.name}
          logoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
        <div className="tc-hero__body">
          <div className="tc-hero__name" title={s.name}>
            {s.name}
          </div>
          <div className="tc-hero__meta">
            <span className="tc-rankpill">{ordinal(rank)}</span>
            <span>{s.mgr}</span>
            <span className="tc-recpill">
              {s.w}
              {'\u2013'}
              {s.d}
              {'\u2013'}
              {s.l}
            </span>
          </div>
        </div>
      </div>

      <div className="tc-switch">
        {table.map((tid) => (
          <button
            key={tid}
            type="button"
            className={tid === id ? 'is-on' : undefined}
            title={idToName[tid]}
            aria-label={idToName[tid]}
            aria-pressed={tid === id}
            onClick={() => onSelectTeam(tid)}
          >
            <TeamAvatar
              entryId={tid}
              name={idToName[tid]}
              size="sm"
              logoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
            />
          </button>
        ))}
      </div>

      <div className="tc-body" ref={bodyRef}>
        <div className="tc-sec">
          <div className="tc-sec__h">Story of the season</div>
          <div className="tc-boxes">
            <div className="tc-box">
              <div className="tc-box__k">Luck index</div>
              {played ? (
                <>
                  <div className="tc-box__v">{ordinal(luckIdx[id])}</div>
                  <div className={`tc-box__sub ${lkPos ? 'v-pos' : 'v-neg'}`}>
                    {lkPos ? '+' : ''}
                    {lk.delta.toFixed(1)} vs avg
                  </div>
                </>
              ) : (
                <>
                  <div className="tc-box__v">{'\u2013'}</div>
                  <div className="tc-box__sub">No games yet</div>
                </>
              )}
            </div>
            <div className="tc-box">
              <div className="tc-box__k">Highest score</div>
              {played ? (
                <>
                  <div className="tc-box__v">{s.high}</div>
                  <div className="tc-box__sub tc-box__sub--inline">
                    GW{s.highGw} v
                    <span className="tc-inline-badge">
                      <TeamAvatar
                        entryId={s.highOpp}
                        name={idToName[s.highOpp]}
                        size="sm"
                        logoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="tc-box__v">{'\u2013'}</div>
                  <div className="tc-box__sub">No games yet</div>
                </>
              )}
            </div>
            <div className="tc-box">
              <div className="tc-box__k">Biggest win</div>
              <div className="tc-box__v">{s.bwSc || '\u2013'}</div>
              {s.bwOpp != null ? (
                <div className="tc-box__sub tc-box__sub--inline">
                  GW{s.bwGw} v
                  <span className="tc-inline-badge">
                    <TeamAvatar
                      entryId={s.bwOpp}
                      name={idToName[s.bwOpp]}
                      size="sm"
                      logoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                    />
                  </span>
                </div>
              ) : (
                <div className="tc-box__sub">No wins yet</div>
              )}
            </div>
            <div className="tc-box tc-box--split">
              <div className="tc-hv">
                <div className="tc-hv__k">Hero def</div>
                <div className={`tc-hv__v ${heroDef[id] ? 'v-pos' : 'is-zero'}`}>
                  {heroDef[id] || '\u2013'}
                </div>
              </div>
              <div className="tc-hv__div" />
              <div className="tc-hv">
                <div className="tc-hv__k">Villain win</div>
                <div className={`tc-hv__v ${vilVic[id] ? 'v-neg' : 'is-zero'}`}>
                  {vilVic[id] || '\u2013'}
                </div>
              </div>
              <div className="tc-hv__div" />
              <div className="tc-hv">
                <div className="tc-hv__k">{st.label}</div>
                <div className={`tc-hv__v ${streakCls}`}>{streakVal}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="tc-sec">
          <div className="tc-sec__h">Last 5</div>
          <div className="tc-l5">
            {last5.map((x, i) => (
              <div key={`${x.gw}-${i}`} className="tc-l5__card">
                <span className="tc-l5__gw">GW{x.gw}</span>
                <span className="tc-l5__badge" title={idToName[x.oppId]}>
                  <TeamAvatar
                    entryId={x.oppId}
                    name={idToName[x.oppId]}
                    size="sm"
                    logoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                </span>
                <span className={`tc-l5__res res-${x.res}`}>{x.res}</span>
                <span className="tc-l5__pts">{x.me}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="tc-sec">
          <div className="tc-sec__h">Head to Head</div>
          <H2HRivals
            rivals={rivals}
            idToName={idToName}
            logoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
          />
        </div>

        <div className="tc-sec">
          <div className="tc-sec__h">
            Results by margin
            <span className="tc-toggle">
              <button
                type="button"
                className={marginMode === 'wins' ? 'is-on' : undefined}
                onClick={() => setMarginMode('wins')}
              >
                Wins
              </button>
              <button
                type="button"
                className={marginMode === 'losses' ? 'is-on' : undefined}
                onClick={() => setMarginMode('losses')}
              >
                Losses
              </button>
            </span>
          </div>
          <div className="tc-margin">
            {MARGIN_BUCKET_KEYS.map((k) => (
              <div key={k} className="tc-margin__row">
                <span className="tc-margin__lbl">{MARGIN_BUCKET_LABELS[k]}</span>
                <span className="tc-margin__track">
                  <span
                    className={`tc-margin__fill ${
                      marginMode === 'losses' ? 'tc-margin__fill--loss' : ''
                    }`}
                    style={{ width: `${Math.round((mData[k] / mMax) * 100)}%` }}
                  />
                </span>
                <span className="tc-margin__n">{mData[k]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="tc-foot">
          THE FOS LEAGUE · {archivedSeasonLabel() || getSeasonLabel()}
        </div>
      </div>
    </div>
  )
}
