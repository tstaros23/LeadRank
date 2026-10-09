// The list title. With more than one list to choose from it becomes a
// dropdown; with one it is plain text.
function ListPicker({ lists, selected, showRep, onChange }) {
  const label = (list) =>
    showRep && list.owner?.full_name ? `${list.name} · ${list.owner.full_name}` : list.name

  if (lists.length < 2) {
    return <h1 className="list-title">{label(selected)}</h1>
  }

  return (
    <h1 className="list-title">
      <select
        className="list-picker"
        aria-label="Choose a list"
        value={selected.id}
        onChange={(e) => onChange(e.target.value)}
      >
        {lists.map((list) => (
          <option key={list.id} value={list.id}>
            {label(list)}
          </option>
        ))}
      </select>
    </h1>
  )
}

export default ListPicker
