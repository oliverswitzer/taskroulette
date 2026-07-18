import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'

const HOSTNAME = 'clawlivers-mac-mini.tail60e2f.ts.net'
const certPath = path.resolve(__dirname, `${HOSTNAME}.crt`)
const keyPath = path.resolve(__dirname, `${HOSTNAME}.key`)
const hasLocalCert = fs.existsSync(certPath) && fs.existsSync(keyPath)

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'TaskRoulette',
        short_name: 'TaskRoulette',
        description: 'Spin the wheel. Do the thing. ADHD task paralysis breaker.',
        theme_color: '#1a0f0a',
        background_color: '#0d0d12',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [HOSTNAME],
    ...(hasLocalCert ? {
      https: {
        cert: certPath,
        key: keyPath,
      },
    } : {}),
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
