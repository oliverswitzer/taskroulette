import { motion } from 'framer-motion'

const SKELETON_WIDTHS = ['72%', '55%', '83%', '61%']
const SKELETON_MESSAGES = [
  'Sorting through the chaos..',
  'Finding your tasks..',
  'Untangling the noise..',
]

export default function ParsingScreen() {
  const message = SKELETON_MESSAGES[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '32px 20px',
        boxSizing: 'border-box',
        maxWidth: 560,
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Heading */}
      <h1
        style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
          color: 'var(--color-ink)',
          marginBottom: 8,
        }}
      >
        {message}
      </h1>
      <p
        style={{
          fontSize: '1rem',
          lineHeight: 1.6,
          color: 'var(--color-ink-muted)',
          marginBottom: 40,
        }}
      >
        Give us a moment to find everything hiding in there.
      </p>

      {/* Skeleton rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {SKELETON_WIDTHS.map((width, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.3,
              delay: i * 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <SkeletonRow width={width} delay={i * 0.15} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

function SkeletonRow({ width, delay }: { width: string; delay: number }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--rounded-md)',
        padding: '20px 20px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          width,
          height: 16,
          background: 'oklch(30% 0.03 260)',
          borderRadius: 'var(--rounded-full)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '60%',
            height: '100%',
            background:
              'linear-gradient(90deg, transparent 0%, oklch(55% 0.03 260 / 0.7) 50%, transparent 100%)',
          }}
          animate={{ x: ['-100%', '260%'] }}
          transition={{
            duration: 1.4,
            delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>
    </div>
  )
}
