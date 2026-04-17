import { useState, useRef, useEffect } from 'react'
import CityScene from './components/CityScene'
import TerminalHUD from './components/TerminalHUD'
import FileTreePanel from './components/FileTreePanel'
import { useVfsStore } from './store/vfsStore'
import './App.css'

export default function App() {
  const [portalKey, setPortalKey] = useState(0)
  const canvasWrapperRef = useRef(null)
  const cwd  = useVfsStore(s => s.cwd)
  const cd   = useVfsStore(s => s.cd)
  const isFirst = useRef(true)

  // Clickable breadcrumb segments in the sidebar header
  const parts = cwd === '/' ? [] : cwd.split('/').filter(Boolean)
  function goTo(index) {
    if (index < 0) { cd('/'); return }
    cd('/' + parts.slice(0, index + 1).join('/'))
  }

  // Portal animation on every cd navigation
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }

    const el = canvasWrapperRef.current
    if (el) {
      el.style.willChange = 'transform'
      const cleanup = () => {
        el.classList.remove('portal-journey')
        el.style.willChange = 'auto'
      }
      el.addEventListener('animationend', cleanup, { once: true })
      el.classList.remove('portal-journey')
      void el.offsetWidth
      el.classList.add('portal-journey')
    }

    setPortalKey(k => k + 1)
  }, [cwd])

  return (
    <div className="app-root">

      {/* ── Left sidebar ─────────────────────────────────── */}
      <aside className="sidebar">

        {/* Header: logo + clickable path */}
        <header className="sidebar-header">
          <div className="sidebar-logo">⬡ Silicon City</div>
          <nav className="sidebar-path" aria-label="Current path">
            <span className="sidebar-path-seg sidebar-path-link" onClick={() => goTo(-1)}>~</span>
            {parts.map((part, i) => (
              <span key={i}>
                <span className="sidebar-path-sep">/</span>
                <span
                  className={`sidebar-path-seg ${i < parts.length - 1 ? 'sidebar-path-link' : 'sidebar-path-current'}`}
                  onClick={() => i < parts.length - 1 ? goTo(i) : undefined}
                >
                  {part}
                </span>
              </span>
            ))}
          </nav>
        </header>

        {/* File tree */}
        <div className="sidebar-section sidebar-tree-section">
          <div className="sidebar-section-label">FILE TREE</div>
          <div className="sidebar-tree-scroll">
            <FileTreePanel />
          </div>
        </div>

        {/* Terminal */}
        <div className="sidebar-section sidebar-terminal-section">
          <div className="sidebar-section-label">TERMINAL</div>
          <TerminalHUD />
        </div>

      </aside>

      {/* ── 3D city view ─────────────────────────────────── */}
      <div className="city-view">
        <div ref={canvasWrapperRef} className="canvas-wrapper">
          <CityScene />
        </div>
        {portalKey > 0 && <div key={portalKey} className="cd-portal-flash" />}
      </div>

    </div>
  )
}
