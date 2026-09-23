import { createServer } from 'node:http'

const port = Number(process.env.FITPRO_PIX_TUNNEL_PORT || 8450)
const upstream = 'http://127.0.0.1:54321'
const maxBodyBytes = 64 * 1024

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Porta do túnel Pix inválida.')
}

// Só o retorno OAuth e as notificações precisam chegar pela internet.
function allowedRequest(method, url, headers) {
  if (method === 'GET' && url.pathname === '/functions/v1/pix-connect') {
    return Boolean(url.searchParams.get('state') && (url.searchParams.get('code') || url.searchParams.get('error')))
  }
  if (method === 'POST' && url.pathname === '/functions/v1/pix-webhook') {
    return Boolean(url.searchParams.get('data.id') && headers['x-signature'] && headers['x-request-id'])
  }
  return false
}

async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBodyBytes) throw new Error('Notificação grande demais.')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${port}`)
  if (!allowedRequest(request.method, url, request.headers)) {
    response.writeHead(404).end()
    return
  }

  try {
    const headers = {}
    for (const name of ['content-type', 'x-signature', 'x-request-id']) {
      const value = request.headers[name]
      if (typeof value === 'string') headers[name] = value
    }
    const result = await fetch(`${upstream}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: request.method === 'POST' ? await readBody(request) : undefined,
      redirect: 'manual',
    })
    response.statusCode = result.status
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    for (const name of ['content-type', 'location']) {
      const value = result.headers.get(name)
      if (value) response.setHeader(name, value)
    }
    response.end(Buffer.from(await result.arrayBuffer()))
  } catch {
    response.writeHead(502).end('Serviço Pix local indisponível.')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Retorno Pix restrito em http://127.0.0.1:${port}`)
})
