import { useVfsStore } from '../store/vfsStore'

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1_048_576).toFixed(1)}MB`
}

// Extension → colour for file entries
const EXT_COLOR = {
  js:   '#f0db4f', jsx: '#61dafb', ts:   '#3178c6', tsx: '#61dafb',
  css:  '#264de4', html:'#e34c26', json: '#cb9820', md:  '#6ab0f5',
  py:   '#3572a5', rs:  '#dea584', go:   '#00add8', sh:  '#4eaa25',
}
function extColor(name) {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
  return EXT_COLOR[ext] ?? 'rgba(255,255,255,0.45)'
}

function TreeNode({ node, path, depth, cwd, onCd }) {
  const indent = depth * 14 + 8

  if (node.type === 'file') {
    return (
      <div className="tree-file" style={{ paddingLeft: indent }}>
        <span className="tree-bullet" style={{ color: extColor(node.name) }}>■</span>
        <span className="tree-name">{node.name}</span>
        <span className="tree-size">{formatBytes(node.size)}</span>
      </div>
    )
  }

  // directory
  const isCurrentDir = path === cwd
  const isOpen = cwd === path || cwd.startsWith(path === '/' ? '/' : path + '/')
  const children = node.children ?? []

  return (
    <div>
      <div
        className={`tree-dir${isCurrentDir ? ' tree-dir--active' : ''}`}
        style={{ paddingLeft: indent }}
        onClick={() => onCd(path)}
        title={`cd ${path}`}
      >
        <span className="tree-chevron">{isOpen ? '▾' : '▸'}</span>
        <span className="tree-name">
          {depth === 0 ? '/' : node.name + '/'}
        </span>
        {isCurrentDir && <span className="tree-cwd-badge">cwd</span>}
      </div>

      {/* Always render children of open directories */}
      {isOpen && children.map(child => {
        const childPath = path === '/' ? '/' + child.name : path + '/' + child.name
        return (
          <TreeNode
            key={child.name}
            node={child}
            path={childPath}
            depth={depth + 1}
            cwd={cwd}
            onCd={onCd}
          />
        )
      })}
    </div>
  )
}

export default function FileTreePanel() {
  const tree = useVfsStore(s => s.tree)
  const cwd  = useVfsStore(s => s.cwd)
  const cd   = useVfsStore(s => s.cd)

  return (
    <div className="file-tree">
      <TreeNode
        node={tree}
        path="/"
        depth={0}
        cwd={cwd}
        onCd={cd}
      />
      {(!tree.children || tree.children.length === 0) && (
        <p className="tree-empty">Empty — try <code>mkdir</code> or <code>touch</code></p>
      )}
    </div>
  )
}
