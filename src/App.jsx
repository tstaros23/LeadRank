import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import TopNav from './components/TopNav'
import LeadTable from './components/LeadTable'
import ScoringRules from './components/ScoringRules'
import './App.css'

// Tabs live in the URL hash so a refresh stays on the same tab.
function pageFromHash() {
  return window.location.hash === '#/rules' ? 'rules' : 'lists'
}

function App() {
  const [page, setPage] = useState(pageFromHash)
  const [list, setList] = useState(null)
  const [leads, setLeads] = useState([])
  const [rules, setRules] = useState([])
  const [notes, setNotes] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    async function load() {
      const fail = (message) => {
        setError(message)
        setStatus('error')
      }

      // Proof of concept: show the first list. List picking comes later.
      const listResult = await supabase.from('lists').select('*').order('created_at').limit(1)
      if (listResult.error) return fail(listResult.error.message)
      if (listResult.data.length === 0) return setStatus('empty')

      const firstList = listResult.data[0]
      const [leadResult, ruleResult, noteResult] = await Promise.all([
        supabase
          .from('leads')
          .select('id, row_number, data')
          .eq('list_id', firstList.id)
          .order('row_number'),
        supabase.from('rules').select('*').eq('list_id', firstList.id).order('position'),
        // Notes on this list's leads, newest first.
        supabase
          .from('notes')
          .select('id, lead_id, body, author, verdict, reason, created_at, leads!inner(list_id)')
          .eq('leads.list_id', firstList.id)
          .order('created_at', { ascending: false }),
      ])
      if (leadResult.error) return fail(leadResult.error.message)
      if (ruleResult.error) return fail(ruleResult.error.message)
      if (noteResult.error) return fail(noteResult.error.message)

      setList(firstList)
      setLeads(leadResult.data)
      setRules(ruleResult.data)
      setNotes(noteResult.data)
      setStatus('ready')
    }

    load()
  }, [])

  // Saves a note and adds it to the top of the lead's notes. Throws on failure
  // so the dialog can keep the text and show the error.
  async function addNote(leadId, body) {
    const { data, error: insertError } = await supabase
      .from('notes')
      // Hardcoded until sign-in exists.
      .insert({ lead_id: leadId, body, author: 'Ted S.' })
      .select('id, lead_id, body, author, verdict, reason, created_at')
      .single()
    if (insertError) throw new Error(insertError.message)
    setNotes((current) => [data, ...current])
  }

  return (
    <div className="page">
      <div className="frame">
        <TopNav page={page} />
        {status === 'loading' && <p className="message">Loading leads…</p>}
        {status === 'error' && (
          <p className="message message-error">Couldn't load leads: {error}</p>
        )}
        {status === 'empty' && (
          <p className="message">
            No lists yet. Run <code>supabase/seed.sql</code> to load one.
          </p>
        )}
        {status === 'ready' && page === 'lists' && (
          <LeadTable list={list} leads={leads} rules={rules} notes={notes} onAddNote={addNote} />
        )}
        {status === 'ready' && page === 'rules' && (
          <ScoringRules list={list} leads={leads} rules={rules} onSaved={setRules} />
        )}
      </div>
    </div>
  )
}

export default App
