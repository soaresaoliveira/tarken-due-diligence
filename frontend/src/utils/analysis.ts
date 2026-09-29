import type { CnpjBatch } from './cnpj.ts'
import type {
  AnalysisResponse,
  AnalysisSummary,
  RiskFilter,
  SupplierRow,
} from '../types/analysis.ts'
import { classifyRiskWithCriteria, type RiskCriteria } from '../../../shared/risk-engine.ts'

export function composeSupplierRows(
  batch: CnpjBatch,
  response: AnalysisResponse,
): SupplierRow[] {
  const resultsByCnpj = new Map(response.results.map((result) => [result.cnpj, result]))
  const invalidByCnpj = new Map(response.invalid.map((result) => [result.cnpj, result]))

  const rows: SupplierRow[] = []
  for (const [index, entry] of batch.entries.entries()) {
    if (entry.status === 'duplicate') continue

    if (entry.status === 'invalid') {
      const invalid = invalidByCnpj.get(entry.cnpj)
      if (!invalid) {
        throw new Error(`Classificação de CNPJ inválido ausente para a entrada ${index + 1}.`)
      }

      rows.push({
        key: `${entry.cnpj}-${index}`,
        input: entry,
        classificacao_risco: invalid.classificacao_risco,
        motivo_classificacao: invalid.motivo_classificacao,
        invalid,
      })
      continue
    }

    const result = resultsByCnpj.get(entry.cnpj)
    if (!result) {
      throw new Error(`Resultado consolidado ausente para a entrada ${index + 1}.`)
    }

    rows.push({
      key: `${entry.cnpj}-${index}`,
      input: entry,
      classificacao_risco: result.classificacao_risco,
      motivo_classificacao: result.motivo_classificacao,
      result,
    })
  }

  return rows
}

export function summarizeSupplierRows(
  rows: SupplierRow[],
  duplicates: number,
): AnalysisSummary {
  return rows.reduce<AnalysisSummary>((summary, row) => {
    summary.total += 1
    if (row.classificacao_risco === 'APROVAR') summary.aprovar += 1
    if (row.classificacao_risco === 'REVISAR') summary.revisar += 1
    if (row.classificacao_risco === 'RECUSAR') summary.recusar += 1
    summary.duplicados = duplicates
    return summary
  }, { total: 0, aprovar: 0, revisar: 0, recusar: 0, duplicados: duplicates })
}

export function filterSupplierRows(rows: SupplierRow[], filter: RiskFilter): SupplierRow[] {
  return filter === 'TODOS'
    ? rows
    : rows.filter((row) => row.classificacao_risco === filter)
}

export function reclassifySupplierRows(rows: SupplierRow[], criteria: RiskCriteria): SupplierRow[] {
  return rows.map((row) => {
    const result = row.result
    const decision = classifyRiskWithCriteria({
      cnpj: row.input.cnpj,
      ...(result ? {
        status_receita: result.status_receita,
        situacao_cadastral: result.situacao_cadastral,
        ibama_auto_infracao: result.ibama_auto_infracao,
        status_ibama_auto: result.status_ibama_auto,
        ibama_embargo: result.ibama_embargo,
        status_ibama_embargo: result.status_ibama_embargo,
      } : {}),
    }, criteria)

    return {
      ...row,
      ...decision,
      ...(result ? { result: { ...result, ...decision } } : {}),
      ...(row.invalid ? { invalid: { ...row.invalid, ...decision } } : {}),
    }
  })
}