import { createServer } from 'node:http'

type Classification = 'APROVAR' | 'REVISAR' | 'RECUSAR'

type DemoProfile = {
  supplier: string
  segment: string
  signal: string
  classification: Classification
}

const demoProfiles: DemoProfile[] = [
  {
    supplier: 'Fornecedor modelo A',
    segment: 'Grãos · demonstração',
    signal: 'Sinal ilustrativo: baixo',
    classification: 'APROVAR',
  },
  {
    supplier: 'Fornecedor modelo B',
    segment: 'Insumos · demonstração',
    signal: 'Sinal ilustrativo: atenção',
    classification: 'REVISAR',
  },
  {
    supplier: 'Fornecedor modelo C',
    segment: 'Logística · demonstração',
    signal: 'Sinal ilustrativo: alto',
    classification: 'RECUSAR',
  },
]

function sendJson(response: import('node:http').ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

async function readJson(request: import('node:http').IncomingMessage): Promise<unknown> {
  let body = ''
  for await (const chunk of request) {
    body += chunk.toString()
  }
  return JSON.parse(body)
}

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname

  if (request.method === 'GET' && path === '/api/health') {
    sendJson(response, 200, { status: 'ok', mode: 'local-demo' })
    return
  }

  if (request.method === 'POST' && path === '/api/mock-analysis') {
    let body: unknown
    try {
      body = await readJson(request)
    } catch {
      sendJson(response, 400, { error: 'O corpo da solicitação precisa ser JSON.' })
      return
    }

    const cnpjs =
      typeof body === 'object' && body !== null && 'cnpjs' in body
        ? (body as { cnpjs: unknown }).cnpjs
        : null

    if (!Array.isArray(cnpjs)) {
      sendJson(response, 400, { error: 'Envie uma lista de linhas para a demonstração.' })
      return
    }

    const entries = cnpjs
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)

    const results = entries.map((cnpj, index) => ({
      cnpj,
      ...demoProfiles[index % demoProfiles.length],
    }))

    sendJson(response, 200, { mode: 'mock', results })
    return
  }

  sendJson(response, 404, { error: 'Rota não encontrada.' })
})

const port = Number(process.env.PORT ?? 3001)
server.listen(port, '127.0.0.1', () => {
  console.log(`API de demonstração disponível em http://127.0.0.1:${port}`)
})