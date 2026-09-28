import type { ReceitaResult, ReceitaStatus } from './brasilapi.js'
import type { IbamaEvidence, IbamaResult } from './ibama.js'
import { classifyRisk } from './risk-engine.js'

export type ConsolidatedResult = Omit<ReceitaResult, 'status'> & Omit<IbamaResult, 'cnpj'> & {
  status_receita: ReceitaStatus
  tem_embargo_ibama: IbamaEvidence
  classificacao_risco: 'APROVAR' | 'REVISAR' | 'RECUSAR'
  motivo_classificacao: string
  data_consulta: string
}

export function mergeResults(
  cnpjs: string[],
  receitaResults: ReceitaResult[],
  ibamaResults: IbamaResult[],
  dataConsulta = new Date().toISOString(),
): ConsolidatedResult[] {
  const receitaByCnpj = new Map(receitaResults.map((result) => [result.cnpj, result]))
  const ibamaByCnpj = new Map(ibamaResults.map((result) => [result.cnpj, result]))

  return cnpjs.map((cnpj) => {
    const receita = receitaByCnpj.get(cnpj)
    const ibama = ibamaByCnpj.get(cnpj)
    if (!receita || !ibama) {
      throw new Error(`Resultado de fonte ausente para o CNPJ ${cnpj}.`)
    }

    const { status: status_receita, ...receitaData } = receita
    const tem_embargo_ibama = ibama.ibama_embargo
    const decision = classifyRisk({
      cnpj,
      status_receita,
      situacao_cadastral: receita.situacao_cadastral,
      status_ibama_embargo: ibama.status_ibama_embargo,
      ibama_embargo: tem_embargo_ibama,
    })

    return {
      ...receitaData,
      ...ibama,
      status_receita,
      tem_embargo_ibama,
      ...decision,
      data_consulta: dataConsulta,
    }
  })
}
