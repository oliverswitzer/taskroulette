import { useState } from 'react'
import type { AppState } from './types'

function App() {
  const [appState, _setAppState] = useState<AppState>('DUMP')
  
  return (
    <div style={{ 
      minHeight: '100dvh', 
      background: 'oklch(12% 0.02 260)',
      color: 'oklch(95% 0.01 260)',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <p style={{ padding: 20 }}>TaskRoulette -- {appState}</p>
    </div>
  )
}

export default App
