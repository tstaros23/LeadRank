import { hashFor } from '../routes'

function initials(name) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
  return (letters.length > 1 ? letters[0] + letters.at(-1) : letters[0] ?? '?').toUpperCase()
}

const ROLE_LABEL = { owner: 'Owner', rep: 'Sales rep' }

function TopNav({ page, listId, profile, onSignOut }) {
  const linkClass = (name) => `nav-link${page === name ? ' is-active' : ''}`

  return (
    <header className="topnav">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        LeadRank
      </div>
      <nav className="nav-links">
        <a className={linkClass('lists')} href={hashFor('lists', listId)}>Lists</a>
        <a className={linkClass('rules')} href={hashFor('rules', listId)}>Scoring rules</a>
        <span className="nav-link placeholder">Team</span>
      </nav>
      <div className="user">
        <span className="avatar" aria-hidden="true">{initials(profile.full_name)}</span>
        <span className="user-label">
          {profile.full_name} · {ROLE_LABEL[profile.role]}
        </span>
        <button type="button" className="link-button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  )
}

export default TopNav
