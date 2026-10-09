import { useState } from 'react'
import { supabase } from '../supabaseClient'

// Email and password sign-in. Accounts are created by the owner in Supabase;
// there is no sign-up here.
function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    // On success the auth listener in App swaps this screen out.
    if (signInError) {
      setError(signInError.message)
      setBusy(false)
    }
  }

  return (
    <div className="page login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          LeadRank
        </div>
        <h1 className="login-title">Sign in</h1>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p className="message-error login-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button button-primary login-submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="login-hint">No account? Ask your organization's owner to add you.</p>
      </form>
    </div>
  )
}

export default Login
