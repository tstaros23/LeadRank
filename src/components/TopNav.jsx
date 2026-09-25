// Nav items and user are hardcoded until auth and routing exist.
function TopNav() {
  return (
    <header className="topnav">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        LeadRank
      </div>
      <nav className="nav-links">
        <a className="nav-link is-active" href="/">Lists</a>
        <span className="nav-link placeholder">Scoring rules</span>
        <span className="nav-link placeholder">Team</span>
      </nav>
      <div className="user">
        <span className="avatar">TS</span>
        Ted S. · Sales rep
      </div>
    </header>
  )
}

export default TopNav
