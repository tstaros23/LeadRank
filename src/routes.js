// The URL hash holds the page and the list: #/lists/<id> or #/rules/<id>.
// A missing id means "the first list".

export function parseHash() {
  const [page = 'lists', listId = null] = window.location.hash.replace(/^#\/?/, '').split('/')
  return { page: page === 'rules' ? 'rules' : 'lists', listId }
}

export function hashFor(page, listId) {
  return `#/${page}${listId ? `/${listId}` : ''}`
}
