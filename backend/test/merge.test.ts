import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ReceitaResult, ReceitaStatus } from '../src/brasilapi.ts'
import type { IbamaEvidence, IbamaResult, IbamaSourceStatus } from '../src/ibama.ts'
import { mergeResults } from '../src/merge.ts'

const FIRST_CNPJ = '11222333000181'
const SECOND_CNPJ = '00000000000191'
const CONSULTED_AT = '2026-09-28T12:00:00.000Z'

function receitaResult(
  cnpj: string,
  status: ReceitaStatus = 'SUCCESS',
  situacao_cadastral: string | null = 'ATIVA',
): ReceitaResult {
  return {
    cnpj,
    razao_social: `Empresa ${cnpj}`,
    situacao_cadastral,
    data_abertura: '2000-01-02',
    cnae: { codigo: '1234567', descricao: 'Atividade de exemplo' },
    endereco: null,
    telefone: null,
    status,
  }
}

function ibamaResult(
  cnpj: string,
  options: {
    auto?: IbamaEvidence
    autoStatus?: IbamaSourceStatus
    embargo?: IbamaEvidence
    embargoStatus?: IbamaSourceStatus
    environmental?: IbamaEvidence
  } = {},
): IbamaResult {
  const auto = options.auto ?? 'NÃO'
  const autoStatus = options.autoStatus ?? 'SUCCESS'
  const embargo = options.embargo ?? 'NÃO'
  const embargoStatus = options.embargoStatus ?? 'SUCCESS'

  return {
    cnpj,
    ibama_auto_infracao: auto,
    status_ibama_auto: autoStatus,
    ...(autoStatus === 'ERROR' ? { error_ibama_auto: 'Autos indisponível.' } : {}),
    ibama_embargo: embargo,
    status_ibama_embargo: embargoStatus,
    ...(embargoStatus === 'ERROR' ? { error_ibama_embargo: 'Embargos indisponível.' } : {}),
    resultado_ambiental: options.environmental ?? (auto === 'SIM' || embargo === 'SIM' ? 'SIM' : 'NÃO'),
  }
}

test('faz merge por CNPJ, preserva campos das fontes e a ordem solicitada', () => {
  const results = mergeResults(
    [FIRST_CNPJ, SECOND_CNPJ],
    [receitaResult(SECOND_CNPJ), receitaResult(FIRST_CNPJ)],
    [ibamaResult(FIRST_CNPJ, { embargo: 'SIM' }), ibamaResult(SECOND_CNPJ)],
    CONSULTED_AT,
  )

  assert.deepEqual(results.map((result) => result.cnpj), [FIRST_CNPJ, SECOND_CNPJ])
  assert.equal(results[0]?.razao_social, `Empresa ${FIRST_CNPJ}`)
  assert.equal(results[0]?.ibama_embargo, 'SIM')
  assert.equal(results[0]?.tem_embargo_ibama, 'SIM')
  assert.equal(results[0]?.classificacao_risco, 'REVISAR')
  assert.equal(results[1]?.tem_embargo_ibama, 'NÃO')
  assert.equal(results[1]?.classificacao_risco, 'APROVAR')
  assert.ok(results.every((result) => result.data_consulta === CONSULTED_AT))
})

test('Autos ERROR com Embargos NÃO preserva ERROR, consolida NÃO e permite APROVAR', () => {
  const [result] = mergeResults(
    [FIRST_CNPJ],
    [receitaResult(FIRST_CNPJ)],
    [ibamaResult(FIRST_CNPJ, {
      auto: 'NA',
      autoStatus: 'ERROR',
      embargo: 'NÃO',
      environmental: 'NÃO',
    })],
    CONSULTED_AT,
  )

  assert.equal(result?.status_ibama_auto, 'ERROR')
  assert.equal(result?.ibama_auto_infracao, 'NA')
  assert.equal(result?.status_ibama_embargo, 'SUCCESS')
  assert.equal(result?.ibama_embargo, 'NÃO')
  assert.equal(result?.resultado_ambiental, 'NÃO')
  assert.equal(result?.tem_embargo_ibama, 'NÃO')
  assert.equal(result?.classificacao_risco, 'APROVAR')
})

test('ambos os erros IBAMA preservam NA e levam a REVISAR', () => {
  const [result] = mergeResults(
    [FIRST_CNPJ],
    [receitaResult(FIRST_CNPJ)],
    [ibamaResult(FIRST_CNPJ, {
      auto: 'NA',
      autoStatus: 'ERROR',
      embargo: 'NA',
      embargoStatus: 'ERROR',
      environmental: 'NA',
    })],
    CONSULTED_AT,
  )

  assert.equal(result?.status_ibama_auto, 'ERROR')
  assert.equal(result?.ibama_auto_infracao, 'NA')
  assert.equal(result?.status_ibama_embargo, 'ERROR')
  assert.equal(result?.ibama_embargo, 'NA')
  assert.equal(result?.resultado_ambiental, 'NA')
  assert.equal(result?.tem_embargo_ibama, 'NA')
  assert.equal(result?.classificacao_risco, 'REVISAR')
})

test('Receita NOT_FOUND é mantido e classificado como RECUSAR', () => {
  const [result] = mergeResults(
    [FIRST_CNPJ],
    [receitaResult(FIRST_CNPJ, 'NOT_FOUND', null)],
    [ibamaResult(FIRST_CNPJ)],
    CONSULTED_AT,
  )

  assert.equal(result?.status_receita, 'NOT_FOUND')
  assert.equal(result?.classificacao_risco, 'RECUSAR')
  assert.ok(result?.motivo_classificacao)
})

test('falha se faltar um resultado de fonte em vez de inventar seu status', () => {
  assert.throws(
    () => mergeResults([FIRST_CNPJ], [receitaResult(FIRST_CNPJ)], [], CONSULTED_AT),
    /Resultado de fonte ausente/,
  )
})
