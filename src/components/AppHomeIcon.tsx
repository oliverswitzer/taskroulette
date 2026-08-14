import { motion } from 'framer-motion'

/**
 * AppHomeIcon — the app icon acting as a global "start over" control.
 * Rendered inside AppLayout's in-flow top bar (NOT position:fixed — a fixed
 * overlay stays glued to the viewport while page content scrolls underneath
 * it, which overlapped scrolled text). Sizing/placement is entirely owned by
 * the parent top bar; this component is just the tappable icon itself.
 */
interface AppHomeIconProps {
  onActivate: () => void
  /** Accessible label — varies by intent (reset vs. start fresh). */
  label?: string
}

export default function AppHomeIcon({ onActivate, label = 'Start over' }: AppHomeIconProps) {
  return (
    <motion.button
      type="button"
      data-testid="app-home-icon"
      onClick={onActivate}
      aria-label={label}
      title={label}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileTap={{ scale: 0.92 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        // 44px tap target with the glyph centered inside.
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <img
        src="/icon.svg"
        alt=""
        aria-hidden="true"
        width={34}
        height={34}
        style={{ display: 'block', pointerEvents: 'none' }}
      />
    </motion.button>
  )
}
