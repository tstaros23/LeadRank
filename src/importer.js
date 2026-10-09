// Reading a spreadsheet in the browser and checking it before import.
//
// The file is stored as it arrived: the header row becomes the column list
// and every cell is kept under its exact header. The only changes are
// trimming spaces, turning empty cells into blanks, and reading numbers as
// numbers. Row numbers count data rows from 1, header not included, and
// match the # column in the app.

import readXlsxFile from 'read-excel-file/browser'
import Papa from 'papaparse'

export const MAX_FILE_MB = 10
export const MAX_ROWS = 10000

const isBlankCell = (v) => v === null || v === undefined || String(v).trim() === ''
const isBlankRow = (row) => !row || row.every(isBlankCell)

// Reads every sheet. Returns [{ name, rows }] where rows are arrays of raw
// cells. A CSV counts as one sheet with no name.
export async function readFile(file) {
  const lower = file.name.toLowerCase()
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.csv')) {
    throw new Error('Choose an .xlsx or .csv file.')
  }
  if (file.size === 0) throw new Error('The file is empty.')
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`The file is larger than ${MAX_FILE_MB} MB.`)
  }

  if (lower.endsWith('.csv')) {
    const { data } = Papa.parse(await file.text(), { skipEmptyLines: false })
    return [{ name: null, rows: data }]
  }

  let sheets
  try {
    sheets = await readXlsxFile(file)
  } catch {
    throw new Error("Couldn't read this file as an Excel workbook. Save it as .xlsx and try again.")
  }
  if (sheets.length === 0) throw new Error('The workbook has no sheets.')
  return sheets.map((s) => ({ name: s.sheet, rows: s.data }))
}

// Plain numbers, with or without thousands separators: 29, 1,240, -3.5
const NUMBER_TEXT = /^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value).trim()
  return NUMBER_TEXT.test(text) ? Number(text.replace(/,/g, '')) : null
}

function normalizeCell(value) {
  if (isBlankCell(value)) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return value
  return String(value).trim()
}

// "A", "B", … "AA" for a column with no header.
function columnLetter(index) {
  let s = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(64 + ((n - 1) % 26) + 1) + s
  }
  return s
}

const listRows = (nums) =>
  nums.length <= 5 ? nums.join(', ') : `${nums.slice(0, 5).join(', ')} and ${nums.length - 5} more`

// Turns raw sheet rows into { columns, leads, errors, warnings }.
// errors block the import; warnings are shown but the import can go ahead.
export function profileSheet(rows) {
  const errors = []
  const warnings = []
  const empty = { columns: [], leads: [], errors, warnings, rowCount: 0 }

  // Trailing blank rows (a final newline, or formatting below the data)
  // are not rows at all.
  let end = rows.length
  while (end > 0 && isBlankRow(rows[end - 1])) end -= 1

  const [headerRow, ...body] = rows.slice(0, end)
  if (!headerRow || isBlankRow(headerRow)) {
    errors.push('The first row must hold the column headers, but it is blank.')
    return empty
  }

  // Columns: named ones are kept; a blank header is only a problem if the
  // column has data under it.
  const names = headerRow.map((h) => (isBlankCell(h) ? '' : String(h).trim()))
  const kept = []
  names.forEach((name, i) => {
    if (name) return kept.push({ name, index: i })
    const hasData = body.some((row) => row && !isBlankCell(row[i]))
    if (hasData) errors.push(`Column ${columnLetter(i)} has data but no header.`)
  })
  const seen = new Map()
  for (const { name } of kept) seen.set(name, (seen.get(name) ?? 0) + 1)
  for (const [name, count] of seen) {
    if (count > 1) errors.push(`${count} columns are named "${name}". Give each column its own name.`)
  }
  if (kept.length === 0) errors.push('No column headers were found in the first row.')

  // Rows: blank ones are skipped but keep their number so the # column
  // still matches the file.
  const blankRows = []
  const overflowRows = []
  const leads = []
  body.forEach((row, k) => {
    const rowNumber = k + 1
    if (isBlankRow(row)) return blankRows.push(rowNumber)
    if (row.length > names.length && row.slice(names.length).some((c) => !isBlankCell(c))) {
      overflowRows.push(rowNumber)
    }
    const data = {}
    for (const { name, index } of kept) data[name] = normalizeCell(row[index])
    leads.push({ row_number: rowNumber, data })
  })

  if (leads.length === 0) errors.push('There are no rows under the header.')
  if (leads.length > MAX_ROWS) {
    errors.push(`The sheet has ${leads.length.toLocaleString()} rows; the limit is ${MAX_ROWS.toLocaleString()}.`)
  }
  if (blankRows.length) {
    warnings.push(
      `${blankRows.length === 1 ? 'Row' : 'Rows'} ${listRows(blankRows)} ${blankRows.length === 1 ? 'is' : 'are'} blank and will be skipped.`,
    )
  }
  if (overflowRows.length) {
    warnings.push(
      `${overflowRows.length === 1 ? 'Row' : 'Rows'} ${listRows(overflowRows)} ${overflowRows.length === 1 ? 'has' : 'have'} values past the last header; those cells will be dropped.`,
    )
  }

  // Column types: a column is a number column when every filled cell is a
  // number. Mostly-numeric columns get a warning so a stray "N/A" is caught.
  const columns = kept.map(({ name }) => {
    const filled = leads.filter((l) => l.data[name] !== null)
    if (filled.length === 0) {
      warnings.push(`"${name}" is empty in every row.`)
      return { name, type: 'text' }
    }
    const nonNumeric = filled.filter((l) => toNumber(l.data[name]) === null)
    if (nonNumeric.length === 0) {
      for (const l of filled) l.data[name] = toNumber(l.data[name])
      return { name, type: 'number' }
    }
    if (nonNumeric.length <= filled.length / 2) {
      warnings.push(
        `"${name}" is mostly numbers but ${nonNumeric.length === 1 ? 'row' : 'rows'} ${listRows(nonNumeric.map((l) => l.row_number))} ${nonNumeric.length === 1 ? 'is' : 'are'} not, so it will be treated as text. Number rules won't apply to it.`,
      )
    }
    return { name, type: 'text' }
  })

  return { columns, leads, errors, warnings, rowCount: body.length }
}

// "PA_Monday_Ready_2026-09.xlsx" → "PA Monday Ready 2026-09"
export function suggestName(filename) {
  return filename
    .replace(/\.(xlsx|csv)$/i, '')
    .replace(/[_]+/g, ' ')
    .trim()
}
