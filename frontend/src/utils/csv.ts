import type { CnpjEntry } from './cnpj.ts'
import type { SupplierRow } from '../types/analysis.ts'

export const CSV_HEADERS = [
  'cnpj',
  'cnpj_original',
  'validacao_cnpj',
  'motivo_validacao_cnpj',
  'duplicidades_descartadas',
  'razao_social',
  'situacao_cadastral',
  'data_abertura',
  'cnae_codigo',
  'cnae_descricao',
  'endereco_cep',
  'endereco_logradouro',
  'endereco_numero',
  'endereco_complemento',
  'endereco_bairro',
  'endereco_municipio',
  'endereco_uf',
  'telefone',
  'status_receita',
  'erro_receita',
  'ibama_auto_infracao',
  'status_ibama_auto',
  'erro_ibama_auto',
  'ibama_embargo',
  'status_ibama_embargo',
  'erro_ibama_embargo',
  'resultado_ambiental',
  'tem_embargo_ibama',
  'classificacao_risco',
  'motivo_classificacao',
  'data_consulta',
] as const

type CsvCell = string | number | null | undefined

function quoteCsvCell(value: CsvCell): string {
  const text = value == null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function countDuplicatesByCnpj(duplicates: CnpjEntry[]) {
  const counts = new Map<string, number>()
  for (const entry of duplicates) {
    counts.set(entry.cnpj, (counts.get(entry.cnpj) ?? 0) + 1)
  }
  return counts
}

export function serializeSupplierCsv(rows: SupplierRow[], duplicates: CnpjEntry[]): string {
  const duplicateCounts = countDuplicatesByCnpj(duplicates)
  const records = rows.map((row) => {
    const result = row.result
    const invalid = row.invalid
    if (!result && !invalid) {
      throw new Error(`Fornecedor sem resultado consolidado: ${row.input.cnpj}.`)
    }

    const address = result?.endereco
    return [
      row.input.cnpj,
      row.input.original,
      invalid ? 'INVÁLIDO' : 'VÁLIDO',
      invalid?.reason,
      duplicateCounts.get(row.input.cnpj) ?? 0,
      result?.razao_social,
      result?.situacao_cadastral,
      result?.data_abertura,
      result?.cnae?.codigo,
      result?.cnae?.descricao,
      address?.cep,
      address?.logradouro,
      address?.numero,
      address?.complemento,
      address?.bairro,
      address?.municipio,
      address?.uf,
      result?.telefone,
      result?.status_receita,
      result?.error,
      result?.ibama_auto_infracao,
      result?.status_ibama_auto,
      result?.error_ibama_auto,
      result?.ibama_embargo,
      result?.status_ibama_embargo,
      result?.error_ibama_embargo,
      result?.resultado_ambiental,
      result?.tem_embargo_ibama,
      row.classificacao_risco,
      row.motivo_classificacao,
      result?.data_consulta,
    ]
  })

  const lines = [
    CSV_HEADERS.map(quoteCsvCell).join(';'),
    ...records.map((record) => record.map(quoteCsvCell).join(';')),
  ]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function supplierCsvFilename(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `due-diligence-fornecedores-${year}-${month}-${day}.csv`
}