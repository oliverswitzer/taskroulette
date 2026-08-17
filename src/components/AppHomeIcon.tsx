import { motion } from 'framer-motion'

/**
 * AppHomeIcon — the app logo, always rendered in AppLayout's top bar so it's
 * visible on every screen (previously it only mounted on screens that opted
 * into the "start over" affordance, leaving a blank reserved header on DUMP/
 * PARSING/ALL_DONE — see AppLayout.tsx).
 *
 * When `onActivate` is provided the logo doubles as a tappable "start over"
 * control (LIST_EDIT, WHEEL_IDLE, WHEEL_SPINNING, TASK_CARD). When omitted
 * it renders as plain, non-interactive branding (DUMP, PARSING, ALL_DONE —
 * screens where "start over" doesn't make sense).
 */
interface AppHomeIconProps {
  onActivate?: () => void
  /** Accessible label — varies by intent (reset vs. start fresh). */
  label?: string
}

export default function AppHomeIcon({ onActivate, label = 'Start over' }: AppHomeIconProps) {
  const interactive = !!onActivate

  const sharedStyle = {
    // 44px tap target with the glyph centered inside.
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    padding: 0,
    WebkitTapHighlightColor: 'transparent',
  } as const

  const icon = (
    <img
      src="/icon.svg"
      alt=""
      aria-hidden="true"
      width={34}
      height={34}
      style={{ display: 'block', pointerEvents: 'none' }}
    />
  )

  if (interactive) {
    return (
      <motion.button
        type="button"
        data-testid="app-home-icon"
        onClick={onActivate}
        aria-label={label}
        title={label}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.92 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ ...sharedStyle, cursor: 'pointer' }}
      >
        {icon}
      </motion.button>
    )
  }

  return (
    <motion.div
      data-testid="app-home-icon"
      aria-label="TaskRoulette"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{ ...sharedStyle, cursor: 'default' }}
    >
      {icon}
    </motion.div>
  )
}
