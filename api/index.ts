import type { IncomingMessage, ServerResponse } from 'node:http'
import { createApp } from '../server.js'

export const config = { maxDuration: 30 }

const app = createApp()

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Collect body
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const bodyBuf = Buffer.concat(chunks)

  // Build a Web Request from the Node IncomingMessage
  const host = (req.headers.host ?? 'localhost') as string
  const url = `https://${host}${req.url ?? '/'}`

  const webReq = new Request(url, {
    method: req.method ?? 'GET',
    headers: req.headers as Record<string, string>,
    body: bodyBuf.length > 0 ? bodyBuf : undefined,
  })

  // Call Hono
  const webRes = await app.fetch(webReq)

  // Write response back
  res.statusCode = webRes.status
  for (const [key, val] of webRes.headers.entries()) {
    res.setHeader(key, val)
  }
  const buf = Buffer.from(await webRes.arrayBuffer())
  res.end(buf)
}
