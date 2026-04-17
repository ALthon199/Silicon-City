import { useState, useEffect, useRef, useCallback } from 'react'
import { useVfsStore } from '../store/vfsStore'

// ── Help text ─────────────────────────────────────────────────────────────────
const HELP_TEXT = `Available commands:
  mkdir <name>        — create a directory
  touch <name> [n]    — create a file  (n = size in bytes)
  cd <name|..>        — enter a directory or go up
  rm <name>           — remove a file or directory
  mv <src> <dest>     — rename a file or directory
  cp <src> <dest>     — copy a file (empty copy for dirs)
  cat <name>          — show file info
  ls                  — list current directory
  tree                — print directory tree
  pwd                 — print working directory
  help                — show this message
  clear               — clear terminal output
  Tab                 — autocomplete command / filename`

// ── All recognised command names (for Tab-completion) ─────────────────────────
const ALL_CMDS = [
  'mkdir', 'touch', 'cd', 'rm', 'mv', 'cp', 'cat', 'ls', 'tree', 'pwd', 'help', 'clear',
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
  const lines = []
  const children = node.children ?? []
  children.forEach((child, i) => {
    const isLast = i === children.length - 1
    const branch = isLast ? '└── ' : '├── '
    const icon   = child.type === 'dir' ? '📁 ' : '📄 '
    lines.push(prefix + branch + icon + child.name + (child.type === 'dir' ? '/' : ''))
    if (child.type === 'dir' && child.children?.length) {
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
      store.rm(name)
      return `Removed: ${name}`
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
      return entries
        .map(e => (e.type === 'dir' ? `📁 ${e.name}/` : `📄 ${e.name} (${formatBytes(e.size)})`))
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

  function submit() {
    const trimmed = input.trim()
    if (!trimmed) return

    setCmdHistory(prev => [trimmed, ...prev])
    setHistoryIdx(-1)

    const echo   = { type: 'input', text: prompt() + trimmed }
    const result = parseCommand(trimmed, store)

    if (result === '__CLEAR__') {
      setHistory([echo])
    } else {
      const lines = [echo]
      if (result) lines.push({ type: 'output', text: result })
      setHistory(prev => [...prev, ...lines])
    }

    setInput('')
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
