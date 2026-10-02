import { useState } from 'react'
import { supabase } from '../supabaseClient'
import {
  columnStats,
  draftProblem,
  draftToRule,
  newDraft,
  operatorsFor,
  ruleHits,
  ruleToDraft,
} from '../scoring'

const fmt = (n) => n.toLocaleString()

function describeStats(s) {
  if (s.type === 'number') {
    if (s.count === 0) return 'number · no values'
    return `number · ${fmt(s.min)}–${fmt(s.max)} · median ${fmt(s.median)}`
  }
  return `text · ${fmt(s.filled)} of ${fmt(s.total)} filled · ${fmt(s.distinct.length)} unique`
}

function possibleScores(n) {
  const scores = Array.from({ length: n + 1 }, (_, k) => Math.round((k / n) * 100))
  return `${scores.slice(0, -1).join(', ')} or ${scores.at(-1)}`
}

// Saved rules → drafts, in the list's column order.
function draftsFrom(rules, columns) {
  const typeOf = Object.fromEntries(columns.map((c) => [c.name, c.type]))
  return rules
    .filter((r) => r.column_name in typeOf)
    .map((r) => ruleToDraft(r, typeOf[r.column_name]))
}

function NumberInput({ label, value, onChange }) {
  return (
    <input
      type="number"
      className="rule-input rule-input-number"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function OneOfEditor({ draft, stats, onChange }) {
  const [entry, setEntry] = useState('')
  const listId = `values-${draft.id}`
  const remaining = stats.distinct.filter((v) => !draft.values.includes(v))

  function add() {
    const typed = entry.trim()
    // Use the column's own spelling when the typed value matches one.
    const value = stats.distinct.find((v) => v.toLowerCase() === typed.toLowerCase()) ?? typed
    const taken = draft.values.some((v) => v.toLowerCase() === value.toLowerCase())
    if (value && !taken) onChange({ values: [...draft.values, value] })
    setEntry('')
  }

  return (
    <span className="one-of">
      {draft.values.map((v) => (
        <span key={v} className="value-chip">
          {v}
          <button
            type="button"
            aria-label={`Remove ${v}`}
            onClick={() => onChange({ values: draft.values.filter((x) => x !== v) })}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="rule-input"
        list={listId}
        placeholder="Add a value…"
        aria-label={`${draft.column_name} values`}
        value={entry}
        onChange={(e) => setEntry(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
        onBlur={add}
      />
      <datalist id={listId}>
        {remaining.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </span>
  )
}

function RuleValue({ draft, stats, onChange }) {
  const name = draft.column_name
  switch (draft.operator) {
    case 'between':
      return (
        <>
          <NumberInput label={`${name} low end`} value={draft.min} onChange={(min) => onChange({ min })} />
          <span className="muted">and</span>
          <NumberInput label={`${name} high end`} value={draft.max} onChange={(max) => onChange({ max })} />
        </>
      )
    case 'at_least':
      return <NumberInput label={`${name} minimum`} value={draft.min} onChange={(min) => onChange({ min })} />
    case 'at_most':
      return <NumberInput label={`${name} maximum`} value={draft.max} onChange={(max) => onChange({ max })} />
    case 'equals':
      if (draft.columnType === 'number') {
        return <NumberInput label={`${name} value`} value={draft.text} onChange={(text) => onChange({ text })} />
      }
      return (
        <>
          <input
            className="rule-input"
            list={`values-${draft.id}`}
            aria-label={`${name} value`}
            value={draft.text}
            onChange={(e) => onChange({ text: e.target.value })}
          />
          <datalist id={`values-${draft.id}`}>
            {stats.distinct.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </>
      )
    case 'contains':
      return (
        <input
          className="rule-input"
          aria-label={`${name} text`}
          value={draft.text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      )
    case 'is_one_of':
      return <OneOfEditor draft={draft} stats={stats} onChange={onChange} />
    default:
      return null
  }
}

function ScoringRules({ list, leads, rules, onSaved }) {
  const columns = list.columns
  const stats = Object.fromEntries(columns.map((c) => [c.name, columnStats(c, leads)]))
  const [drafts, setDrafts] = useState(() => draftsFrom(rules, columns))
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' })

  const problems = Object.fromEntries(drafts.map((d) => [d.id, draftProblem(d)]))
  const hasProblems = Object.values(problems).some(Boolean)
  const activeCount = drafts.filter((d) => d.enabled).length

  // Compare as saved rows so typing "40" vs "40.0" doesn't count as a change.
  const asRows = (ds) =>
    JSON.stringify(ds.map((d, i) => (draftProblem(d) ? d : draftToRule(d, list.id, i))))
  const isDirty = asRows(drafts) !== asRows(draftsFrom(rules, columns))

  function changed(next) {
    setDrafts(next)
    setSaveState({ status: 'idle', message: '' })
  }

  function update(id, changes) {
    changed(
      drafts.map((d) => {
        if (d.id !== id) return d
        const next = { ...d, ...changes }
        // Switching to a numeric operator: start from the column's real range.
        const s = stats[d.column_name]
        if (changes.operator && s.type === 'number' && s.count > 0) {
          if (next.min === '') next.min = String(s.min)
          if (next.max === '') next.max = String(s.max)
        }
        return next
      }),
    )
  }

  function addRule(column) {
    // Keep each column's rules together, in column order.
    const draft = newDraft(column, stats[column.name])
    const order = columns.map((c) => c.name)
    const next = [...drafts, draft].sort(
      (a, b) => order.indexOf(a.column_name) - order.indexOf(b.column_name),
    )
    changed(next)
  }

  function hitCount(draft) {
    if (problems[draft.id]) return null
    const rule = draftToRule(draft, list.id, 0)
    return leads.filter((l) => ruleHits(rule, l.data[draft.column_name])).length
  }

  async function save() {
    setSaveState({ status: 'saving', message: '' })
    const rows = drafts.map((d, i) => ({
      ...draftToRule(d, list.id, i),
      updated_at: new Date().toISOString(),
    }))

    const keep = new Set(rows.map((r) => r.id))
    const removed = rules.filter((r) => !keep.has(r.id)).map((r) => r.id)
    if (removed.length) {
      const { error } = await supabase.from('rules').delete().in('id', removed)
      if (error) return setSaveState({ status: 'error', message: error.message })
    }

    let saved = []
    if (rows.length) {
      const { data, error } = await supabase.from('rules').upsert(rows).select()
      if (error) return setSaveState({ status: 'error', message: error.message })
      saved = data.sort((a, b) => a.position - b.position)
    }

    onSaved(saved)
    setSaveState({ status: 'saved', message: `Saved. ${fmt(leads.length)} leads re-scored.` })
  }

  return (
    <section className="rules">
      <p className="notice">
        <strong>This list only.</strong> Rules here score {list.name} and nothing else. Add as
        many as you like to any column — every rule that's on counts equally.
      </p>

      <div className="rule-groups">
        {columns.map((column) => {
          const columnDrafts = drafts.filter((d) => d.column_name === column.name)
          const s = stats[column.name]
          return (
            <div key={column.name} className="rule-group">
              <div className="rule-group-head">
                <div>
                  <div className="column-name">{column.name}</div>
                  <div className="stats">{describeStats(s)}</div>
                </div>
                <button type="button" className="button button-small" onClick={() => addRule(column)}>
                  + Add rule
                </button>
              </div>

              {columnDrafts.length === 0 && (
                <p className="rule-empty">No rules. This column doesn't affect the score.</p>
              )}

              {columnDrafts.map((draft) => {
                const hits = hitCount(draft)
                return (
                  <div key={draft.id} className={`rule-row${draft.enabled ? '' : ' is-off'}`}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.enabled}
                      aria-label={`Rule on ${column.name} is ${draft.enabled ? 'on' : 'off'}`}
                      className="switch"
                      onClick={() => update(draft.id, { enabled: !draft.enabled })}
                    />
                    <div className="rule-body">
                      <div className="rule-editor">
                        <select
                          className="rule-input"
                          aria-label={`${column.name} condition`}
                          value={draft.operator}
                          onChange={(e) => update(draft.id, { operator: e.target.value })}
                        >
                          {operatorsFor(column.type).map((op) => (
                            <option key={op.key} value={op.key}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                        <RuleValue
                          draft={draft}
                          stats={s}
                          onChange={(changes) => update(draft.id, changes)}
                        />
                      </div>
                      {problems[draft.id] && <div className="rule-problem">{problems[draft.id]}</div>}
                    </div>
                    <div className="hits">
                      {hits === null ? (
                        '—'
                      ) : (
                        <>
                          {fmt(hits)}{' '}
                          <span className="muted">({Math.round((hits / leads.length) * 100)}%)</span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      className="remove"
                      aria-label={`Remove rule on ${column.name}`}
                      onClick={() => changed(drafts.filter((d) => d.id !== draft.id))}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <p className="formula">
        fit score = rules hit ÷ rules turned on →{' '}
        {activeCount === 0
          ? 'no rules on, so every lead is unscored'
          : `${activeCount} active ${activeCount === 1 ? 'rule' : 'rules'}, so every lead scores ${possibleScores(activeCount)}`}
      </p>

      <div className="rules-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={!isDirty || hasProblems || saveState.status === 'saving'}
          onClick={save}
        >
          {saveState.status === 'saving' ? 'Saving…' : `Save and re-score ${fmt(leads.length)} leads`}
        </button>
        <button
          type="button"
          className="button"
          disabled={!isDirty || saveState.status === 'saving'}
          onClick={() => changed(draftsFrom(rules, columns))}
        >
          Discard changes
        </button>
        {saveState.status === 'saved' && <span className="save-note">{saveState.message}</span>}
        {saveState.status === 'error' && (
          <span className="save-note message-error">Couldn't save: {saveState.message}</span>
        )}
        {saveState.status === 'idle' && isDirty && (
          <span className="save-note muted">
            {hasProblems ? 'Fix the highlighted rules to save' : 'Unsaved changes'}
          </span>
        )}
      </div>
    </section>
  )
}

export default ScoringRules
