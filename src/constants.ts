// Task constraints
export const MAX_TASKS = 15
export const MAX_TASK_LENGTH = 80
export const MAX_TASK_DISPLAY_LENGTH = 12 // chars on wheel slice before truncation

// Physics
export const WHEEL_FRICTION = 0.025      // velocity decay per frame
export const MIN_VELOCITY = 0.0005       // rad/ms -- stop threshold
export const MAX_SPIN_MS = 5000          // hard cap
export const MIN_SWIPE_VELOCITY = 0.002  // minimum useful swipe speed
export const MAX_SWIPE_VELOCITY = 0.015  // cap so it doesn't fly off

// Audio
export const TICK_BUFFER_DURATION = 0.008 // seconds -- 8ms noise burst
export const TICK_BASE_FREQUENCY = 800    // Hz bandpass center
export const TICK_Q = 3                   // bandpass Q factor

// Wheel colors -- OKLCH, vibrant, distinct
export const WHEEL_COLORS = [
  'oklch(72% 0.2 30)',   // warm orange-red
  'oklch(78% 0.18 60)',  // amber
  'oklch(82% 0.16 100)', // yellow-green
  'oklch(75% 0.2 145)',  // green
  'oklch(70% 0.22 200)', // teal
  'oklch(68% 0.24 260)', // blue
  'oklch(72% 0.22 300)', // purple
  'oklch(76% 0.2 340)',  // pink
]

// Design tokens (from DESIGN.md)
export const COLORS = {
  base: 'oklch(12% 0.02 260)',
  surface: 'oklch(18% 0.025 260)',
  surface2: 'oklch(22% 0.025 260)',
  ink: 'oklch(95% 0.01 260)',
  inkMuted: 'oklch(60% 0.02 260)',
  border: 'oklch(28% 0.025 260)',
  accent: 'oklch(72% 0.2 30)',
  accentGlow: 'oklch(72% 0.25 30)',
  success: 'oklch(75% 0.18 145)',
}

// Motivational messages -- {n} replaced with completed task count
export const MOTIVATIONAL_MESSAGES = [
  "You finished {n} tasks. Your future self is already grateful.",
  "That's {n} things off the list. ADHD tried to stop you. It didn't.",
  "{n} tasks crushed. The wheel spun, you showed up. That's the whole game.",
  "Done: {n}. The hardest part was starting. You started {n} times.",
  "You turned chaos into {n} completed things. That's actually impressive.",
  "{n} for {n}. Not bad for a brain that didn't want to start.",
  "Today's score: You {n}, Task Paralysis 0.",
  "{n} wins. Stack them up. They add up faster than you think.",
  "Look at that. {n} things that existed only as anxiety.. now done.",
  "The wheel picked, you delivered. {n} tasks. Clean sweep.",
  "{n} tasks down. You gave your brain a win. Give it another tomorrow.",
  "Spun the wheel. Did the thing. {n} times. That's a good day.",
]
