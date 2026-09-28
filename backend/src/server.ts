import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { pathToFileURL } from 'node:url'
import { parseCnpjLines } from '../../shared/cnpj.js'
import {
  lookupBrasilApi,
  type ReceitaResult,
} from './brasilapi.js'
import { IbamaService, type IbamaResult } from './ibama.js'

export type ReceitaLookup = (cnpj: string) => Promise<ReceitaResult>
export type IbamaLookup = (cnpjs: string[]) => Promise<IbamaResult[]>

const defaultIbamaService = new IbamaService()

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let body = ''
  for await (const chunk of request) {
    body += chunk.toString()
  }
  return JSON.parse(body)
}

function errorResult(cnpj: string): ReceitaResult {
  return {
    cnpj,
    razao_social: null,
    situacao_cadastral: null,
    data_abertura: null,
    cnae: null,
    endereco: null,
    telefone: null,
    status: 'ERROR',
    error: 'Falha inesperada durante a consulta à BrasilAPI.',
  }
}

export function createApiServer(
  receitaLookup: ReceitaLookup = lookupBrasilApi,
  ibamaLookup: IbamaLookup = (cnpjs) => defaultIbamaService.lookup(cnpjs),
) {
  return createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname

    if (request.method === 'GET' && path === '/api/health') {
      sendJson(response, 200, { status: 'ok' })
      return
    }

    if (request.method === 'POST' && path === '/api/receita/cnpjs') {
      let body: unknown
      try {
        body = await readJson(request)
      } catch {
        sendJson(response, 400, { error: 'O corpo da solicitação precisa ser JSON válido.' })
        return
      }

      const cnpjs =
        typeof body === 'object' && body !== null && 'cnpjs' in body
          ? (body as { cnpjs: unknown }).cnpjs
          : null

      if (!Array.isArray(cnpjs) || !cnpjs.every((cnpj) => typeof cnpj === 'string')) {
        sendJson(response, 400, { error: 'Envie uma lista de CNPJs em formato texto.' })
        return
      }

      const batch = parseCnpjLines(cnpjs.join('\n'))
      const results: ReceitaResult[] = []

      // Consultas sequenciais mantêm previsível a carga sobre a API pública.
      for (const entry of batch.valid) {
        try {
          results.push(await receitaLookup(entry.cnpj))
        } catch {
          results.push(errorResult(entry.cnpj))
        }
      }

      sendJson(response, 200, {
        results,
        invalid: batch.invalid,
        duplicates: batch.duplicates,
      })
      return
    }

    if (request.method === 'POST' && path === '/api/ibama/cnpjs') {
      let body: unknown
      try {
        body = await readJson(request)
      } catch {
        sendJson(response, 400, { error: 'O corpo da solicitação precisa ser JSON válido.' })
        return
      }

      const cnpjs =
        typeof body === 'object' && body !== null && 'cnpjs' in body
          ? (body as { cnpjs: unknown }).cnpjs
          : null

      if (!Array.isArray(cnpjs) || !cnpjs.every((cnpj) => typeof cnpj === 'string')) {
        sendJson(response, 400, { error: 'Envie uma lista de CNPJs em formato texto.' })
        return
      }

      const batch = parseCnpjLines(cnpjs.join('\n'))
      try {
        const results = batch.valid.length > 0
          ? await ibamaLookup(batch.valid.map((entry) => entry.cnpj))
          : []
        sendJson(response, 200, {
          results,
          invalid: batch.invalid,
          duplicates: batch.duplicates,
        })
      } catch {
        sendJson(response, 500, { error: 'Falha ao processar as fontes IBAMA.' })
      }
      return
    }

    sendJson(response, 404, { error: 'Rota não encontrada.' })
  })
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  const port = Number(process.env.PORT ?? 3001)
  createApiServer().listen(port, '127.0.0.1', () => {
    console.log(`API local disponível em http://127.0.0.1:${port}`)
  })
}