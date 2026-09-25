// "Ewing, NJ" from "50 Walter Street, Ewing, NJ 08628". Display only; the
// stored Address is untouched.
function cityFromAddress(address) {
  if (!address) return ''
  const parts = address.split(',').map((p) => p.trim())
  if (parts.length < 3) return ''
  const state = parts.at(-1).split(' ')[0]
  return `${parts.at(-2)}, ${state}`
}

function Blank() {
  return <span className="blank">blank</span>
}

function LeadTable({ list, leads }) {
  return (
    <section>
      <div className="list-header">
        <div>
          <h1 className="list-title">{list.name}</h1>
          <p className="list-meta">
            {leads.length.toLocaleString()} leads · 0 called · matching your
            uploaded file
          </p>
        </div>
        <div className="list-actions">
          <div className="toggle" role="group" aria-label="Row order">
            <button type="button" className="toggle-option is-active">
              Original order
            </button>
            <button type="button" className="toggle-option placeholder" disabled>
              Ranked
            </button>
          </div>
          <button type="button" className="button placeholder" disabled>
            Re-rank
          </button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="lead-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Community</th>
              <th>Contact</th>
              <th className="num">Bed #</th>
              <th>Group</th>
              <th className="num">Group #</th>
              <th>Score</th>
              <th>Called</th>
            </tr>
          </thead>
          <tbody>
            {leads.map(({ id, row_number, data }) => (
              <tr key={id}>
                <td className="num row-number">{row_number}</td>
                <td>
                  <div className="primary">{data['Community'] ?? <Blank />}</div>
                  <div className="secondary">{cityFromAddress(data['Address'])}</div>
                </td>
                <td>
                  <div className="primary">{data['Contact'] ?? <Blank />}</div>
                  <div className="secondary">{data['Community Phone #']}</div>
                </td>
                <td className="num">{data['Bed #'] ?? <Blank />}</td>
                <td className="primary">{data['Group'] ?? <Blank />}</td>
                <td className="num">{data['Group #'] ?? <Blank />}</td>
                <td className="muted">—</td>
                <td className="muted">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="table-footer">
        <span>
          Rows 1–{leads.length} of {leads.length}, in file order
        </span>
        <span>Scores arrive in week 2</span>
      </footer>
    </section>
  )
}

export default LeadTable
