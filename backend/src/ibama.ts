import * as unzipper from 'unzipper'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { normalizeCnpj, validateNormalizedCnpj } from '../../shared/cnpj.js'
import { indexCnpjsFromCsv } from './ibama-csv.js'

export const IBAMA_SOURCE_URLS = {
  autos: 'https://stibamadadosabertosprd.blob.core.windows.net/dados-abertos/dados/SIFISC/auto_infracao/auto_infracao/auto_infracao_csv.zip',
  embargos: 'https://servicos.ibama.gov.br/ctf/publico/areasembargadas/arquivos/areas_embargadas.csv',
} as const

export type IbamaSourceStatus = 'SUCCESS' | 'ERROR'
export type IbamaEvidence = 'SIM' | 'NÃO' | 'NA'

export type IbamaSourceFinding = {
  status: IbamaSourceStatus
  result: IbamaEvidence
  error?: string
}

export type IbamaResult = {
  cnpj: string
  ibama_auto_infracao: IbamaEvidence
  status_ibama_auto: IbamaSourceStatus
  error_ibama_auto?: string
  ibama_embargo: IbamaEvidence
  status_ibama_embargo: IbamaSourceStatus
  error_ibama_embargo?: string
  resultado_ambiental: IbamaEvidence
}

export type IbamaZipEntry = {
  path: string
  type: string
  stream: Readable
  drain: () => Promise<void>
}

export type IbamaZipReader = (source: Readable) => AsyncIterable<IbamaZipEntry>

type DatasetKind = keyof typeof IBAMA_SOURCE_URLS

type SourceIndex = {
  status: IbamaSourceStatus
  cnpjs: Set<string>
  error?: string
}

type CacheEntry = {
  expiresAt: number
  promise: Promise<SourceIndex>
}

type IbamaServiceOptions = {
  fetchImpl?: typeof fetch
  zipReader?: IbamaZipReader
  timeoutMs?: number
  successCacheTtlMs?: number
  errorCacheTtlMs?: number
  now?: () => number
}

const DOWNLOAD_TIMEOUT_MS = 120_000
const SUCCESS_CACHE_TTL_MS = 15 * 60_000
const ERROR_CACHE_TTL_MS = 30_000

async function* readZipEntries(source: Readable): AsyncIterable<IbamaZipEntry> {
  const archive = source.pipe(unzipper.Parse({ forceStream: true }))

  for await (const entry of archive) {
    yield {
      path: entry.path,
      type: entry.type,
      stream: entry,
      drain: async () => {
        await entry.autodrain().promise()
      },
    }
  }
}

export function consolidateEnvironmentalResult(
  autos: IbamaSourceFinding,
  embargo: IbamaSourceFinding,
): IbamaEvidence {
  if (
    (autos.status === 'SUCCESS' && autos.result === 'SIM') ||
    (embargo.status === 'SUCCESS' && embargo.result === 'SIM')
  ) {
    return 'SIM'
  }

  if (
    (autos.status === 'SUCCESS' && autos.result === 'NÃO') ||
    (embargo.status === 'SUCCESS' && embargo.result === 'NÃO')
  ) {
    return 'NÃO'
  }

  return 'NA'
}

export class IbamaService {
  private readonly fetchImpl: typeof fetch
  private readonly zipReader: IbamaZipReader
  private readonly timeoutMs: number
  private readonly successCacheTtlMs: number
  private readonly errorCacheTtlMs: number
  private readonly now: () => number
  private readonly cache = new Map<DatasetKind, CacheEntry>()

  constructor(options: IbamaServiceOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.zipReader = options.zipReader ?? readZipEntries
    this.timeoutMs = options.timeoutMs ?? DOWNLOAD_TIMEOUT_MS
    this.successCacheTtlMs = options.successCacheTtlMs ?? SUCCESS_CACHE_TTL_MS
    this.errorCacheTtlMs = options.errorCacheTtlMs ?? ERROR_CACHE_TTL_MS
    this.now = options.now ?? Date.now
  }

  async lookup(inputCnpjs: string[]): Promise<IbamaResult[]> {
    if (inputCnpjs.length === 0) return []

    const cnpjs = [...new Set(inputCnpjs.map(normalizeCnpj))]
    const invalid = cnpjs.find((cnpj) => validateNormalizedCnpj(cnpj))
    if (invalid) throw new TypeError('IbamaService aceita somente CNPJs válidos e normalizados.')

    // Carrega uma fonte por vez para evitar picos simultâneos de rede e parsing.
    const autos = await this.getIndex('autos')
    const embargos = await this.getIndex('embargos')

    return cnpjs.map((cnpj) => {
      const autoFinding = this.find(autos, cnpj)
      const embargoFinding = this.find(embargos, cnpj)

      return {
        cnpj,
        ibama_auto_infracao: autoFinding.result,
        status_ibama_auto: autoFinding.status,
        ...(autoFinding.error ? { error_ibama_auto: autoFinding.error } : {}),
        ibama_embargo: embargoFinding.result,
        status_ibama_embargo: embargoFinding.status,
        ...(embargoFinding.error ? { error_ibama_embargo: embargoFinding.error } : {}),
        resultado_ambiental: consolidateEnvironmentalResult(autoFinding, embargoFinding),
      }
    })
  }

  private find(index: SourceIndex, cnpj: string): IbamaSourceFinding {
    if (index.status === 'ERROR') {
      return { status: 'ERROR', result: 'NA', error: index.error }
    }

    return {
      status: 'SUCCESS',
      result: index.cnpjs.has(cnpj) ? 'SIM' : 'NÃO',
    }
  }

  private getIndex(kind: DatasetKind): Promise<SourceIndex> {
    const current = this.cache.get(kind)
    if (current && current.expiresAt > this.now()) return current.promise

    const entry: CacheEntry = { expiresAt: Number.POSITIVE_INFINITY, promise: Promise.resolve({ status: 'ERROR', cnpjs: new Set() }) }
    entry.promise = this.loadIndex(kind).then((result) => {
      entry.expiresAt = this.now() +
        (result.status === 'SUCCESS' ? this.successCacheTtlMs : this.errorCacheTtlMs)
      return result
    })
    this.cache.set(kind, entry)
    return entry.promise
  }

  private async loadIndex(kind: DatasetKind): Promise<SourceIndex> {
    try {
      const response = await this.fetchImpl(IBAMA_SOURCE_URLS[kind], {
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (!response.ok) throw new Error(`Resposta HTTP ${response.status}.`)
      if (!response.body) throw new Error('Resposta sem corpo de arquivo.')

      const source = Readable.fromWeb(response.body as unknown as NodeReadableStream)
      const cnpjs = kind === 'autos'
        ? await this.indexAutosZip(source)
        : await indexCnpjsFromCsv(source, 'CPF_CNPJ_EMBARGADO')

      return { status: 'SUCCESS', cnpjs }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Erro desconhecido.'
      return {
        status: 'ERROR',
        cnpjs: new Set(),
        error: `Falha ao processar fonte ${kind}: ${detail}`,
      }
    }
  }

  private async indexAutosZip(source: Readable): Promise<Set<string>> {
    const cnpjs = new Set<string>()
    let csvFiles = 0

    for await (const entry of this.zipReader(source)) {
      if (entry.type !== 'File' || !entry.path.toLowerCase().endsWith('.csv')) {
        await entry.drain()
        continue
      }

      csvFiles += 1
      const fileCnpjs = await indexCnpjsFromCsv(entry.stream, 'CPF_CNPJ_INFRATOR')
      for (const cnpj of fileCnpjs) cnpjs.add(cnpj)
    }

    if (csvFiles === 0) throw new Error('ZIP não contém arquivos CSV.')
    return cnpjs
  }
}