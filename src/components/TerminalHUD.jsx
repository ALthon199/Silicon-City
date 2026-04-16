import { useState, useEffect, useRef } from 'react'
import { useVfsStore } from '../store/vfsStore'

const HELP_TEXT = `Available commands:
  mkdir <name>       — create a directory
  touch <name> [n]   — create a file (n = bytes, optional)
  cd <name|..>       — enter a directory
  rm <name>          — remove a file or directory
  ls                 — list current directory
  help               — show this message
  clear              — clear terminal output`

function parseCommand(input, store) {
  const parts = input.trim().split(/\s+/)
  const cmd = parts[0]?.toLowerCase()

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
      return null // output the new prompt instead
    }
    case 'rm': {
      const name = parts[1]
      if (!name) return 'Usage: rm <name>'
      store.rm(name)
      return `Removed: ${name}`
    }
    case 'ls': {
      const entries = store.ls()
      if (entries.length === 0) return '(empty directory)'
      return entries
        .map(e => (e.type === 'dir' ? `📁 ${e.name}/` : `📄 ${e.name} (${formatBytes(e.size)})`))
        .join('\n')
    }
    case 'help':
      return HELP_TEXT
    case 'clear':
      return '__CLEAR__'
    default:
      return `Command not found: ${cmd}. Type 'help' for commands.`
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

export default function TerminalHUD({ onLsToggle }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([
    { type: 'system', text: "Welcome to Silicon City. Press ~ to open the terminal." },
    { type: 'system', text: "Type 'help' for available commands." },
  ])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [cmdHistory, setCmdHistory] = useState([])

  const inputRef = useRef(null)
  const outputRef = useRef(null)
  const store = useVfsStore()
  const cwd = useVfsStore(s => s.cwd)

  // Toggle terminal on ~ key
  useEffect(() => {
    function onKey(e) {
      if (e.key === '`' || e.key === '~') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Scroll to bottom on new output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [history])

  function prompt() {
    return `silicon-city:${cwd}$ `
  }

  function submit() {
    const trimmed = input.trim()
    if (!trimmed) return

    // Record to command history for arrow-up navigation
    setCmdHistory(prev => [trimmed, ...prev])
    setHistoryIdx(-1)

    // Echo the command
    const echo = { type: 'input', text: prompt() + trimmed }

    const result = parseCommand(trimmed, store)

    if (result === '__CLEAR__') {
      setHistory([echo])
    } else {
      const lines = []
      lines.push(echo)

      if (result) {
        // Check if ls was called — notify parent to show labels
        if (trimmed.toLowerCase().startsWith('ls') && onLsToggle) {
          onLsToggle()
        }
        lines.push({ type: 'output', text: result })
      }
      setHistory(prev => [...prev, ...lines])
    }

    setInput('')
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      submit()
    } else if (e.key === 'ArrowUp') {
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
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <div className="hud-hint">
        Press <kbd>~</kbd> to open terminal
      </div>
    )
  }

  return (
    <div className="terminal-overlay" onClick={e => e.stopPropagation()}>
      <div className="terminal-window">
        <div className="terminal-titlebar">
          <span className="terminal-title">Silicon City — Terminal</span>
          <button className="terminal-close" onClick={() => setOpen(false)}>✕</button>
        </div>

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
          />
        </div>
      </div>
    </div>
  )
}
