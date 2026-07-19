import { handle } from 'hono/vercel'
import { createApp } from '../server.js'

export const config = { maxDuration: 30 }

const app = createApp()
export default handle(app)
