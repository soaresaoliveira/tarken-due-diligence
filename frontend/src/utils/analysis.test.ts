import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCnpjLines } from './cnpj.ts'
import {
  composeSupplierRows,
  filterSupplierRows,
  summarizeSupplierRows,
} from './analysis.ts'
import type { AnalysisResponse, ConsolidatedResult } from '../types/analysis.ts'

const APPROVE_CNPJ = '11222333000181'
const REVIEW_CNPJ = '00000000000191'
const INVALID_CNPJ = '11222333000182'

function consolidatedResult(
  cnpj: string,
  risk: ConsolidatedResult['classificacao_risco'],
): ConsolidatedResult {
  return {
    cnpj,
    razao_social: `Empresa ${cnpj}`,
    situacao_cadastral: 'ATIVA',
    data_abertura: null,
    cnae: null,
    endereco: null,
    telefone: null,
    status_receita: 'SUCCESS',
    ibama_auto_infracao: 'NÃO',
    status_ibama_auto: 'SUCCESS',
    ibama_embargo: 'NÃO',
    status_ibama_embargo: 'SUCCESS',
    resultado_ambiental: 'NÃO',
    tem_embargo_ibama: 'NÃO',
    classificacao_risco: risk,
    motivo_classificacao: `Motivo ${risk}`,
    data_consulta: '2026-09-28T12:00:00.000Z',
  }
}

function createResponse(): AnalysisResponse {
  return {
    results: [
      consolidatedResult(APPROVE_CNPJ, 'APROVAR'),
      consolidatedResult(REVIEW_CNPJ, 'REVISAR'),
    ],
    invalid: [{
      original: INVALID_CNPJ,
      cnpj: INVALID_CNPJ,
      status: 'invalid',
      reason: 'Dígito verificador inválido.',
      classificacao_risco: 'RECUSAR',
      motivo_classificacao: 'CNPJ inválido.',
    }],
    duplicates: [{
      original: `11.222.333/0001-81`,
      cnpj: APPROVE_CNPJ,
      status: 'duplicate',
      reason: 'CNPJ duplicado após a normalização.',
    }],
  }
}

test('compõe fornecedores na ordem de entrada e exclui duplicatas', () => {
  const batch = parseCnpjLines([
    APPROVE_CNPJ,
    '11.222.333/0001-81',
    REVIEW_CNPJ,
    INVALID_CNPJ,
  ].join('\n'))
  const rows = composeSupplierRows(batch, createResponse())

  assert.deepEqual(rows.map((row) => row.classificacao_risco), [
    'APROVAR',
    'REVISAR',
    'RECUSAR',
  ])
  assert.equal(rows.length, 3)
  assert.equal(rows[0]?.result?.cnpj, APPROVE_CNPJ)
  assert.equal(rows[2]?.invalid?.motivo_classificacao, 'CNPJ inválido.')
})

test('totais contam results + invalid e deixam duplicatas fora', () => {
  const batch = parseCnpjLines([
    APPROVE_CNPJ,
    '11.222.333/0001-81',
    REVIEW_CNPJ,
    INVALID_CNPJ,
  ].join('\n'))
  const rows = composeSupplierRows(batch, createResponse())

  assert.deepEqual(summarizeSupplierRows(rows, batch.duplicates.length), {
    total: 3,
    aprovar: 1,
    revisar: 1,
    recusar: 1,
    duplicados: 1,
  })
})

test('filtro só usa classificações recebidas do backend', () => {
  const batch = parseCnpjLines(`${APPROVE_CNPJ}\n${REVIEW_CNPJ}\n${INVALID_CNPJ}`)
  const rows = composeSupplierRows(batch, createResponse())

  assert.deepEqual(filterSupplierRows(rows, 'TODOS'), rows)
  assert.deepEqual(filterSupplierRows(rows, 'APROVAR').map((row) => row.classificacao_risco), ['APROVAR'])
  assert.deepEqual(filterSupplierRows(rows, 'REVISAR').map((row) => row.classificacao_risco), ['REVISAR'])
  assert.deepEqual(filterSupplierRows(rows, 'RECUSAR').map((row) => row.classificacao_risco), ['RECUSAR'])
})

test('falha explicitamente se o contrato omitir resultado de fonte', () => {
  const batch = parseCnpjLines(APPROVE_CNPJ)
  assert.throws(
    () => composeSupplierRows(batch, { ...createResponse(), results: [] }),
    /Resultado consolidado ausente/,
  )
})