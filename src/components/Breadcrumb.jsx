import { useVfsStore } from '../store/vfsStore'

export default function Breadcrumb() {
  const cwd = useVfsStore(s => s.cwd)
  const cd = useVfsStore(s => s.cd)

  // Split path into clickable segments
  const parts = cwd === '/' ? [] : cwd.split('/').filter(Boolean)

  function goTo(index) {
    if (index < 0) { cd('/'); return }
    const path = '/' + parts.slice(0, index + 1).join('/')
    cd(path)
  }

  return (
    <div className="breadcrumb">
      {/* key forces remount on every cwd change, replaying the stagger animation */}
      <span key={cwd} style={{ display: 'contents' }}>
        <span
          className="breadcrumb-seg clickable breadcrumb-animate"
          style={{ animationDelay: '0ms' }}
          onClick={() => goTo(-1)}
        >/</span>
        {parts.map((part, i) => (
          <span key={i} className="breadcrumb-animate" style={{ animationDelay: `${(i + 1) * 60}ms` }}>
            <span className="breadcrumb-sep"> › </span>
            <span
              className={`breadcrumb-seg ${i < parts.length - 1 ? 'clickable' : 'current'}`}
              onClick={() => i < parts.length - 1 && goTo(i)}
            >
              {part}
            </span>
          </span>
        ))}
      </span>
      <span className="breadcrumb-hint"> · click a gate to enter · WASD to pan · scroll to zoom</span>
    </div>
  )
}
