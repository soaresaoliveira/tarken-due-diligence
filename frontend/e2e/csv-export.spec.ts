import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { CSV_HEADERS } from '../src/utils/csv.ts'

const APPROVE_CNPJ = '11222333000181'
const REVIEW_CNPJ = '00000000000191'
const INVALID_CNPJ = '11222333000182'

const consolidated = [
  {
    cnpj: APPROVE_CNPJ,
    razao_social: 'Cooperativa São José Ltda.',
    situacao_cadastral: 'ATIVA',
    data_abertura: '2001-02-03',
    cnae: { codigo: '0111301', descricao: 'Cultivo de arroz' },
    endereco: { cep: '70000-000', logradouro: 'Rua das Flores', numero: '8', complemento: null, bairro: 'Centro', municipio: 'Brasília', uf: 'DF' },
    telefone: '(61) 3333-4444',
    status_receita: 'SUCCESS',
    ibama_auto_infracao: 'SIM',
    status_ibama_auto: 'SUCCESS',
    ibama_embargo: 'NÃO',
    status_ibama_embargo: 'SUCCESS',
    resultado_ambiental: 'SIM',
    tem_embargo_ibama: 'NÃO',
    classificacao_risco: 'APROVAR',
    motivo_classificacao: 'Empresa ATIVA sem embargo confirmado.',
    data_consulta: '2026-09-28T12:00:00.000Z',
  },
  {
    cnpj: REVIEW_CNPJ,
    razao_social: 'Fornecedor Ambiental Ltda.',
    situacao_cadastral: 'ATIVA',
    data_abertura: '2012-04-05',
    cnae: null,
    endereco: null,
    telefone: null,
    status_receita: 'ERROR',
    error: 'Receita indisponível.',
    ibama_auto_infracao: 'NA',
    status_ibama_auto: 'ERROR',
    error_ibama_auto: 'Autos indisponível.',
    ibama_embargo: 'NA',
    status_ibama_embargo: 'ERROR',
    error_ibama_embargo: 'Embargos indisponível.',
    resultado_ambiental: 'NA',
    tem_embargo_ibama: 'NA',
    classificacao_risco: 'REVISAR',
    motivo_classificacao: 'Informação crítica não confirmada.',
    data_consulta: '2026-09-28T12:00:00.000Z',
  },
]

const invalid = {
  original: INVALID_CNPJ,
  cnpj: INVALID_CNPJ,
  status: 'invalid',
  reason: 'Segundo dígito verificador inválido.',
  classificacao_risco: 'RECUSAR',
  motivo_classificacao: 'CNPJ inválido.',
}

const duplicate = {
  original: '11.222.333/0001-81',
  cnpj: APPROVE_CNPJ,
  status: 'duplicate',
  reason: 'CNPJ duplicado após a normalização.',
}

function watchBrowserErrors(page: Page) {
  const errors = { console: [] as string[], page: [] as string[] }
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  page.on('pageerror', (error) => errors.page.push(error.message))
  return errors
}

test('baixa todos os resultados mesmo com filtro ativo e exclui duplicatas', async ({ page }) => {
  const errors = watchBrowserErrors(page)
  await page.route('**/api/ibama/cnpjs', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ results: consolidated, invalid: [invalid], duplicates: [duplicate] }),
  }))

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toHaveCount(0)
  await page.locator('#cnpj-list').fill([
    APPROVE_CNPJ,
    duplicate.original,
    REVIEW_CNPJ,
    INVALID_CNPJ,
  ].join('\n'))
  await page.getByRole('button', { name: 'Analisar fornecedores' }).click()
  await expect(page.locator('.supplier-row')).toHaveCount(3)
  await page.getByRole('button', { name: 'REVISAR', exact: true }).click()
  await expect(page.locator('.supplier-row')).toHaveCount(1)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^due-diligence-fornecedores-\d{4}-\d{2}-\d{2}\.csv$/)

  const path = await download.path()
  assert.ok(path)
  const csv = await readFile(path, 'utf8')
  expect(csv.startsWith('\uFEFF')).toBe(true)
  expect(csv.split('\r\n')[0]).toBe(`\uFEFF${CSV_HEADERS.map((header) => `"${header}"`).join(';')}`)
  expect(csv).toContain('"APROVAR"')
  expect(csv).toContain('"REVISAR"')
  expect(csv).toContain('"RECUSAR"')
  expect(csv).toContain('"CNPJ inválido."')
  expect(csv).toContain('"Receita indisponível."')
  expect(csv).toContain('"Autos indisponível."')
  expect(csv).toContain('"NA"')
  expect(csv).toContain('Cooperativa São José Ltda.')
  expect(csv).toContain('"1"')
  expect(csv).not.toContain(duplicate.original)
  expect(csv.split('\r\n')).toHaveLength(5)
  assert.deepEqual(errors, { console: [], page: [] })
})

test('permite exportar quando a consulta contém somente CNPJs inválidos', async ({ page }) => {
  const errors = watchBrowserErrors(page)
  await page.route('**/api/ibama/cnpjs', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ results: [], invalid: [invalid], duplicates: [] }),
  }))

  await page.goto('/')
  await page.locator('#cnpj-list').fill(INVALID_CNPJ)
  await page.getByRole('button', { name: 'Analisar fornecedores' }).click()
  await expect(page.locator('.supplier-row .reason-cell')).toHaveText('CNPJ inválido.')
  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const download = await downloadPromise
  const path = await download.path()
  assert.ok(path)
  const csv = await readFile(path, 'utf8')
  expect(csv).toContain('"RECUSAR"')
  expect(csv).toContain('"CNPJ inválido."')
  expect(csv).not.toContain('"SUCCESS"')
  expect(csv).not.toContain('"ERROR"')
  expect(csv).not.toContain('"NOT_FOUND"')
  assert.deepEqual(errors, { console: [], page: [] })
})

test('não disponibiliza download quando a requisição completa falha', async ({ page }) => {
  const errors = watchBrowserErrors(page)
  await page.route('**/api/ibama/cnpjs', (route) => route.abort('failed'))

  await page.goto('/')
  await page.locator('#cnpj-list').fill(APPROVE_CNPJ)
  await page.getByRole('button', { name: 'Analisar fornecedores' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toHaveCount(0)
  expect(errors.console.every((message) => message === 'Failed to load resource: net::ERR_FAILED')).toBe(true)
  assert.deepEqual(errors.page, [])
})