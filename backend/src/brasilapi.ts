import { validateNormalizedCnpj } from '../../shared/cnpj.js'

export type ReceitaStatus = 'SUCCESS' | 'ERROR' | 'NOT_FOUND'

export type ReceitaAddress = {
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  municipio: string | null
  uf: string | null
}

export type ReceitaResult = {
  cnpj: string
  razao_social: string | null
  situacao_cadastral: string | null
  data_abertura: string | null
  cnae: { codigo: string | null; descricao: string | null } | null
  endereco: ReceitaAddress | null
  telefone: string | null
  status: ReceitaStatus
  error?: string
}

type BrasilApiOptions = {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  retryDelayMs?: number
}

const REQUEST_TIMEOUT_MS = 8_000
const RETRY_DELAY_MS = 200
const MAX_ATTEMPTS = 2
const TRANSIENT_HTTP_STATUSES = new Set([408, 500, 502, 503, 504])

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function normalizeAddress(payload: Record<string, unknown>): ReceitaAddress | null {
  const address: ReceitaAddress = {
    cep: stringValue(payload.cep),
    logradouro: stringValue(payload.logradouro),
    numero: stringValue(payload.numero),
    complemento: stringValue(payload.complemento),
    bairro: stringValue(payload.bairro),
    municipio: stringValue(payload.municipio),
    uf: stringValue(payload.uf),
  }

  return Object.values(address).some(Boolean) ? address : null
}

function emptyResult(cnpj: string, status: ReceitaStatus, error?: string): ReceitaResult {
  return {
    cnpj,
    razao_social: null,
    situacao_cadastral: null,
    data_abertura: null,
    cnae: null,
    endereco: null,
    telefone: null,
    status,
    ...(error ? { error } : {}),
  }
}

function normalizePayload(cnpj: string, payload: Record<string, unknown>): ReceitaResult {
  const responseCnpj = stringValue(payload.cnpj)?.replace(/\D/g, '')
  if (responseCnpj && responseCnpj !== cnpj) {
    return emptyResult(cnpj, 'ERROR', 'A BrasilAPI retornou dados de outro CNPJ.')
  }

  const cnaeCode = stringValue(payload.cnae_fiscal)
  const cnaeDescription = stringValue(payload.cnae_fiscal_descricao)

  return {
    cnpj,
    razao_social: stringValue(payload.razao_social),
    situacao_cadastral:
      stringValue(payload.descricao_situacao_cadastral) ??
      stringValue(payload.situacao_cadastral),
    data_abertura:
      stringValue(payload.data_inicio_atividade) ?? stringValue(payload.data_abertura),
    cnae: cnaeCode || cnaeDescription
      ? { codigo: cnaeCode, descricao: cnaeDescription }
      : null,
    endereco: normalizeAddress(payload),
    telefone:
      stringValue(payload.ddd_telefone_1) ?? stringValue(payload.ddd_telefone_2),
    status: 'SUCCESS',
  }
}

function isRetryableNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false
  return error.name === 'TimeoutError' || error.name === 'AbortError' || error instanceof TypeError
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function lookupBrasilApi(
  cnpj: string,
  options: BrasilApiOptions = {},
): Promise<ReceitaResult> {
  const validationError = validateNormalizedCnpj(cnpj)
  if (validationError) {
    throw new TypeError(`CNPJ não validado: ${validationError}`)
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS
  const retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS
  const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`

  // No máximo uma repetição para falhas transitórias; 404 e rate limit não são repetidos.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response

    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
    } catch (error) {
      if (attempt < MAX_ATTEMPTS && isRetryableNetworkError(error)) {
        await wait(retryDelayMs)
        continue
      }

      const timedOut = error instanceof Error && error.name === 'TimeoutError'
      return emptyResult(
        cnpj,
        'ERROR',
        timedOut
          ? `A consulta à BrasilAPI excedeu o limite de ${timeoutMs} ms.`
          : 'Não foi possível conectar à BrasilAPI.',
      )
    }

    if (response.status === 404) {
      return emptyResult(cnpj, 'NOT_FOUND', 'CNPJ não encontrado na BrasilAPI.')
    }

    if (!response.ok) {
      if (attempt < MAX_ATTEMPTS && TRANSIENT_HTTP_STATUSES.has(response.status)) {
        await wait(retryDelayMs)
        continue
      }

      return emptyResult(cnpj, 'ERROR', `A BrasilAPI respondeu com HTTP ${response.status}.`)
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      return emptyResult(cnpj, 'ERROR', 'A BrasilAPI retornou JSON inválido.')
    }

    const payload = asRecord(body)
    if (!payload) {
      return emptyResult(cnpj, 'ERROR', 'A BrasilAPI retornou uma resposta inesperada.')
    }

    return normalizePayload(cnpj, payload)
  }

  return emptyResult(cnpj, 'ERROR', 'Não foi possível consultar a BrasilAPI.')
}