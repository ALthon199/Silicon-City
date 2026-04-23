/**
 * github.js — unauthenticated GitHub REST API helpers.
 *
 * Uses the public API (no token required) — limited to 60 req/hr per IP,
 * which is more than enough for interactive demo usage.
 *
 * fetchRepoTree(owner, repo)
 *   → resolves with the VFS-compatible root tree node
 *   → throws a human-readable Error on failure
 */

// ── Tree parser ───────────────────────────────────────────────────────────────
// GitHub returns a FLAT array of { path, type, size } objects.
// We reconstruct the nested VFS structure: { name, type, children?, ext?, size? }

function getOrCreateDir(pathMap, root, dirPath) {
  if (pathMap[dirPath]) return pathMap[dirPath]
  const parts = dirPath.split('/')
  const name  = parts[parts.length - 1]
  const dir   = { name, type: 'dir', children: [] }
  pathMap[dirPath] = dir
  const parentPath = parts.slice(0, -1).join('/')
  const parent     = parentPath === '' ? root : getOrCreateDir(pathMap, root, parentPath)
  parent.children.push(dir)
  return dir
}

function parseRepoTree(items) {
  const root    = { name: '/', type: 'dir', children: [] }
  const pathMap = {}   // dirPath → dir node

  // First pass: create all directory nodes so files can find their parents
  for (const item of items) {
    if (item.type === 'tree') getOrCreateDir(pathMap, root, item.path)
  }

  // Second pass: attach file (blob) nodes to their parent directories
  for (const item of items) {
    if (item.type !== 'blob') continue
    const parts      = item.path.split('/')
    const name       = parts[parts.length - 1]
    const ext        = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
    const parentPath = parts.slice(0, -1).join('/')
    const parent     = parentPath === ''
      ? root
      : (pathMap[parentPath] ?? getOrCreateDir(pathMap, root, parentPath))
    parent.children.push({ name, type: 'file', ext, size: item.size ?? 1024 })
  }

  return root
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Fetches the full recursive file tree of a public GitHub repository.
 *
 * @param {string} owner  — GitHub username or org  (e.g. 'facebook')
 * @param {string} repo   — Repository name         (e.g. 'react')
 * @returns {{ tree: object, truncated: boolean, fileCount: number, dirCount: number }}
 */
export async function fetchRepoTree(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`

  let res
  try {
    res = await fetch(url, { headers: { Accept: 'application/vnd.github.v3+json' } })
  } catch {
    throw new Error('Network error — check your internet connection')
  }

  if (res.status === 404) throw new Error(`Repository '${owner}/${repo}' not found`)
  if (res.status === 403 || res.status === 429) {
    throw new Error('GitHub API rate limit reached (60 req/hr). Wait a minute and retry.')
  }
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)

  const data = await res.json()

  const fileCount = data.tree.filter(i => i.type === 'blob').length
  const dirCount  = data.tree.filter(i => i.type === 'tree').length
  const tree      = parseRepoTree(data.tree)

  return { tree, truncated: !!data.truncated, fileCount, dirCount }
}
