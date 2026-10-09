import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import Workspace from './Workspace'
import './App.css'

// Sign-in gate. Supabase keeps the session in the browser, so a returning
// user goes straight to the workspace.
function App() {
  const [session, setSession] = useState(undefined) // undefined = still checking
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        setProfile(data)
        setProfileError(error?.message ?? null)
      })
    return () => {
      cancelled = true
      setProfile(null)
      setProfileError(null)
    }
  }, [userId])

  const signOut = () => supabase.auth.signOut()

  if (session === undefined) return null
  if (!session) return <Login />

  if (profileError) {
    return (
      <div className="page">
        <div className="frame">
          <p className="message message-error">
            Couldn't load your account: {profileError}{' '}
            <button type="button" className="link-button" onClick={signOut}>
              Sign out
            </button>
          </p>
        </div>
      </div>
    )
  }
  if (!profile) return null

  return <Workspace key={userId} user={session.user} profile={profile} onSignOut={signOut} />
}

export default App
