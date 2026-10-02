// Fit scoring: plain arithmetic, no model.
// fit = rules hit ÷ rules turned on, as a whole number 0–100.

export const OPERATORS = {
  between: { label: 'is between', types: ['number'] },
  at_least: { label: 'is at least', types: ['number'] },
  at_most: { label: 'is at most', types: ['number'] },
  equals: { label: 'equals', types: ['number', 'text'] },
  is_one_of: { label: 'is one of', types: ['text'] },
  contains: { label: 'contains', types: ['text'] },
  is_not_blank: { label: 'is not blank', types: ['number', 'text'] },
  is_blank: { label: 'is blank', types: ['number', 'text'] },
}

export function operatorsFor(type) {
  return Object.entries(OPERATORS)
    .filter(([, op]) => op.types.includes(type))
    .map(([key, op]) => ({ key, label: op.label }))
}

export function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === ''
}

const norm = (v) => String(v).trim().toLowerCase()

function toNumber(value) {
  if (isBlank(value)) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isNaN(n) ? null : n
}

// Does one cell satisfy one saved rule? Text matching ignores case and
// surrounding spaces.
export function ruleHits(rule, cell) {
  const v = rule.value ?? {}
  switch (rule.operator) {
    case 'is_blank':
      return isBlank(cell)
    case 'is_not_blank':
      return !isBlank(cell)
    case 'between': {
      const n = toNumber(cell)
      return n !== null && n >= v.min && n <= v.max
    }
    case 'at_least': {
      const n = toNumber(cell)
      return n !== null && n >= v.min
    }
    case 'at_most': {
      const n = toNumber(cell)
      return n !== null && n <= v.max
    }
    case 'equals':
      if (isBlank(cell)) return false
      return typeof v.value === 'number' ? toNumber(cell) === v.value : norm(cell) === norm(v.value)
    case 'is_one_of':
      return !isBlank(cell) && (v.values ?? []).some((option) => norm(option) === norm(cell))
    case 'contains':
      return !isBlank(cell) && norm(cell).includes(norm(v.text))
    default:
      return false
  }
}

// Score one lead against a list's rules. With no rules on, the lead is
// unscored (null) rather than 0.
export function fitScore(rules, data) {
  const active = rules.filter((r) => r.enabled)
  if (active.length === 0) return null
  const hits = active.filter((r) => ruleHits(r, data[r.column_name])).length
  return Math.round((hits / active.length) * 100)
}

export function scoreBand(score) {
  if (score === null) return 'none'
  if (score >= 85) return 'high'
  if (score >= 65) return 'good'
  if (score >= 40) return 'fair'
  return 'low'
}

function median(sorted) {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// What is actually in a column, measured from the rows.
export function columnStats(column, leads) {
  const values = leads.map((l) => l.data[column.name])
  const filled = values.filter((v) => !isBlank(v))

  if (column.type === 'number') {
    const nums = filled.map(toNumber).filter((n) => n !== null).sort((a, b) => a - b)
    if (nums.length === 0) return { type: 'number', count: 0, total: values.length }
    return {
      type: 'number',
      count: nums.length,
      total: values.length,
      min: nums[0],
      max: nums.at(-1),
      median: median(nums),
    }
  }

  const distinct = [...new Set(filled.map((v) => String(v).trim()))].sort((a, b) =>
    a.localeCompare(b),
  )
  return { type: 'text', filled: filled.length, total: values.length, distinct }
}

// --- Editing ---------------------------------------------------------------
// The rules screen edits drafts, where every input is a string. These convert
// between drafts and saved rows.

export function newDraft(column, stats) {
  const isNumber = column.type === 'number' && stats.count > 0
  return {
    id: crypto.randomUUID(),
    column_name: column.name,
    columnType: column.type,
    operator: isNumber ? 'between' : 'is_not_blank',
    enabled: true,
    min: isNumber ? String(stats.min) : '',
    max: isNumber ? String(stats.max) : '',
    text: '',
    values: [],
  }
}

export function ruleToDraft(rule, columnType) {
  const v = rule.value ?? {}
  return {
    id: rule.id,
    column_name: rule.column_name,
    columnType,
    operator: rule.operator,
    enabled: rule.enabled,
    min: v.min === undefined ? '' : String(v.min),
    max: v.max === undefined ? '' : String(v.max),
    text: v.text ?? (v.value === undefined ? '' : String(v.value)),
    values: v.values ?? [],
  }
}

// Returns a problem to show next to the rule, or null if it can be saved.
export function draftProblem(d) {
  const num = (s) => s.trim() !== '' && !Number.isNaN(Number(s))
  switch (d.operator) {
    case 'between':
      if (!num(d.min) || !num(d.max)) return 'Enter both ends of the range.'
      if (Number(d.min) > Number(d.max)) return 'The low end is above the high end.'
      return null
    case 'at_least':
      return num(d.min) ? null : 'Enter a number.'
    case 'at_most':
      return num(d.max) ? null : 'Enter a number.'
    case 'equals':
      if (d.columnType === 'number') return num(d.text) ? null : 'Enter a number.'
      return d.text.trim() ? null : 'Enter a value.'
    case 'contains':
      return d.text.trim() ? null : 'Enter some text.'
    case 'is_one_of':
      return d.values.length ? null : 'Pick at least one value.'
    default:
      return null
  }
}

function draftValue(d) {
  switch (d.operator) {
    case 'between':
      return { min: Number(d.min), max: Number(d.max) }
    case 'at_least':
      return { min: Number(d.min) }
    case 'at_most':
      return { max: Number(d.max) }
    case 'equals':
      return { value: d.columnType === 'number' ? Number(d.text) : d.text.trim() }
    case 'contains':
      return { text: d.text.trim() }
    case 'is_one_of':
      return { values: d.values }
    default:
      return null
  }
}

export function draftToRule(d, listId, position) {
  return {
    id: d.id,
    list_id: listId,
    column_name: d.column_name,
    operator: d.operator,
    value: draftValue(d),
    enabled: d.enabled,
    position,
  }
}
