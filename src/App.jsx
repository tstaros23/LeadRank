import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import TopNav from './components/TopNav'
import LeadTable from './components/LeadTable'
import './App.css'

function App() {
  const [list, setList] = useState(null)
  const [leads, setLeads] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      // Proof of concept: show the first list. List picking comes later.
      const { data: lists, error: listError } = await supabase
        .from('lists')
        .select('*')
        .order('created_at')
        .limit(1)

      if (listError) {
        setError(listError.message)
        setStatus('error')
        return
      }
      if (lists.length === 0) {
        setStatus('empty')
        return
      }

      const { data: rows, error: leadError } = await supabase
        .from('leads')
        .select('id, row_number, data')
        .eq('list_id', lists[0].id)
        .order('row_number')

      if (leadError) {
        setError(leadError.message)
        setStatus('error')
        return
      }

      setList(lists[0])
      setLeads(rows)
      setStatus('ready')
    }

    load()
  }, [])

  return (
    <div className="page">
      <div className="frame">
        <TopNav />
        {status === 'loading' && <p className="message">Loading leads…</p>}
        {status === 'error' && (
          <p className="message message-error">Couldn't load leads: {error}</p>
        )}
        {status === 'empty' && (
          <p className="message">
            No lists yet. Run <code>supabase/seed.sql</code> to load one.
          </p>
        )}
        {status === 'ready' && <LeadTable list={list} leads={leads} />}
      </div>
    </div>
  )
}

export default App
