import { useState } from 'react'
import { fitScore, scoreBand } from '../scoring'

// "Ewing, NJ" from "50 Walter Street, Ewing, NJ 08628". Display only; the
// stored Address is untouched.
function cityFromAddress(address) {
  if (!address) return ''
  const parts = address.split(',').map((p) => p.trim())
  if (parts.length < 3) return ''
  const state = parts.at(-1).split(' ')[0]
  return `${parts.at(-2)}, ${state}`
}

// Highest score first; ties keep file order. Unscored leads go last.
function rankIds(rows) {
  return [...rows]
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.row_number - b.row_number)
    .map((r) => r.id)
}

function Blank() {
  return <span className="blank">blank</span>
}

function Score({ score }) {
  if (score === null) return <span className="muted">—</span>
  const band = scoreBand(score)
  return (
    <span className={`score score-${band}`}>
      <span className="score-bar">
        <span className="score-fill" style={{ width: `${score}%` }} />
      </span>
      {score}
    </span>
  )
}

function LeadTable({ list, leads, rules }) {
  const scored = leads.map((lead) => ({ ...lead, score: fitScore(rules, lead.data) }))
  const hasRules = rules.some((r) => r.enabled)

  const [view, setView] = useState('original')
  // The ranked order is a snapshot. Scores can change underneath it, but rows
  // only move when the rep presses Re-rank.
  const [rankedIds, setRankedIds] = useState(null)
  const [rankedAt, setRankedAt] = useState(null)

  function rerank() {
    setRankedIds(rankIds(scored))
    setRankedAt(new Date())
  }

  function showRanked() {
    if (!rankedIds) rerank()
    setView('ranked')
  }

  const byId = new Map(scored.map((r) => [r.id, r]))
  const rows =
    view === 'ranked' && rankedIds ? rankedIds.map((id) => byId.get(id)).filter(Boolean) : scored

  const meta =
    view === 'ranked'
      ? `last ranked at ${rankedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : 'matching your uploaded file'

  return (
    <section>
      <div className="list-header">
        <div>
          <h1 className="list-title">{list.name}</h1>
          <p className="list-meta">
            {leads.length.toLocaleString()} leads · 0 called · {meta}
          </p>
        </div>
        <div className="list-actions">
          <div className="toggle" role="group" aria-label="Row order">
            <button
              type="button"
              className={`toggle-option${view === 'original' ? ' is-active' : ''}`}
              aria-pressed={view === 'original'}
              onClick={() => setView('original')}
            >
              Original order
            </button>
            <button
              type="button"
              className={`toggle-option${view === 'ranked' ? ' is-active' : ''}`}
              aria-pressed={view === 'ranked'}
              onClick={showRanked}
            >
              Ranked
            </button>
          </div>
          <button
            type="button"
            className="button"
            disabled={view !== 'ranked'}
            onClick={rerank}
          >
            Re-rank
          </button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="lead-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Community</th>
              <th>Contact</th>
              <th className="num">Bed #</th>
              <th>Group</th>
              <th className="num">Group #</th>
              <th>Score</th>
              <th>Called</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, row_number, data, score }) => (
              <tr key={id}>
                <td className="num row-number">{row_number}</td>
                <td>
                  <div className="primary">{data['Community'] ?? <Blank />}</div>
                  <div className="secondary">{cityFromAddress(data['Address'])}</div>
                </td>
                <td>
                  <div className="primary">{data['Contact'] ?? <Blank />}</div>
                  <div className="secondary">{data['Community Phone #']}</div>
                </td>
                <td className="num">{data['Bed #'] ?? <Blank />}</td>
                <td className="primary">{data['Group'] ?? <Blank />}</td>
                <td className="num">{data['Group #'] ?? <Blank />}</td>
                <td>
                  <Score score={score} />
                </td>
                <td className="muted">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="table-footer">
        {!hasRules && (
          <span>
            No scoring rules on yet. <a href="#/rules">Add some in Scoring rules</a>.
          </span>
        )}
        <span className="legend">
          <span className="legend-item"><i className="swatch score-high" />85 – 100</span>
          <span className="legend-item"><i className="swatch score-good" />65 – 84</span>
          <span className="legend-item"><i className="swatch score-fair" />40 – 64</span>
          <span className="legend-item"><i className="swatch score-low" />below 40</span>
        </span>
        <span>
          {view === 'ranked'
            ? `${rows.length} of ${leads.length}, highest score first`
            : `Rows 1–${rows.length} of ${leads.length}, in file order`}
        </span>
      </footer>
    </section>
  )
}

export default LeadTable
