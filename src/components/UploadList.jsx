import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { MAX_FILE_MB, profileSheet, readFile, suggestName } from '../importer'

const fmt = (n) => n.toLocaleString()
const PREVIEW_ROWS = 5

// Owner-only popup: pick a spreadsheet, check it, and import it as a new list.
function UploadList({ onCreated, onClose }) {
  const dialogRef = useRef(null)
  const inputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [sheets, setSheets] = useState([]) // from readFile
  const [sheetIndex, setSheetIndex] = useState(0)
  const [readError, setReadError] = useState(null)
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const [name, setName] = useState('')
  const [reps, setReps] = useState([])
  const [repId, setRepId] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    dialogRef.current.showModal()
  }, [])

  // Reps the list can be assigned to.
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'rep')
      .order('full_name')
      .then(({ data }) => {
        setReps(data ?? [])
        if (data?.length) setRepId((current) => current || data[0].id)
      })
  }, [])

  async function choose(picked) {
    if (!picked) return
    setReadError(null)
    setSheets([])
    setSheetIndex(0)
    setFile(picked)
    setName(suggestName(picked.name))
    setReading(true)
    try {
      setSheets(await readFile(picked))
    } catch (e) {
      setReadError(e.message)
    } finally {
      setReading(false)
    }
  }

  const sheet = sheets[sheetIndex]
  const profile = sheet ? profileSheet(sheet.rows) : null
  const canCreate = profile && profile.errors.length === 0 && name.trim() && !saving

  async function create() {
    if (!canCreate) return
    setSaving(true)
    setSaveError(null)
    const { data, error } = await supabase.rpc('import_list', {
      name: name.trim(),
      source_filename: file.name,
      sheet_name: sheet.name,
      columns: profile.columns,
      owner_id: repId || null,
      rows: profile.leads,
    })
    if (error) {
      setSaveError(error.message)
      setSaving(false)
      return
    }
    onCreated(data)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    choose(e.dataTransfer.files[0])
  }

  return (
    <dialog
      ref={dialogRef}
      className="notes-dialog upload-dialog"
      aria-labelledby="upload-title"
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
    >
      <div className="notes-panel">
        <header className="notes-head">
          <div>
            <h2 id="upload-title" className="notes-title">Upload a list</h2>
            <p className="notes-sub">
              The file is stored as it arrives: nothing renamed, merged, reordered or dropped.
            </p>
          </div>
          <button
            type="button"
            className="remove"
            aria-label="Close"
            onClick={() => dialogRef.current.close()}
          >
            ×
          </button>
        </header>

        <div className="upload-body">
          <div
            className={`dropzone${dragging ? ' is-dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv"
              className="visually-hidden"
              onChange={(e) => choose(e.target.files[0])}
            />
            {file ? (
              <span className="file-name">
                <span className="file-badge">{file.name.split('.').pop().toUpperCase()}</span>
                {file.name}
              </span>
            ) : (
              <span className="muted">Drop an .xlsx or .csv here, or</span>
            )}
            <button type="button" className="button button-small" onClick={() => inputRef.current.click()}>
              {file ? 'Choose a different file' : 'Choose a file'}
            </button>
            <span className="muted upload-limit">Up to {MAX_FILE_MB} MB</span>
          </div>

          {reading && <p className="muted">Reading the file…</p>}
          {readError && (
            <p className="problem problem-error" role="alert">
              {readError}
            </p>
          )}

          {sheet && profile && (
            <>
              {sheets.length > 1 && (
                <label className="field field-inline">
                  <span>Sheet</span>
                  <select
                    className="rule-input"
                    value={sheetIndex}
                    onChange={(e) => setSheetIndex(Number(e.target.value))}
                  >
                    {sheets.map((s, i) => (
                      <option key={i} value={i}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <dl className="upload-facts">
                {sheet.name && (
                  <>
                    <dt>Sheet</dt>
                    <dd>{sheet.name}</dd>
                  </>
                )}
                <dt>Rows</dt>
                <dd>
                  {fmt(profile.leads.length)}
                  {profile.rowCount !== profile.leads.length && (
                    <span className="muted"> of {fmt(profile.rowCount)}</span>
                  )}
                </dd>
                <dt>Columns</dt>
                <dd>{profile.columns.length}</dd>
              </dl>

              {profile.columns.length > 0 && (
                <div>
                  <div className="upload-label">Stored columns</div>
                  <div className="column-chips">
                    {profile.columns.map((c, i) => (
                      // Index keys: with a duplicate-header error, names repeat.
                      <span key={i} className="column-chip">
                        {c.name}
                        <span className="muted"> · {c.type}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.errors.length > 0 && (
                <ul className="problems" role="alert">
                  {profile.errors.map((p) => (
                    <li key={p} className="problem problem-error">
                      {p}
                    </li>
                  ))}
                </ul>
              )}
              {profile.warnings.length > 0 && (
                <ul className="problems">
                  {profile.warnings.map((p) => (
                    <li key={p} className="problem problem-warning">
                      {p}
                    </li>
                  ))}
                </ul>
              )}

              {profile.leads.length > 0 && profile.columns.length > 0 && (
                <div className="table-scroll preview-scroll">
                  <table className="lead-table preview-table">
                    <thead>
                      <tr>
                        <th className="num">#</th>
                        {profile.columns.map((c, i) => (
                          <th key={i} className={c.type === 'number' ? 'num' : undefined}>
                            {c.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {profile.leads.slice(0, PREVIEW_ROWS).map((lead) => (
                        <tr key={lead.row_number}>
                          <td className="num row-number">{lead.row_number}</td>
                          {profile.columns.map((c, i) => (
                            <td key={i} className={c.type === 'number' ? 'num' : undefined}>
                              {lead.data[c.name] === null ? (
                                <span className="blank">blank</span>
                              ) : (
                                <span className="cell-text">{String(lead.data[c.name])}</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {profile.leads.length > PREVIEW_ROWS && (
                    <p className="muted preview-more">
                      First {PREVIEW_ROWS} of {fmt(profile.leads.length)} rows
                    </p>
                  )}
                </div>
              )}

              <div className="upload-form">
                <label className="field">
                  <span>List name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label className="field">
                  <span>Visible to</span>
                  <select value={repId} onChange={(e) => setRepId(e.target.value)}>
                    {reps.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.full_name}
                      </option>
                    ))}
                    <option value="">Only me, for now</option>
                  </select>
                </label>
              </div>
            </>
          )}
        </div>

        <footer className="upload-actions">
          {saveError && <span className="message-error">Couldn't create the list: {saveError}</span>}
          {profile && profile.errors.length > 0 && (
            <span className="muted">Fix the problems above in the file, then choose it again.</span>
          )}
          <button type="button" className="button" onClick={() => dialogRef.current.close()}>
            Cancel
          </button>
          <button type="button" className="button button-primary" disabled={!canCreate} onClick={create}>
            {saving ? 'Creating…' : profile ? `Create list with ${fmt(profile.leads.length)} leads` : 'Create list'}
          </button>
        </footer>
      </div>
    </dialog>
  )
}

export default UploadList
