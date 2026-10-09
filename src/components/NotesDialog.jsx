import { useEffect, useRef, useState } from 'react'

function formatWhen(iso) {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// One note: read it, edit it in place, or delete it after a confirm step.
function NoteItem({ note, onEdit, onDelete }) {
  const [mode, setMode] = useState('view') // 'view' | 'editing' | 'confirmDelete'
  const [text, setText] = useState(note.body)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run(action) {
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    const body = text.trim()
    if (!body || busy) return
    if (body === note.body) return setMode('view')
    if (await run(() => onEdit(note.id, body))) setMode('view')
  }

  function cancel() {
    setText(note.body)
    setError(null)
    setMode('view')
  }

  return (
    <li className="note">
      <div className="note-meta">
        <span>
          {formatWhen(note.created_at)} · {note.author}
          {note.updated_at && (
            <span title={`Edited ${formatWhen(note.updated_at)}`}> · edited</span>
          )}
        </span>
        {mode === 'view' && (
          <span className="note-tools">
            <button type="button" className="link-button" onClick={() => setMode('editing')}>
              Edit
            </button>
            <button
              type="button"
              className="link-button link-danger"
              onClick={() => setMode('confirmDelete')}
            >
              Delete
            </button>
          </span>
        )}
      </div>

      {mode === 'editing' ? (
        <>
          <textarea
            className="note-input"
            rows={3}
            aria-label="Edit note"
            autoFocus
            // Start with the cursor after the existing text.
            onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit()
              // Escape cancels the edit instead of closing the popup.
              if (e.key === 'Escape') {
                e.preventDefault()
                cancel()
              }
            }}
          />
          <div className="note-compose-actions">
            {error && <span className="message-error">Couldn't save: {error}</span>}
            <button type="button" className="button button-small" onClick={cancel}>
              Cancel
            </button>
            <button
              type="button"
              className="button button-small button-primary"
              disabled={!text.trim() || busy}
              onClick={saveEdit}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      ) : (
        <p className="note-body">{note.body}</p>
      )}

      {mode === 'confirmDelete' && (
        <div className="note-confirm" role="alert">
          <span>Delete this note? This can't be undone.</span>
          {error && <span className="message-error">Couldn't delete: {error}</span>}
          <button type="button" className="button button-small" autoFocus onClick={cancel}>
            Keep it
          </button>
          <button
            type="button"
            className="button button-small button-danger"
            disabled={busy}
            onClick={() => run(() => onDelete(note.id))}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}
    </li>
  )
}

// Popup for one lead's notes: add a note at the top, read past ones below,
// newest first. Uses <dialog> so Escape, focus and the backdrop come free.
function NotesDialog({ lead, notes, startWriting, onAdd, onEdit, onDelete, onClose }) {
  const dialogRef = useRef(null)
  const textRef = useRef(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    dialogRef.current.showModal()
    if (startWriting) textRef.current.focus()
  }, [startWriting])

  async function save() {
    const body = draft.trim()
    if (!body || saving) return
    setSaving(true)
    setError(null)
    try {
      await onAdd(lead.id, body)
      setDraft('')
      textRef.current.focus()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const { data } = lead
  const contact = [data['Contact'], data['Community Phone #']].filter(Boolean).join(' · ')

  return (
    <dialog
      ref={dialogRef}
      className="notes-dialog"
      aria-labelledby="notes-title"
      onClose={onClose}
      // Clicking the backdrop (the dialog element itself) closes it.
      onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
    >
      <div className="notes-panel">
        <header className="notes-head">
          <div>
            <h2 id="notes-title" className="notes-title">
              {data['Community'] ?? 'Untitled lead'}
            </h2>
            <p className="notes-sub">
              Row {lead.row_number}
              {contact && ` · ${contact}`}
            </p>
          </div>
          <button
            type="button"
            className="remove"
            aria-label="Close notes"
            onClick={() => dialogRef.current.close()}
          >
            ×
          </button>
        </header>

        <div className="note-compose">
          <textarea
            ref={textRef}
            className="note-input"
            rows={3}
            placeholder="What happened on the call?"
            aria-label="New note"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
            }}
          />
          <div className="note-compose-actions">
            {error && <span className="message-error">Couldn't save: {error}</span>}
            <span className="muted note-hint">⌘ + Enter to add</span>
            <button
              type="button"
              className="button button-primary"
              disabled={!draft.trim() || saving}
              onClick={save}
            >
              {saving ? 'Adding…' : 'Add note'}
            </button>
          </div>
        </div>

        {notes.length === 0 ? (
          <p className="notes-empty">No notes yet for this lead.</p>
        ) : (
          <ol className="note-list">
            {notes.map((note) => (
              <NoteItem key={note.id} note={note} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </ol>
        )}
      </div>
    </dialog>
  )
}

export default NotesDialog
