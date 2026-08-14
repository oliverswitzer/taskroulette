import { useState } from 'react'
import { motion } from 'framer-motion'
import BrainDumpForm from './BrainDumpForm'

interface DumpScreenProps {
  onSubmit: (dump: string, photo?: File) => void
  error?: string
  photoFile: File | null
  onPhotoChange: (file: File | null) => void
}

export default function DumpScreen({ onSubmit, error, photoFile, onPhotoChange }: DumpScreenProps) {
  // Bumped after a successful parse to clear the shared form. DUMP unmounts on
  // success anyway, so this stays 0 here — no explicit reset needed.
  const [resetSignal] = useState(0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '32px 20px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: '100%', maxWidth: 600 }}>
        {/* Wordmark */}
        <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-accent)', opacity: 0.7, textTransform: 'uppercase', marginBottom: '32px' }}>
          TaskRoulette
        </div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: 'clamp(1.5rem, 4vw, 2rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
            marginBottom: 12,
            textWrap: 'balance',
          } as React.CSSProperties}
        >
          What&apos;s swirling around in your head?
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: '1.0625rem',
            lineHeight: 1.6,
            color: 'var(--color-ink-muted)',
            marginBottom: 32,
            maxWidth: '50ch',
          }}
        >
          No lists, no formats, no pressure. Just let it all out. We&apos;ll sort it for you.
        </motion.p>

        {/* Shared brain-dump input surface */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <BrainDumpForm
            onSubmit={onSubmit}
            submitLabel="Parse my tasks &rarr;"
            error={error}
            photoFile={photoFile}
            onPhotoChange={onPhotoChange}
            enablePhotoOnboarding
            resetSignal={resetSignal}
          />
        </motion.div>
      </div>
    </motion.div>
  )
}
