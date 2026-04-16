import { useState, useRef } from 'react'
import CityScene from './components/CityScene'
import TerminalHUD from './components/TerminalHUD'
import Breadcrumb from './components/Breadcrumb'
import './App.css'

export default function App() {
  const [showLabels, setShowLabels] = useState(false)
  const lsTimerRef = useRef(null)

  function handleLsToggle() {
    setShowLabels(true)
    clearTimeout(lsTimerRef.current)
    lsTimerRef.current = setTimeout(() => setShowLabels(false), 5000)
  }

  return (
    <div className="app-root">
      <CityScene showLabels={showLabels} />
      <Breadcrumb />
      <TerminalHUD onLsToggle={handleLsToggle} />
    </div>
  )
}
