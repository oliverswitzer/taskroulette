// Vercel Edge Middleware — Basic Auth gate for the entire site.
// Works with any framework on Vercel (not Next.js specific).
// Runs at the edge before static assets and API functions are served.

import { next } from '@vercel/edge'

const USERNAME = 'adhd'
const PASSWORD = 'builds'
const VALID_TOKEN = `Basic ${btoa(`${USERNAME}:${PASSWORD}`)}`

export default function middleware(req: Request): Response {
  const auth = req.headers.get('authorization')

  if (auth === VALID_TOKEN) return next()

  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="TaskRoulette", charset="UTF-8"',
    },
  })
}

export const config = {
  matcher: '/(.*)',
}
