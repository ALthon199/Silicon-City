import { create } from 'zustand'
import { fetchRepoTree } from '../api/github'

const ROOT = { name: '/', type: 'dir', children: [] }

// Walk an absolute path string and return the node, or null if not found
function getNodeAtPath(tree, path) {
  if (path === '/') return tree
  const parts = path.split('/').filter(Boolean)
  let node = tree
  for (const part of parts) {
    if (node.type !== 'dir') return null
    const child = node.children.find(c => c.name === part)
    if (!child) return null
    node = child
  }
  return node
}

// Build absolute path string from cwd + name
function joinPath(cwd, name) {
  if (cwd === '/') return '/' + name
  return cwd + '/' + name
}

// Remove a node by name from a parent node's children array (immutably via splice on clone)
function removeChild(parent, name) {
  const idx = parent.children.findIndex(c => c.name === name)
  if (idx === -1) return false
  parent.children.splice(idx, 1)
  return true
}

// Default random file size: between 1 KB and 50 MB
function randomSize() {
  return Math.floor(Math.random() * 50_000_000) + 1024
}

export const useVfsStore = create((set, get) => ({
  tree: ROOT,
  cwd: '/',

  // Derived helper: returns the live node for the current directory
  getCwdNode() {
    return getNodeAtPath(get().tree, get().cwd)
  },

  // ls — returns children in cwd with full metadata
  ls() {
    const node = get().getCwdNode()
    if (!node || node.type !== 'dir') return []
    return node.children.map(c => ({ name: c.name, type: c.type, size: c.size, ext: c.ext }))
  },

  // mkdir — add a directory child to cwd
  mkdir(name) {
    set(state => {
      const parent = getNodeAtPath(state.tree, state.cwd)
      if (!parent || parent.type !== 'dir') return {}
      if (parent.children.find(c => c.name === name)) return {} // already exists
      parent.children.push({ name, type: 'dir', children: [] })
      return { tree: { ...state.tree } } // trigger re-render
    })
  },

  // touch — add a file leaf to cwd
  touch(name, sizeBytes) {
    set(state => {
      const parent = getNodeAtPath(state.tree, state.cwd)
      if (!parent || parent.type !== 'dir') return {}
      if (parent.children.find(c => c.name === name)) return {}
      const ext = name.includes('.') ? name.split('.').pop() : ''
      parent.children.push({
        name,
        type: 'file',
        ext,
        size: sizeBytes ?? randomSize(),
      })
      return { tree: { ...state.tree } }
    })
  },

  // cd — navigate to a path (relative name or '..' or absolute)
  cd(target) {
    set(state => {
      let nextPath

      if (target === '..') {
        if (state.cwd === '/') return {}
        const parts = state.cwd.split('/').filter(Boolean)
        parts.pop()
        nextPath = parts.length === 0 ? '/' : '/' + parts.join('/')
      } else if (target.startsWith('/')) {
        nextPath = target
      } else {
        nextPath = joinPath(state.cwd, target)
      }

      const node = getNodeAtPath(state.tree, nextPath)
      if (!node || node.type !== 'dir') return {} // invalid target
      return { cwd: nextPath }
    })
  },

  // rm — remove a child (file or dir) from cwd by name
  rm(name) {
    set(state => {
      const parent = getNodeAtPath(state.tree, state.cwd)
      if (!parent || parent.type !== 'dir') return {}
      const removed = removeChild(parent, name)
      if (!removed) return {}
      return { tree: { ...state.tree } }
    })
  },

  // mv — rename a child within cwd (simple rename; no cross-dir move)
  mv(src, dest) {
    set(state => {
      const parent = getNodeAtPath(state.tree, state.cwd)
      if (!parent || parent.type !== 'dir') return {}
      const idx = parent.children.findIndex(c => c.name === src)
      if (idx === -1) return {}
      if (parent.children.find(c => c.name === dest)) return {} // dest already exists
      const node = parent.children[idx]
      const ext  = dest.includes('.') ? dest.split('.').pop() : node.ext ?? ''
      parent.children[idx] = { ...node, name: dest, ext }
      return { tree: { ...state.tree } }
    })
  },

  // cp — shallow-copy a child within cwd (dirs copy without deep children)
  cp(src, dest) {
    set(state => {
      const parent = getNodeAtPath(state.tree, state.cwd)
      if (!parent || parent.type !== 'dir') return {}
      const node = parent.children.find(c => c.name === src)
      if (!node) return {}
      if (parent.children.find(c => c.name === dest)) return {}
      const ext  = dest.includes('.') ? dest.split('.').pop() : node.ext ?? ''
      const copy = node.type === 'file'
        ? { ...node, name: dest, ext }
        : { ...node, name: dest, children: [] }   // dirs copy empty
      parent.children.push(copy)
      return { tree: { ...state.tree } }
    })
  },

  // loadRepo — fetch a public GitHub repo and replace the entire VFS tree.
  // Returns metadata ({ fileCount, dirCount, truncated }) for the caller to display.
  async loadRepo(owner, repo) {
    const { tree, fileCount, dirCount, truncated } = await fetchRepoTree(owner, repo)
    set({ tree, cwd: '/' })
    return { fileCount, dirCount, truncated }
  },
}))
