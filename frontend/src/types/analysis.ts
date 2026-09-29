import type { CnpjEntry } from '../utils/cnpj.ts'

export type Evidence = 'SIM' | 'NÃO' | 'NA'
export type ReceitaStatus = 'SUCCESS' | 'ERROR' | 'NOT_FOUND'
export type IbamaStatus = 'SUCCESS' | 'ERROR'
export type RiskClassification = 'APROVAR' | 'REVISAR' | 'RECUSAR'

export type ConsolidatedResult = {
  cnpj: string
  razao_social: string | null
  situacao_cadastral: string | null
  data_abertura: string | null
  cnae: { codigo: string | null; descricao: string | null } | null
  endereco: {
    cep: string | null
    logradouro: string | null
    numero: string | null
    complemento: string | null
    bairro: string | null
    municipio: string | null
    uf: string | null
  } | null
  telefone: string | null
  status_receita: ReceitaStatus
  error?: string
  ibama_auto_infracao: Evidence
  status_ibama_auto: IbamaStatus
  error_ibama_auto?: string
  ibama_embargo: Evidence
  status_ibama_embargo: IbamaStatus
  error_ibama_embargo?: string
  resultado_ambiental: Evidence
  tem_embargo_ibama: Evidence
  classificacao_risco: RiskClassification
  motivo_classificacao: string
  data_consulta: string
}

export type InvalidResult = CnpjEntry & {
  classificacao_risco: RiskClassification
  motivo_classificacao: string
}

export type AnalysisResponse = {
  results: ConsolidatedResult[]
  invalid: InvalidResult[]
  duplicates: CnpjEntry[]
  error?: string
}

export type SupplierRow = {
  key: string
  input: CnpjEntry
  classificacao_risco: RiskClassification
  motivo_classificacao: string
  result?: ConsolidatedResult
  invalid?: InvalidResult
}

export type RiskFilter = 'TODOS' | RiskClassification

export type AnalysisSummary = {
  total: number
  aprovar: number
  revisar: number
  recusar: number
  duplicados: number
}