import { motion } from 'framer-motion'

/**
 * AppHomeIcon — the app icon pinned to the top-left of the screen, acting as a
 * global "start over" control. Rendered ONCE in App.tsx as a fixed overlay
 * (not per-screen) so there's a single source of truth and a single confirm
 * wiring. The parent decides when it's shown and what tapping does (on most
 * screens it opens the reset-confirmation dialog; on the completion screen it
 * starts fresh directly).
 *
 * Safe-area aware (mirrors the env(safe-area-inset-*) pattern used elsewhere)
 * so it clears the iOS notch/status bar in standalone/home-screen mode.
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
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
        left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
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
        // Above page content, below the confirm modal (9000) and the edit
        // sheet / its overlay (50/51) so it can't be tapped through them.
        zIndex: 45,
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
