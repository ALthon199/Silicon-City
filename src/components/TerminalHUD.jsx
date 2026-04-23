import { useState, useEffect, useRef, useCallback } from 'react'
import { useVfsStore } from '../store/vfsStore'

// ── Help text ─────────────────────────────────────────────────────────────────
// Groups: [label, [[signature, description], ...]]
const HELP_GROUPS = [
  ['Filesystem', [
    ['mkdir <name>',     'create a directory'],
    ['touch <name> [n]', 'create a file  (n = size bytes)'],
    ['rm <name>',        'delete a file or directory'],
    ['mv <src> <dest>',  'rename a file or directory'],
    ['cp <src> <dest>',  'copy a file or directory'],
  ]],
  ['Navigation', [
    ['cd <name|..>',     'enter a directory or go up'],
    ['ls',               'list current directory'],
    ['tree',             'show full directory tree'],
    ['pwd',              'print working directory'],
    ['cat <name>',       'show file metadata'],
  ]],
  ['Terminal', [
    ['help',             'show this help'],
    ['clear',            'clear the terminal'],
  ]],
  ['GitHub', [
    ['load <owner/repo>', 'load a public GitHub repo into the city'],
  ]],
]

const HELP_KEYS = [
  ['Tab',   'autocomplete command or filename'],
  ['↑ / ↓', 'cycle through command history'],
]

// Auto-compute column width from longest signature across all groups
const _allSigs = HELP_GROUPS.flatMap(([, cmds]) => cmds.map(([s]) => s))
const _sigW    = Math.max(..._allSigs.map(s => s.length))
const _keyW    = Math.max(...HELP_KEYS.map(([s]) => s.length))
const _W       = _sigW + 8 + 26   // indent(2) + sig + gap(4) + avg desc

const HELP_TEXT = [
  '─'.repeat(_W),
  '  Silicon City  ─  commands',
  '─'.repeat(_W),
  ...HELP_GROUPS.flatMap(([label, cmds]) => [
    '',
    `  ${label}`,
    ...cmds.map(([sig, desc]) => `    ${sig.padEnd(_sigW)}  ${desc}`),
  ]),
  '',
  '─'.repeat(_W),
  '  Keyboard',
  ...HELP_KEYS.map(([key, desc]) => `    ${key.padEnd(_keyW)}  ${desc}`),
  '─'.repeat(_W),
].join('\n')

// ── All recognised command names (for Tab-completion) ─────────────────────────
const ALL_CMDS = [
  'mkdir', 'touch', 'cd', 'rm', 'mv', 'cp', 'cat', 'ls', 'tree', 'pwd', 'help', 'clear', 'load',
]

// ── Utilities ─────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

function extLabel(ext) {
  const map = {
    js: 'JavaScript', jsx: 'React/JSX', ts: 'TypeScript', tsx: 'React/TSX',
    py: 'Python', go: 'Go', rs: 'Rust', c: 'C', cpp: 'C++',
    json: 'JSON', css: 'CSS', html: 'HTML', md: 'Markdown', txt: 'Plain Text',
    mp4: 'Video', mov: 'Video', avi: 'Video', png: 'Image', jpg: 'Image', svg: 'SVG',
  }
  return ext ? (map[ext.toLowerCase()] ?? ext.toUpperCase()) : 'unknown'
}

// Recursive tree printer → array of strings
function printTree(node, prefix = '') {
  const lines    = []
  const children = node.children ?? []
  children.forEach((child, i) => {
    const isLast  = i === children.length - 1
    const branch  = isLast ? '└── ' : '├── '
    const label   = child.type === 'dir' ? child.name + '/' : child.name
    lines.push(prefix + branch + label)
    if (child.type === 'dir') {
      lines.push(...printTree(child, prefix + (isLast ? '    ' : '│   ')))
    }
  })
  return lines
}

// ── Command parser ────────────────────────────────────────────────────────────
function parseCommand(input, store) {
  const parts = input.trim().split(/\s+/)
  const cmd   = parts[0]?.toLowerCase()

  switch (cmd) {
    case 'mkdir': {
      const name = parts[1]
      if (!name) return 'Usage: mkdir <name>'
      store.mkdir(name)
      return `Created directory: ${name}`
    }
    case 'touch': {
      const name = parts[1]
      if (!name) return 'Usage: touch <name> [sizeBytes]'
      const size = parts[2] ? parseInt(parts[2], 10) : undefined
      store.touch(name, size)
      return `Created file: ${name}`
    }
    case 'cd': {
      const target = parts[1]
      if (!target) return 'Usage: cd <name|..>'
      store.cd(target)
      return null
    }
    case 'rm': {
      const name = parts[1]
      if (!name) return 'Usage: rm <name>'
      const exists = store.ls().find(e => e.name === name)
      if (!exists) return `rm: ${name}: No such file or directory`
      // Fire pre-demolition event so CityScene starts the animation immediately,
      // then actually remove from VFS after the dust cloud has been visible for a beat.
      window.dispatchEvent(new CustomEvent('vfs-pre-remove', { detail: { name } }))
      setTimeout(() => store.rm(name), 1400)
      return `Demolishing: ${name}…`
    }
    case 'mv': {
      const [, src, dest] = parts
      if (!src || !dest) return 'Usage: mv <src> <dest>'
      store.mv(src, dest)
      return `Renamed: ${src} → ${dest}`
    }
    case 'cp': {
      const [, src, dest] = parts
      if (!src || !dest) return 'Usage: cp <src> <dest>'
      store.cp(src, dest)
      return `Copied: ${src} → ${dest}`
    }
    case 'cat': {
      const name = parts[1]
      if (!name) return 'Usage: cat <filename>'
      const entries = store.ls()
      const node = entries.find(e => e.name === name)
      if (!node) return `cat: ${name}: No such file or directory`
      if (node.type === 'dir') return `cat: ${name}: Is a directory`
      const cwd = store.cwd
      return [
        `── ${name} ${'─'.repeat(Math.max(0, 28 - name.length))}`,
        `   type   file`,
        `   lang   ${extLabel(node.ext)}`,
        `   size   ${formatBytes(node.size)}`,
        `   path   ${cwd === '/' ? '' : cwd}/${name}`,
        `${'─'.repeat(32)}`,
      ].join('\n')
    }
    case 'ls': {
      const entries = store.ls()
      if (entries.length === 0) return '(empty directory)'
      const maxLen = Math.max(...entries.map(e => e.name.length))
      return entries
        .map(e => e.type === 'dir'
          ? `  ${(e.name + '/').padEnd(maxLen + 2)}  dir`
          : `  ${e.name.padEnd(maxLen + 1)}  ${formatBytes(e.size)}`)
        .join('\n')
    }
    case 'pwd':
      return store.cwd
    case 'tree': {
      const cwdNode = store.getCwdNode()
      if (!cwdNode) return 'No directory'
      const lines = [store.cwd + '/']
      lines.push(...printTree(cwdNode))
      if (lines.length === 1) lines.push('  (empty)')
      return lines.join('\n')
    }
    case 'help':
      return HELP_TEXT
    case 'clear':
      return '__CLEAR__'
    default:
      return `Command not found: ${cmd}. Type 'help'.`
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TerminalHUD() {
  const [input, setInput]       = useState('')
  const [history, setHistory]   = useState([
    { type: 'system', text: 'Welcome to Silicon City.' },
    { type: 'system', text: "Type 'help' or press Tab." },
  ])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [cmdHistory, setCmdHistory] = useState([])

  const inputRef  = useRef(null)
  const outputRef = useRef(null)
  const store = useVfsStore()
  const cwd   = useVfsStore(s => s.cwd)

  // Auto-scroll whenever new output arrives
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [history])

  // ── Listen for building-click events (dispatched by Building.jsx) ─────────
  useEffect(() => {
    const handler = e => {
      const { name, ext, size } = e.detail
      const divider = '─'.repeat(Math.max(0, 28 - name.length))
      const text = [
        `── ${name} ${divider}`,
        `   type   file`,
        `   lang   ${extLabel(ext)}`,
        `   size   ${formatBytes(size)}`,
        `   path   ${cwd === '/' ? '' : cwd}/${name}`,
        `${'─'.repeat(32)}`,
      ].join('\n')
      setHistory(prev => [...prev, { type: 'output', text }])
    }
    window.addEventListener('vfs-inspect', handler)
    return () => window.removeEventListener('vfs-inspect', handler)
  }, [cwd])

  function prompt() {
    return `${cwd}$ `
  }

  const addOutput = useCallback(text => {
    setHistory(prev => [...prev, { type: 'output', text }])
  }, [])

  async function submit() {
    const trimmed = input.trim()
    if (!trimmed) return

    setCmdHistory(prev => [trimmed, ...prev])
    setHistoryIdx(-1)
    setInput('')

    const echo  = { type: 'input', text: prompt() + trimmed }
    const parts = trimmed.split(/\s+/)
    const cmd   = parts[0]?.toLowerCase()

    // ── load <owner/repo> — async GitHub fetch ────────────────────────────────
    if (cmd === 'load') {
      const slug = parts[1] ?? ''
      if (!slug.includes('/')) {
        setHistory(prev => [...prev, echo, { type: 'output', text: 'Usage: load <owner/repo>  (e.g. load facebook/react)' }])
        return
      }
      const [owner, repo] = slug.split('/')
      setHistory(prev => [...prev, echo, { type: 'output', text: `Fetching ${owner}/${repo} from GitHub…` }])
      try {
        const { fileCount, dirCount, truncated } = await store.loadRepo(owner, repo)
        const note = truncated ? '  ⚠ tree truncated (repo >100 k files)' : ''
        setHistory(prev => [
          ...prev,
          { type: 'output', text: `Loaded ${owner}/${repo} — ${fileCount} files, ${dirCount} dirs${note}` },
        ])
      } catch (err) {
        setHistory(prev => [...prev, { type: 'output', text: `Error: ${err.message}` }])
      }
      return
    }

    // ── all other commands (synchronous) ─────────────────────────────────────
    const result = parseCommand(trimmed, store)

    if (result === '__CLEAR__') {
      setHistory([echo])
    } else {
      const lines = [echo]
      if (result) lines.push({ type: 'output', text: result })
      setHistory(prev => [...prev, ...lines])
    }
  }

  function onKeyDown(e) {
    // ── Tab autocomplete ────────────────────────────────────────────────────
    if (e.key === 'Tab') {
      e.preventDefault()
      const tokens  = input.split(/\s+/)
      const partial = tokens[tokens.length - 1] ?? ''

      if (tokens.length <= 1) {
        // Completing a command name
        const matches = ALL_CMDS.filter(c => c.startsWith(partial.toLowerCase()))
        if (matches.length === 1) {
          setInput(matches[0] + ' ')
        } else if (matches.length > 1) {
          addOutput(matches.join('   '))
        }
      } else {
        // Completing a filename / dirname
        const entries  = store.ls()
        const lower    = partial.toLowerCase()
        const matches  = entries.filter(e => e.name.toLowerCase().startsWith(lower))
        if (matches.length === 1) {
          const suffix   = matches[0].type === 'dir' ? '/' : ''
          const newLast  = matches[0].name + suffix
          setInput(tokens.slice(0, -1).concat(newLast).join(' '))
        } else if (matches.length > 1) {
          addOutput(matches.map(e => e.name + (e.type === 'dir' ? '/' : '')).join('   '))
        }
      }
      return
    }

    // ── Enter ───────────────────────────────────────────────────────────────
    if (e.key === 'Enter') {
      submit()
      return
    }

    // ── Command history navigation ───────────────────────────────────────────
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHistoryIdx(prev => {
        const next = Math.min(prev + 1, cmdHistory.length - 1)
        setInput(cmdHistory[next] ?? '')
        return next
      })
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHistoryIdx(prev => {
        const next = Math.max(prev - 1, -1)
        setInput(next === -1 ? '' : cmdHistory[next] ?? '')
        return next
      })
    }
  }

  return (
    <>
      <div className="terminal-output" ref={outputRef}>
        {history.map((line, i) => (
          <div key={i} className={`terminal-line terminal-${line.type}`}>
            <pre>{line.text}</pre>
          </div>
        ))}
      </div>

      <div className="terminal-input-row">
        <span className="terminal-prompt">{prompt()}</span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          placeholder="type a command… (Tab to complete)"
        />
      </div>
    </>
  )
}
