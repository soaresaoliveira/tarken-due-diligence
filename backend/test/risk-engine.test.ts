import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyRisk, type RiskInput } from '../src/risk-engine.ts'

const VALID_CNPJ = '11222333000181'

function activeInput(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    cnpj: VALID_CNPJ,
    status_receita: 'SUCCESS',
    situacao_cadastral: 'ATIVA',
    status_ibama_embargo: 'SUCCESS',
    ibama_embargo: 'NÃO',
    ...overrides,
  }
}

test('CNPJ inválido é recusado sem exigir status de fontes não consultadas', () => {
  assert.deepEqual(classifyRisk({ cnpj: '11222333000182' }), {
    classificacao_risco: 'RECUSAR',
    motivo_classificacao: 'CNPJ inválido.',
  })
})

test('Receita NOT_FOUND resulta em RECUSAR', () => {
  assert.equal(classifyRisk(activeInput({ status_receita: 'NOT_FOUND' })).classificacao_risco, 'RECUSAR')
})

test('situação cadastral INAPTA resulta em RECUSAR', () => {
  assert.deepEqual(classifyRisk(activeInput({ situacao_cadastral: 'INAPTA' })), {
    classificacao_risco: 'RECUSAR',
    motivo_classificacao: 'Empresa com situação cadastral INAPTA na Receita Federal.',
  })
})

test('situação cadastral BAIXADA resulta em RECUSAR', () => {
  assert.deepEqual(classifyRisk(activeInput({ situacao_cadastral: 'BAIXADA' })), {
    classificacao_risco: 'RECUSAR',
    motivo_classificacao: 'Empresa com situação cadastral BAIXADA na Receita Federal.',
  })
})

test('Receita ERROR resulta em REVISAR, não em NOT_FOUND nem APROVAR', () => {
  assert.equal(classifyRisk(activeInput({ status_receita: 'ERROR' })).classificacao_risco, 'REVISAR')
})

test('empresa ATIVA com embargo confirmado resulta em REVISAR', () => {
  assert.deepEqual(classifyRisk(activeInput({ ibama_embargo: 'SIM' })), {
    classificacao_risco: 'REVISAR',
    motivo_classificacao: 'Empresa ATIVA, porém foi identificado registro de embargo no IBAMA.',
  })
})

test('empresa ATIVA com embargo NA resulta em REVISAR', () => {
  assert.equal(
    classifyRisk(activeInput({ status_ibama_embargo: 'ERROR', ibama_embargo: 'NA' })).classificacao_risco,
    'REVISAR',
  )
})

test('empresa ATIVA sem embargo confirmado resulta em APROVAR', () => {
  assert.deepEqual(classifyRisk(activeInput()), {
    classificacao_risco: 'APROVAR',
    motivo_classificacao:
      'Empresa ATIVA na Receita Federal, sem embargo identificado e com as fontes críticas consultadas com sucesso.',
  })
})

test('RECUSAR prevalece sobre embargo que levaria a REVISAR', () => {
  assert.equal(
    classifyRisk(activeInput({ situacao_cadastral: 'INAPTA', ibama_embargo: 'SIM' })).classificacao_risco,
    'RECUSAR',
  )
})

test('informação crítica não confirmada prevalece sobre uma possível aprovação', () => {
  assert.equal(
    classifyRisk(activeInput({ status_ibama_embargo: 'ERROR', ibama_embargo: 'NA' })).classificacao_risco,
    'REVISAR',
  )
})

test('toda decisão do Risk Engine inclui um motivo', () => {
  const inputs = [
    { cnpj: '123' },
    activeInput({ status_receita: 'NOT_FOUND' }),
    activeInput({ status_receita: 'ERROR' }),
    activeInput(),
  ]

  for (const input of inputs) {
    assert.ok(classifyRisk(input).motivo_classificacao.length > 0)
  }
})
