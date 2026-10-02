// The user is hardcoded until auth exists.
function TopNav({ page }) {
  const linkClass = (name) => `nav-link${page === name ? ' is-active' : ''}`

  return (
    <header className="topnav">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        LeadRank
      </div>
      <nav className="nav-links">
        <a className={linkClass('lists')} href="#/">Lists</a>
        <a className={linkClass('rules')} href="#/rules">Scoring rules</a>
        <span className="nav-link placeholder">Team</span>
      </nav>
      <div className="user">
        <span className="avatar">TS</span>
        <span className="user-label">Ted S. · Sales rep</span>
      </div>
    </header>
  )
}

export default TopNav
