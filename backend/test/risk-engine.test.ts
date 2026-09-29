import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classifyRisk,
  DEFAULT_RISK_CRITERIA,
  type RiskCriteria,
  type RiskInput,
} from '../src/risk-engine.ts'

const VALID_CNPJ = '11222333000181'

function activeInput(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    cnpj: VALID_CNPJ,
    status_receita: 'SUCCESS',
    situacao_cadastral: 'ATIVA',
    ibama_auto_infracao: 'NÃO',
    status_ibama_auto: 'SUCCESS',
    ibama_embargo: 'NÃO',
    status_ibama_embargo: 'SUCCESS',
    ...overrides,
  }
}

function criteria(overrides: Partial<RiskCriteria> = {}): RiskCriteria {
  return { ...DEFAULT_RISK_CRITERIA, ...overrides }
}

test('defaults habilitam recusas essenciais e revisão de Autos/Embargos', () => {
  assert.deepEqual(DEFAULT_RISK_CRITERIA, {
    rejectInvalidCnpj: true,
    rejectBaixada: true,
    rejectInapta: true,
    rejectReceitaNotFound: false,
    reviewIbamaAuto: true,
    reviewIbamaEmbargo: true,
    reviewUndetermined: false,
  })
})

test('CNPJ inválido habilitado resulta em RECUSAR', () => {
  assert.equal(classifyRisk({ cnpj: '11222333000182' }).classificacao_risco, 'RECUSAR')
})

test('CNPJ inválido desabilitado não é recusado por esse critério', () => {
  assert.equal(
    classifyRisk(
      activeInput({ cnpj: '11222333000182' }),
      criteria({ rejectInvalidCnpj: false }),
    ).classificacao_risco,
    'APROVAR',
  )
})

test('Receita NOT_FOUND só resulta em RECUSAR quando o critério está habilitado', () => {
  const input = activeInput({ status_receita: 'NOT_FOUND' })
  assert.equal(classifyRisk(input).classificacao_risco, 'APROVAR')
  assert.equal(
    classifyRisk(input, criteria({ rejectReceitaNotFound: true })).classificacao_risco,
    'RECUSAR',
  )
})

test('CNPJ estruturalmente válido com Receita SUCCESS e dados desconhecidos não vira NOT_FOUND', () => {
  const input = activeInput({ situacao_cadastral: null })
  const decision = classifyRisk(input, criteria({ rejectReceitaNotFound: true }))

  assert.equal(input.status_receita, 'SUCCESS')
  assert.notEqual(decision.classificacao_risco, 'RECUSAR')
})

test('situação BAIXADA com critério habilitado resulta em RECUSAR', () => {
  assert.equal(classifyRisk(activeInput({ situacao_cadastral: 'BAIXADA' })).classificacao_risco, 'RECUSAR')
})

test('situação INAPTA com critério habilitado resulta em RECUSAR', () => {
  assert.equal(classifyRisk(activeInput({ situacao_cadastral: 'INAPTA' })).classificacao_risco, 'RECUSAR')
})

test('Auto SIM habilitado resulta em REVISAR', () => {
  const input = activeInput({ ibama_auto_infracao: 'SIM' })
  assert.equal(classifyRisk(input).classificacao_risco, 'REVISAR')
  assert.match(classifyRisk(input).motivo_classificacao, /Auto de Infração IBAMA encontrado/)
})

test('NOT_FOUND desabilitado com Auto SIM resulta em REVISAR, não RECUSAR', () => {
  const decision = classifyRisk(
    activeInput({ status_receita: 'NOT_FOUND', ibama_auto_infracao: 'SIM' }),
    DEFAULT_RISK_CRITERIA,
  )

  assert.equal(decision.classificacao_risco, 'REVISAR')
})

test('NOT_FOUND habilitado prevalece sobre Auto SIM habilitado', () => {
  const decision = classifyRisk(
    activeInput({ status_receita: 'NOT_FOUND', ibama_auto_infracao: 'SIM' }),
    criteria({ rejectReceitaNotFound: true }),
  )

  assert.equal(decision.classificacao_risco, 'RECUSAR')
})

test('Auto SIM desabilitado não resulta em REVISAR por Autos', () => {
  assert.equal(
    classifyRisk(
      activeInput({ ibama_auto_infracao: 'SIM' }),
      criteria({ reviewIbamaAuto: false }),
    ).classificacao_risco,
    'APROVAR',
  )
})

test('Embargo SIM habilitado resulta em REVISAR', () => {
  assert.equal(classifyRisk(activeInput({ ibama_embargo: 'SIM' })).classificacao_risco, 'REVISAR')
})

test('Embargo SIM desabilitado não resulta em REVISAR por Embargos', () => {
  assert.equal(
    classifyRisk(
      activeInput({ ibama_embargo: 'SIM' }),
      criteria({ reviewIbamaEmbargo: false }),
    ).classificacao_risco,
    'APROVAR',
  )
})

test('Auto e Embargo SIM com ambos habilitados resultam em REVISAR', () => {
  const decision = classifyRisk(activeInput({
    ibama_auto_infracao: 'SIM',
    ibama_embargo: 'SIM',
  }))

  assert.equal(decision.classificacao_risco, 'REVISAR')
  assert.match(decision.motivo_classificacao, /Auto de Infração IBAMA encontrado/)
  assert.match(decision.motivo_classificacao, /Área Embargada IBAMA encontrada/)
})

test('RECUSAR prevalece quando um critério de revisão também é acionado', () => {
  assert.equal(
    classifyRisk(activeInput({
      cnpj: '11222333000182',
      ibama_auto_infracao: 'SIM',
      ibama_embargo: 'SIM',
    })).classificacao_risco,
    'RECUSAR',
  )
})

test('sem critério acionado, classifica como APROVAR', () => {
  assert.equal(classifyRisk(activeInput()).classificacao_risco, 'APROVAR')
})

test('NA fica distinto de NÃO e só revisa quando o critério está habilitado', () => {
  const input = activeInput({ ibama_embargo: 'NA', status_ibama_embargo: 'ERROR' })
  assert.equal(classifyRisk(input).classificacao_risco, 'APROVAR')
  const decision = classifyRisk(input, criteria({ reviewUndetermined: true }))
  assert.equal(decision.classificacao_risco, 'REVISAR')
  assert.match(decision.motivo_classificacao, /ERROR/)
})

test('ERROR continua distinto de NÃO quando o critério de indeterminação está habilitado', () => {
  const input = activeInput({
    ibama_auto_infracao: 'NA',
    status_ibama_auto: 'ERROR',
  })
  const decision = classifyRisk(input, criteria({ reviewUndetermined: true }))

  assert.equal(input.ibama_auto_infracao, 'NA')
  assert.equal(input.status_ibama_auto, 'ERROR')
  assert.equal(decision.classificacao_risco, 'REVISAR')
  assert.match(decision.motivo_classificacao, /IBAMA Autos retornou ERROR/)
})

test('critério para informação indeterminada revisa uma Receita ERROR sem convertê-la', () => {
  const input = activeInput({ status_receita: 'ERROR', situacao_cadastral: null })
  const decision = classifyRisk(input, criteria({ reviewUndetermined: true }))

  assert.equal(input.status_receita, 'ERROR')
  assert.equal(decision.classificacao_risco, 'REVISAR')
  assert.match(decision.motivo_classificacao, /Receita Federal retornou ERROR/)
})

test('toda decisão inclui um motivo', () => {
  const inputs = [
    { cnpj: '123' },
    activeInput(),
    activeInput({ ibama_auto_infracao: 'SIM' }),
  ]

  for (const input of inputs) assert.ok(classifyRisk(input).motivo_classificacao.length > 0)
})