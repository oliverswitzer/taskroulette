import { useEffect, useRef, useState } from 'react'
import { audioEvents, analyser, onAudioEvent, liveState } from '../audioDebug'

export default function AudioDebugOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const [, forceRender] = useState(0)
  const [collapsed, setCollapsed] = useState(false)

  // Subscribe to audio events for log updates
  useEffect(() => {
    const unsub = onAudioEvent(() => forceRender(n => n + 1))
    return unsub
  }, [])

  // Draw waveform continuously
  useEffect(() => {
    if (collapsed) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      if (!canvas || !ctx) return
      const W = canvas.width
      const H = canvas.height

      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, W, H)

      if (analyser) {
        const data = new Float32Array(analyser.fftSize)
        analyser.getFloatTimeDomainData(data)

        ctx.strokeStyle = '#00ff88'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        const step = W / data.length
        for (let i = 0; i < data.length; i++) {
          const x = i * step
          const y = (1 - (data[i] + 1) / 2) * H
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()

        // Center line
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(0, H / 2)
        ctx.lineTo(W, H / 2)
        ctx.stroke()
      } else {
        ctx.fillStyle = '#444'
        ctx.font = '10px monospace'
        ctx.fillText('no analyser', 4, 14)
      }
    }
    draw()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [collapsed])

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    background: 'rgba(0,0,0,0.92)',
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: 10,
    userSelect: 'none',
    backdropFilter: 'blur(4px)',
  }

  return (
    <div style={panelStyle}>
      {/* Header bar */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ padding: '4px 8px', background: '#111', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}
      >
        <span style={{ color: '#888' }}>🔊 AUDIO DEBUG</span>
        <span>ctx: <b style={{ color: liveState.ctxState === 'running' ? '#0f0' : '#f80' }}>{liveState.ctxState}</b></span>
        <span>elReady: <b style={{ color: liveState.audioElReady ? '#0f0' : '#f00' }}>{String(liveState.audioElReady)}</b></span>
        <span>elPaused: <b style={{ color: liveState.audioElPaused ? '#f80' : '#0f0' }}>{String(liveState.audioElPaused)}</b></span>
        <span>ticks: <b>{liveState.tickCount}</b></span>
        <span>nodes: <b>{liveState.activeNodes}</b></span>
        <span style={{ marginLeft: 'auto', color: '#555' }}>{collapsed ? '▲' : '▼'}</span>
      </div>

      {!collapsed && (
        <>
          {/* Waveform canvas — monitors what's going INTO mediaStreamDest */}
          <canvas
            ref={canvasRef}
            width={window.innerWidth}
            height={60}
            style={{ display: 'block', width: '100%', height: 60 }}
          />

          {/* Note: analyser is tapped on ctx.destination (silent monitor),
              not mediaStreamDest. To visualise exactly what audioEl hears we'd
              need to tap between nodes and mediaStreamDest — log events are
              more useful for that. */}

          {/* Event log — newest at top */}
          <div style={{ maxHeight: 120, overflowY: 'auto', padding: '2px 8px' }}>
            {[...audioEvents].reverse().map((ev, i) => (
              <div key={i} style={{ color: i === 0 ? '#fff' : '#0c0', lineHeight: 1.4 }}>
                <span style={{ color: '#555' }}>{ev.t}ms </span>{ev.label}
              </div>
            ))}
            {audioEvents.length === 0 && <div style={{ color: '#333' }}>no events yet — tap something</div>}
          </div>
        </>
      )}
    </div>
  )
}
