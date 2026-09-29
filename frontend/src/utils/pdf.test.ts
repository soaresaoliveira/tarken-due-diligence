import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ConsolidatedResult, SupplierRow } from '../types/analysis.ts'
import type { CnpjEntry } from './cnpj.ts'
import { buildSupplierPdfDocument, supplierPdfFilename } from './pdf.ts'

const FIRST_CNPJ = '00000000000191'
const HEADERS = [
  'CNPJ',
  'Razão Social',
  'Situação Cadastral',
  'Telefone',
  'Embargo',
  'Classificação de Risco',
]

function result(cnpj: string, overrides: Partial<ConsolidatedResult> = {}): ConsolidatedResult {
  return {
    cnpj,
    razao_social: 'Cooperativa São José Ltda.',
    situacao_cadastral: 'ATIVA',
    data_abertura: '2001-02-03',
    cnae: { codigo: '0111301', descricao: 'Cultivo de arroz' },
    endereco: null,
    telefone: '(61) 3333-4444',
    status_receita: 'SUCCESS',
    ibama_auto_infracao: 'NÃO',
    status_ibama_auto: 'SUCCESS',
    ibama_embargo: 'NÃO',
    status_ibama_embargo: 'SUCCESS',
    resultado_ambiental: 'NÃO',
    tem_embargo_ibama: 'NÃO',
    classificacao_risco: 'APROVAR',
    motivo_classificacao: 'Empresa ATIVA sem embargo identificado.',
    data_consulta: '2026-09-28T12:00:00.000Z',
    ...overrides,
  }
}

function validRow(cnpj = FIRST_CNPJ, overrides: Partial<ConsolidatedResult> = {}): SupplierRow {
  const data = result(cnpj, overrides)
  const input: CnpjEntry = { original: cnpj, cnpj, status: 'valid' }
  return {
    key: cnpj,
    input,
    classificacao_risco: data.classificacao_risco,
    motivo_classificacao: data.motivo_classificacao,
    result: data,
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
    invalid: { ...input, classificacao_risco: 'RECUSAR', motivo_classificacao: 'CNPJ inválido.' },
    classificacao_risco: 'RECUSAR',
    motivo_classificacao: 'CNPJ inválido.',
  }
}

function tableBody(doc: ReturnType<typeof buildSupplierPdfDocument>) {
  const tables = doc.content.filter((node) => node.table)
  assert.equal(tables.length, 1, 'deve haver uma única tabela consolidada')
  const table = tables[0]?.table as { headerRows: number; keepWithHeaderRows: number; body: Array<Array<{ text: string }>> }
  return { table, body: table.body }
}

test('cria consolidado A4 landscape com título, data e fontes', () => {
  const doc = buildSupplierPdfDocument([validRow()], [], new Date(2026, 8, 28, 9, 15))

  assert.equal(doc.pageSize, 'A4')
  assert.equal(doc.pageOrientation, 'landscape')
  assert.equal(doc.info.title, 'Due diligence de fornecedores - consolidado')
  assert.equal(doc.content[0]?.text, 'Due diligence de fornecedores - consolidado')
  assert.match(String(doc.content[1]?.text), /Receita Federal \/ BrasilAPI · IBAMA/)
  assert.match(String(doc.content[1]?.text), /Gerado em/)
  assert.equal(doc.content.length, 3)
})

test('usa as seis colunas solicitadas, preserva ordem e classificação recebida', () => {
  const autoOnly = validRow(FIRST_CNPJ, {
    ibama_auto_infracao: 'SIM',
    ibama_embargo: 'NÃO',
    resultado_ambiental: 'SIM',
    tem_embargo_ibama: 'NÃO',
    classificacao_risco: 'APROVAR',
  })
  const embargo = validRow('11222333000181', {
    razao_social: 'Fornecedor com embargo',
    situacao_cadastral: 'BAIXADA',
    tem_embargo_ibama: 'SIM',
    classificacao_risco: 'RECUSAR',
  })
  const unknown = validRow('12345678000195', {
    tem_embargo_ibama: 'NA',
    classificacao_risco: 'REVISAR',
  })
  const doc = buildSupplierPdfDocument([autoOnly, embargo, unknown], [])
  const { body } = tableBody(doc)

  assert.deepEqual(body[0]?.map((cell) => cell.text), HEADERS)
  assert.deepEqual(body.slice(1).map((row) => row.map((cell) => cell.text)), [
    [FIRST_CNPJ, 'Cooperativa São José Ltda.', 'ATIVA', '(61) 3333-4444', 'Não', 'APROVAR'],
    ['11222333000181', 'Fornecedor com embargo', 'BAIXADA', '(61) 3333-4444', 'Sim', 'RECUSAR'],
    ['12345678000195', 'Cooperativa São José Ltda.', 'ATIVA', '(61) 3333-4444', 'NA', 'REVISAR'],
  ])
})

test('mantém inválidos como RECUSAR e exibe NA nos campos de fonte não consultada', () => {
  const doc = buildSupplierPdfDocument([invalidRow()], [])
  const { body } = tableBody(doc)

  assert.deepEqual(body[1]?.map((cell) => cell.text), [
    '11222333000182',
    'NA',
    'NA',
    'NA',
    'NA',
    'RECUSAR',
  ])
})

test('mantém uma linha por fornecedor, cabeçalho repetível e rodapé paginado', () => {
  const rows = Array.from({ length: 48 }, (_, index) => validRow(`000000000001${String(91 + index).padStart(2, '0')}`))
  const doc = buildSupplierPdfDocument(rows, [])
  const { table, body } = tableBody(doc)

  assert.equal(body.length, 49)
  assert.equal(table.headerRows, 1)
  assert.equal(table.keepWithHeaderRows, 1)
  assert.deepEqual(body.slice(1).map((row) => row[0]?.text), rows.map((row) => row.input.cnpj))
  assert.ok(JSON.stringify(doc.header()).includes('TARKEN'))
  assert.ok(JSON.stringify(doc.footer(2, 4)).includes('Página 2 de 4'))
})

test('permite quebra da razão social e informa a quantidade de duplicados descartados', () => {
  const longName = `Cooperativa Agrícola ${'São José e Exportação '.repeat(18)}`
  const row = validRow(FIRST_CNPJ, { razao_social: longName })
  const duplicate: CnpjEntry = { original: '00.000.000/0001-91', cnpj: FIRST_CNPJ, status: 'duplicate' }
  const doc = buildSupplierPdfDocument([row], [duplicate])
  const { body } = tableBody(doc)
  const nameCell = body[1]?.[1] as { text: string; noWrap?: boolean }

  assert.equal(nameCell.text, longName.trim())
  assert.equal(nameCell.noWrap, undefined)
  assert.match(String(doc.content[1]?.text), /1 duplicidade descartada/)
})

test('nomeia o arquivo com a data local da exportação', () => {
  assert.equal(supplierPdfFilename(new Date(2026, 8, 28)), 'due-diligence-fornecedores-2026-09-28.pdf')
})