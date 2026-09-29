import { validateNormalizedCnpj } from './cnpj.js'

export type RiskClassification = 'APROVAR' | 'REVISAR' | 'RECUSAR'
export type RiskEvidence = 'SIM' | 'NÃO' | 'NA'
export type RiskSourceStatus = 'SUCCESS' | 'ERROR'
export type RiskReceitaStatus = 'SUCCESS' | 'ERROR' | 'NOT_FOUND'

export type RiskCriteria = {
  rejectInvalidCnpj: boolean
  rejectBaixada: boolean
  rejectInapta: boolean
  rejectReceitaNotFound: boolean
  reviewIbamaAuto: boolean
  reviewIbamaEmbargo: boolean
  reviewUndetermined: boolean
}

export type RiskInput = {
  cnpj: string
  status_receita?: RiskReceitaStatus
  situacao_cadastral?: string | null
  ibama_auto_infracao?: RiskEvidence
  status_ibama_auto?: RiskSourceStatus
  ibama_embargo?: RiskEvidence
  status_ibama_embargo?: RiskSourceStatus
}

export type RiskDecision = {
  classificacao_risco: RiskClassification
  motivo_classificacao: string
}

export const DEFAULT_RISK_CRITERIA: RiskCriteria = {
  rejectInvalidCnpj: true,
  rejectBaixada: true,
  rejectInapta: true,
  rejectReceitaNotFound: false,
  reviewIbamaAuto: true,
  reviewIbamaEmbargo: true,
  reviewUndetermined: false,
}

const RISK_CRITERIA_KEYS: (keyof RiskCriteria)[] = [
  'rejectInvalidCnpj',
  'rejectBaixada',
  'rejectInapta',
  'rejectReceitaNotFound',
  'reviewIbamaAuto',
  'reviewIbamaEmbargo',
  'reviewUndetermined',
]

export function isRiskCriteria(value: unknown): value is RiskCriteria {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return RISK_CRITERIA_KEYS.every((key) => typeof record[key] === 'boolean')
}

export function classifyRiskWithCriteria(
  input: RiskInput,
  criteria: RiskCriteria = DEFAULT_RISK_CRITERIA,
): RiskDecision {
  const refusalReasons: string[] = []
  const cnpjError = validateNormalizedCnpj(input.cnpj)

  if (criteria.rejectInvalidCnpj && cnpjError) {
    refusalReasons.push('CNPJ inválido.')
  }
  if (criteria.rejectReceitaNotFound && input.status_receita === 'NOT_FOUND') {
    refusalReasons.push('Empresa não encontrada na Receita Federal.')
  }

  const situation = input.situacao_cadastral?.trim().toUpperCase()
  if (criteria.rejectBaixada && situation === 'BAIXADA') {
    refusalReasons.push('Empresa com situação cadastral BAIXADA na Receita Federal.')
  }
  if (criteria.rejectInapta && situation === 'INAPTA') {
    refusalReasons.push('Empresa com situação cadastral INAPTA na Receita Federal.')
  }

  if (refusalReasons.length > 0) {
    return {
      classificacao_risco: 'RECUSAR',
      motivo_classificacao: refusalReasons.join(' '),
    }
  }

  const reviewReasons: string[] = []
  if (criteria.reviewIbamaAuto && input.status_ibama_auto === 'SUCCESS' && input.ibama_auto_infracao === 'SIM') {
    reviewReasons.push('Auto de Infração IBAMA encontrado.')
  }
  if (criteria.reviewIbamaEmbargo && input.status_ibama_embargo === 'SUCCESS' && input.ibama_embargo === 'SIM') {
    reviewReasons.push('Área Embargada IBAMA encontrada.')
  }

  if (criteria.reviewUndetermined) {
    if (input.status_receita === 'ERROR' || input.status_receita === undefined) {
      reviewReasons.push(input.status_receita === 'ERROR'
        ? 'Consulta à Receita Federal retornou ERROR.'
        : 'Consulta à Receita Federal não foi determinada (NA).')
    }
    if (input.status_receita === 'SUCCESS' && !input.situacao_cadastral?.trim()) {
      reviewReasons.push('Situação cadastral da Receita Federal não foi determinada (NA).')
    }
    if (input.status_ibama_auto !== 'SUCCESS' || input.ibama_auto_infracao === 'NA') {
      reviewReasons.push(input.status_ibama_auto === 'ERROR'
        ? 'Consulta ao IBAMA Autos retornou ERROR.'
        : 'Resultado do IBAMA Autos não foi determinado (NA).')
    }
    if (input.status_ibama_embargo !== 'SUCCESS' || input.ibama_embargo === 'NA') {
      reviewReasons.push(input.status_ibama_embargo === 'ERROR'
        ? 'Consulta ao IBAMA Embargos retornou ERROR.'
        : 'Resultado do IBAMA Embargos não foi determinado (NA).')
    }
  }

  if (reviewReasons.length > 0) {
    return {
      classificacao_risco: 'REVISAR',
      motivo_classificacao: reviewReasons.join(' '),
    }
  }

  return {
    classificacao_risco: 'APROVAR',
    motivo_classificacao: 'Nenhum critério configurado de RECUSAR ou REVISAR foi acionado.',
  }
}