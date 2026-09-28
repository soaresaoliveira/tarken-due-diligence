import { parse } from 'csv-parse'
import { Readable, Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { normalizeCnpj } from '../../shared/cnpj.js'

const MAX_CSV_RECORD_SIZE = 8 * 1024 * 1024

function strictUtf8Decoder() {
  const decoder = new TextDecoder('utf-8', { fatal: true })

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      try {
        callback(null, decoder.decode(chunk, { stream: true }))
      } catch (error) {
        callback(error instanceof Error ? error : new Error('Encoding UTF-8 inválido.'))
      }
    },
    flush(callback) {
      try {
        callback(null, decoder.decode())
      } catch (error) {
        callback(error instanceof Error ? error : new Error('Encoding UTF-8 inválido.'))
      }
    },
  })
}

export async function indexCnpjsFromCsv(
  source: Readable,
  cnpjColumn: string,
): Promise<Set<string>> {
  let header: string[] | undefined
  let cnpjIndex = -1
  const cnpjs = new Set<string>()
  const csvParser = parse({
    delimiter: ';',
    bom: true,
    skip_empty_lines: true,
    max_record_size: MAX_CSV_RECORD_SIZE,
  })
  const indexer = new Writable({
    objectMode: true,
    write(record: unknown, _encoding, callback) {
      if (!Array.isArray(record) || !record.every((field) => typeof field === 'string')) {
        callback(new Error('Registro CSV inválido.'))
        return
      }

      if (!header) {
        header = record as string[]
        cnpjIndex = header.findIndex((field) => field.trim() === cnpjColumn)
        if (cnpjIndex < 0) {
          callback(new Error(`Coluna de identificador ausente: ${cnpjColumn}.`))
          return
        }
        callback()
        return
      }

      if (record.length !== header.length) {
        callback(new Error('Quantidade de campos CSV diferente do cabeçalho.'))
        return
      }

      const cnpj = normalizeCnpj(record[cnpjIndex] as string)
      if (/^\d{14}$/.test(cnpj)) cnpjs.add(cnpj)
      callback()
    },
  })

  await pipeline(source, strictUtf8Decoder(), csvParser, indexer)

  if (!header) throw new Error('CSV vazio ou sem cabeçalho.')
  return cnpjs
}