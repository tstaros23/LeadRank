import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import TopNav from './components/TopNav'
import ListPicker from './components/ListPicker'
import LeadTable from './components/LeadTable'
import ScoringRules from './components/ScoringRules'
import UploadList from './components/UploadList'
import { hashFor, parseHash } from './routes'

// author comes from the note author's profile.
const NOTE_COLUMNS =
  'id, lead_id, body, author_id, verdict, reason, created_at, updated_at, author:profiles(full_name)'

// Everything behind sign-in. Mounted per user, so signing out and back in as
// someone else starts from a clean slate.
function Workspace({ user, profile, onSignOut }) {
  const [route, setRoute] = useState(parseHash)
  const [lists, setLists] = useState(null) // null until loaded
  const [listsError, setListsError] = useState(null)
  const [uploading, setUploading] = useState(false)

  // Everything for the selected list. loadedId says which list these belong
  // to; while it differs from the selection, the list is still loading.
  const [loadedId, setLoadedId] = useState(null)
  const [list, setList] = useState(null)
  const [leads, setLeads] = useState([])
  const [rules, setRules] = useState([])
  const [notes, setNotes] = useState([])
  const [loadError, setLoadError] = useState(null) // { listId, message }

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Every list this user can see: all of them for an owner, their own for a rep.
  const fetchLists = () =>
    supabase.from('lists').select('*, owner:profiles(full_name)').order('created_at')
  const applyLists = ({ data, error: listError }) => {
    if (listError) setListsError(listError.message)
    else setLists(data)
  }

  useEffect(() => {
    fetchLists().then(applyLists)
  }, [])

  // A new list was imported: show it.
  async function listCreated(id) {
    setUploading(false)
    applyLists(await fetchLists())
    window.location.hash = hashFor('lists', id)
  }

  // The list to show: the one in the URL if it exists, otherwise the first.
  const selectedList =
    lists && lists.length > 0 ? (lists.find((l) => l.id === route.listId) ?? lists[0]) : null
  const selectedId = selectedList?.id ?? null

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false

    async function load() {
      const [leadResult, ruleResult, noteResult] = await Promise.all([
        supabase
          .from('leads')
          .select('id, row_number, data')
          .eq('list_id', selectedId)
          .order('row_number'),
        supabase.from('rules').select('*').eq('list_id', selectedId).order('position'),
        // Notes on this list's leads, newest first.
        supabase
          .from('notes')
          .select(`${NOTE_COLUMNS}, leads!inner(list_id)`)
          .eq('leads.list_id', selectedId)
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      const failed = [leadResult, ruleResult, noteResult].find((r) => r.error)
      if (failed) {
        setLoadError({ listId: selectedId, message: failed.error.message })
        return
      }
      setList(selectedList)
      setLeads(leadResult.data)
      setRules(ruleResult.data)
      setNotes(noteResult.data)
      setLoadedId(selectedId)
    }

    load()
    return () => {
      cancelled = true
    }
    // selectedList is derived from selectedId and lists; reloading on the id is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  function chooseList(id) {
    window.location.hash = hashFor(route.page, id)
  }

  // Saves a note and adds it to the top of the lead's notes. Throws on failure
  // so the dialog can keep the text and show the error.
  async function addNote(leadId, body) {
    const { data, error: insertError } = await supabase
      .from('notes')
      // author_id defaults to the signed-in user.
      .insert({ lead_id: leadId, body })
      .select(NOTE_COLUMNS)
      .single()
    if (insertError) throw new Error(insertError.message)
    setNotes((current) => [data, ...current])
  }

  // Replaces a note's text. The old verdict described the old text, so it is
  // cleared for the note to be scored again.
  async function editNote(noteId, body) {
    const { data, error: updateError } = await supabase
      .from('notes')
      .update({ body, updated_at: new Date().toISOString(), verdict: null, reason: null })
      .eq('id', noteId)
      .select(NOTE_COLUMNS)
      .single()
    if (updateError) throw new Error(updateError.message)
    setNotes((current) => current.map((n) => (n.id === noteId ? data : n)))
  }

  async function deleteNote(noteId) {
    // Ask for the deleted row back: a delete blocked by row security returns
    // no error, just no rows.
    const { data, error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .select('id')
    if (deleteError) throw new Error(deleteError.message)
    if (data.length === 0) throw new Error('The note was not deleted.')
    setNotes((current) => current.filter((n) => n.id !== noteId))
  }

  const isOwner = profile.role === 'owner'
  const uploadButton = isOwner && (
    <button type="button" className="button" onClick={() => setUploading(true)}>
      Upload list
    </button>
  )
  const ready = loadedId === selectedId
  const errorHere = loadError?.listId === selectedId ? loadError.message : null
  const picker = selectedList && (
    <ListPicker lists={lists} selected={selectedList} showRep={isOwner} onChange={chooseList} />
  )

  let body
  if (listsError) {
    body = <p className="message message-error">Couldn't load lists: {listsError}</p>
  } else if (lists === null) {
    body = <p className="message">Loading…</p>
  } else if (lists.length === 0) {
    body = (
      <div className="message empty-state">
        {isOwner ? (
          <>
            <p>No lists yet. Upload a spreadsheet to get started.</p>
            {uploadButton}
          </>
        ) : (
          <p>No lists are assigned to you yet. Ask your organization's owner to assign one.</p>
        )}
      </div>
    )
  } else if (errorHere) {
    body = <p className="message message-error">Couldn't load leads: {errorHere}</p>
  } else if (!ready) {
    body = <p className="message">Loading leads…</p>
  } else if (route.page === 'rules') {
    body = (
      <ScoringRules
        key={list.id}
        picker={picker}
        list={list}
        leads={leads}
        rules={rules}
        canEdit={isOwner}
        onSaved={setRules}
      />
    )
  } else {
    body = (
      <LeadTable
        key={list.id}
        picker={picker}
        uploadButton={uploadButton}
        userId={user.id}
        list={list}
        leads={leads}
        rules={rules}
        notes={notes}
        onAddNote={addNote}
        onEditNote={editNote}
        onDeleteNote={deleteNote}
      />
    )
  }

  return (
    <div className="page">
      <div className="frame">
        <TopNav page={route.page} listId={selectedId} profile={profile} onSignOut={onSignOut} />
        {body}
        {uploading && <UploadList onCreated={listCreated} onClose={() => setUploading(false)} />}
      </div>
    </div>
  )
}

export default Workspace
