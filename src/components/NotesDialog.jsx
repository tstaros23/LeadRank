import { useEffect, useRef, useState } from 'react'

function formatWhen(iso) {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Popup for one lead's notes: add a note at the top, read past ones below,
// newest first. Uses <dialog> so Escape, focus and the backdrop come free.
function NotesDialog({ lead, notes, startWriting, onAdd, onClose }) {
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
              <li key={note.id} className="note">
                <div className="note-meta">
                  {formatWhen(note.created_at)} · {note.author}
                </div>
                <p className="note-body">{note.body}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </dialog>
  )
}

export default NotesDialog
