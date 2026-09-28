import { validateNormalizedCnpj } from '../../shared/cnpj.js'
import type { IbamaEvidence, IbamaSourceStatus } from './ibama.js'
import type { ReceitaStatus } from './brasilapi.js'

export type RiskClassification = 'APROVAR' | 'REVISAR' | 'RECUSAR'

export type RiskDecision = {
  classificacao_risco: RiskClassification
  motivo_classificacao: string
}

export type RiskInput = {
  cnpj: string
  status_receita?: ReceitaStatus
  situacao_cadastral?: string | null
  ibama_embargo?: IbamaEvidence
  status_ibama_embargo?: IbamaSourceStatus
}

const REVIEW_REASON =
  'Não foi possível confirmar todas as informações críticas necessárias para aprovação.'

export function classifyRisk(input: RiskInput): RiskDecision {
  if (validateNormalizedCnpj(input.cnpj)) {
    return {
      classificacao_risco: 'RECUSAR',
      motivo_classificacao: 'CNPJ inválido.',
    }
  }

  if (input.status_receita === 'NOT_FOUND') {
    return {
      classificacao_risco: 'RECUSAR',
      motivo_classificacao: 'Empresa não encontrada na Receita Federal.',
    }
  }

  const situation = input.situacao_cadastral?.trim().toUpperCase()
  if (situation === 'INAPTA') {
    return {
      classificacao_risco: 'RECUSAR',
      motivo_classificacao: 'Empresa com situação cadastral INAPTA na Receita Federal.',
    }
  }

  if (situation === 'BAIXADA') {
    return {
      classificacao_risco: 'RECUSAR',
      motivo_classificacao: 'Empresa com situação cadastral BAIXADA na Receita Federal.',
    }
  }

  if (
    input.status_receita === 'SUCCESS' &&
    situation === 'ATIVA' &&
    input.status_ibama_embargo === 'SUCCESS' &&
    input.ibama_embargo === 'SIM'
  ) {
    return {
      classificacao_risco: 'REVISAR',
      motivo_classificacao: 'Empresa ATIVA, porém foi identificado registro de embargo no IBAMA.',
    }
  }

  if (
    input.status_receita !== 'SUCCESS' ||
    situation !== 'ATIVA' ||
    input.status_ibama_embargo !== 'SUCCESS' ||
    input.ibama_embargo !== 'NÃO'
  ) {
    return {
      classificacao_risco: 'REVISAR',
      motivo_classificacao: REVIEW_REASON,
    }
  }

  return {
    classificacao_risco: 'APROVAR',
    motivo_classificacao:
      'Empresa ATIVA na Receita Federal, sem embargo identificado e com as fontes críticas consultadas com sucesso.',
  }
}
