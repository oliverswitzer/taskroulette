// Mechanical ratchet tick — bandpass-filtered white noise burst
// Sounds like a metal pawl hitting a physical wheel notch
// NOT a UI beep

let audioCtx: AudioContext | null = null

export function initAudioContext(): void {
  if (audioCtx) return
  audioCtx = new AudioContext()
}

export function playTick(velocity: number): void {
  if (!audioCtx) return
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
    return
  }

  const sampleRate = audioCtx.sampleRate
  const bufferSize = Math.floor(sampleRate * 0.008) // 8ms burst
  const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate)
  const data = buffer.getChannelData(0)

  // White noise with exponential decay envelope
  for (let i = 0; i < bufferSize; i++) {
    const envelope = Math.exp(-i / (bufferSize * 0.25))
    data[i] = (Math.random() * 2 - 1) * envelope
  }

  // Bandpass filter — gives it that mechanical "click" character
  const filter = audioCtx.createBiquadFilter()
  filter.type = 'bandpass'
  // Pitch rises with wheel speed — faster spin = higher frequency click
  filter.frequency.value = 600 + velocity * 8000
  filter.Q.value = 2.5

  // Light gain boost
  const gain = audioCtx.createGain()
  gain.gain.value = 0.4

  const source = audioCtx.createBufferSource()
  source.buffer = buffer
  source.connect(filter)
  filter.connect(gain)
  gain.connect(audioCtx.destination)
  source.start()
}
