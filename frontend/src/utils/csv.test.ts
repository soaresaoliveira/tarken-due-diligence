import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ConsolidatedResult, SupplierRow } from '../types/analysis.ts'
import type { CnpjEntry } from './cnpj.ts'
import { CSV_HEADERS, serializeSupplierCsv, supplierCsvFilename } from './csv.ts'

const VALID_CNPJ = '11222333000181'

function validRow(overrides: Partial<ConsolidatedResult> = {}): SupplierRow {
  const result: ConsolidatedResult = {
    cnpj: VALID_CNPJ,
    razao_social: 'Empresa Exemplo Ltda.',
    situacao_cadastral: 'ATIVA',
    data_abertura: '2001-02-03',
    cnae: { codigo: '0111301', descricao: 'Cultivo de arroz' },
    endereco: {
      cep: '70000-000',
      logradouro: 'Rua das Flores',
      numero: '8',
      complemento: null,
      bairro: 'Centro',
      municipio: 'Brasília',
      uf: 'DF',
    },
    telefone: '(61) 3333-4444',
    status_receita: 'SUCCESS',
    ibama_auto_infracao: 'SIM',
    status_ibama_auto: 'SUCCESS',
    ibama_embargo: 'NÃO',
    status_ibama_embargo: 'SUCCESS',
    resultado_ambiental: 'SIM',
    tem_embargo_ibama: 'NÃO',
    classificacao_risco: 'APROVAR',
    motivo_classificacao: 'Empresa ATIVA sem embargo.',
    data_consulta: '2026-09-28T12:00:00.000Z',
    ...overrides,
  }
  const input: CnpjEntry = { original: VALID_CNPJ, cnpj: VALID_CNPJ, status: 'valid' }
  return {
    key: VALID_CNPJ,
    input,
    classificacao_risco: result.classificacao_risco,
    motivo_classificacao: result.motivo_classificacao,
    result,
  }
}

function invalidRow(): SupplierRow {
  const input: CnpjEntry = {
    original: '11222333000182',
    cnpj: '11222333000182',
    status: 'invalid',
    reason: 'Segundo dígito verificador inválido.',
  }
  return {
    key: input.cnpj,
    input,
    classificacao_risco: 'RECUSAR',
    motivo_classificacao: 'CNPJ inválido.',
    invalid: {
      ...input,
      classificacao_risco: 'RECUSAR',
      motivo_classificacao: 'CNPJ inválido.',
    },
  }
}

test('exporta todas as colunas aprovadas em uma linha por fornecedor', () => {
  const csv = serializeSupplierCsv([validRow(), invalidRow()], [])
  const lines = csv.replace(/^\uFEFF/, '').split('\r\n')

  assert.deepEqual(lines[0]?.split(';').map((header) => header.replaceAll('"', '')), [...CSV_HEADERS])
  assert.equal(lines.length, 4)
  assert.match(csv, /"APROVAR"/)
  assert.match(csv, /"RECUSAR"/)
  assert.match(csv, /"Segundo dígito verificador inválido\."/)
})

test('preserva ERROR, NOT_FOUND, NA e NÃO sem inventar status para inválidos', () => {
  const errorRow = validRow({
    razao_social: null,
    situacao_cadastral: null,
    data_abertura: null,
    cnae: null,
    endereco: null,
    telefone: null,
    status_receita: 'ERROR',
    error: 'HTTP 503; indisponível',
    ibama_auto_infracao: 'NA',
    status_ibama_auto: 'ERROR',
    error_ibama_auto: 'Fonte "Autos" indisponível',
    ibama_embargo: 'NA',
    status_ibama_embargo: 'ERROR',
    error_ibama_embargo: 'Timeout',
    resultado_ambiental: 'NA',
    tem_embargo_ibama: 'NA',
    classificacao_risco: 'REVISAR',
    motivo_classificacao: 'Informação crítica não confirmada.',
  })
  const notFoundRow = validRow({
    status_receita: 'NOT_FOUND',
    error: 'CNPJ não encontrado.',
    classificacao_risco: 'RECUSAR',
    motivo_classificacao: 'Empresa não encontrada na Receita Federal.',
  })
  const csv = serializeSupplierCsv([errorRow, notFoundRow, invalidRow()], [])

  assert.match(csv, /"ERROR"/)
  assert.match(csv, /"NOT_FOUND"/)
  assert.match(csv, /"NA"/)
  assert.match(csv, /"NÃO"/)
  assert.match(csv, /"HTTP 503; indisponível"/)
  assert.match(csv, /"Fonte ""Autos"" indisponível"/)
  assert.match(csv, /"";"";"";"";"";"";"";"";"";"";"";""/)
  assert.doesNotMatch(csv, /11222333000182[^\r\n]*SUCCESS/)
})

test('achata CNAE/endereço, preserva acentos e escapa delimitador, aspas e quebras de linha', () => {
  const row = validRow({
    razao_social: 'Cooperativa; "São José"\nUnidade Sul',
    cnae: { codigo: '0111301', descricao: 'Cultivo; de arroz' },
    endereco: {
      cep: '01000-000',
      logradouro: 'Rua "D´Água"; Norte\nBloco B',
      numero: '12',
      complemento: 'Sala; 3',
      bairro: 'São João',
      municipio: 'São Paulo',
      uf: 'SP',
    },
  })
  const csv = serializeSupplierCsv([row], [])

  assert.ok(csv.startsWith('\uFEFF'))
  assert.match(csv, /"Cooperativa; ""São José""\nUnidade Sul"/)
  assert.match(csv, /"Cultivo; de arroz"/)
  assert.match(csv, /"Rua ""D´Água""; Norte\nBloco B"/)
  assert.match(csv, /"São Paulo"/)
  assert.match(csv, /\r\n/)
})

test('campos nulos viram células vazias e não substituem NA', () => {
  const row = validRow({ razao_social: null, cnae: null, endereco: null, ibama_auto_infracao: 'NA' })
  const csv = serializeSupplierCsv([row], [])

  assert.match(csv, /"";"";"";"";""/)
  assert.match(csv, /"NA"/)
})

test('duplicados não criam linhas e sua contagem é associada ao CNPJ', () => {
  const duplicates: CnpjEntry[] = [
    { original: '11.222.333/0001-81', cnpj: VALID_CNPJ, status: 'duplicate' },
    { original: '11 222 333 0001 81', cnpj: VALID_CNPJ, status: 'duplicate' },
  ]
  const csv = serializeSupplierCsv([validRow()], duplicates)
  const records = csv.replace(/^\uFEFF/, '').split('\r\n').filter(Boolean)

  assert.equal(records.length, 2)
  assert.ok(records[1]?.includes('"2"'))
})

test('não gera linhas extras para evidências e preserva classificação/motivo do backend', () => {
  const row = validRow({
    ibama_auto_infracao: 'NÃO',
    ibama_embargo: 'SIM',
    resultado_ambiental: 'SIM',
    tem_embargo_ibama: 'SIM',
    classificacao_risco: 'REVISAR',
    motivo_classificacao: 'Empresa ATIVA, porém foi identificado registro de embargo no IBAMA.',
  })
  const records = serializeSupplierCsv([row], []).replace(/^\uFEFF/, '').split('\r\n').filter(Boolean)

  assert.equal(records.length, 2)
  assert.ok(records[1]?.includes('"NÃO"'))
  assert.ok(records[1]?.includes('"SIM"'))
  assert.ok(records[1]?.includes('"REVISAR"'))
  assert.ok(records[1]?.includes('"Empresa ATIVA, porém foi identificado registro de embargo no IBAMA."'))
})

test('nomeia arquivo com a data local da exportação', () => {
  assert.equal(supplierCsvFilename(new Date(2026, 8, 28)), 'due-diligence-fornecedores-2026-09-28.csv')
})