import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { validateNormalizedCnpj } from '../../shared/cnpj.ts'

const APPROVE_CNPJ = '11222333000181'
const REVIEW_CNPJ = '00000000000191'
const INVALID_CNPJ = '11222333000182'

function makeResult(cnpj: string, risk: 'APROVAR' | 'REVISAR' | 'RECUSAR', index = 0) {
  const base = {
    cnpj,
    razao_social: `Fornecedor ${index + 1} — Cooperativa Agrícola São José ${'Exportação e Comércio '.repeat(index > 10 ? 3 : 1)}`,
    situacao_cadastral: 'ATIVA',
    data_abertura: '2001-02-03',
    cnae: { codigo: '0111301', descricao: 'Cultivo agrícola' },
    endereco: { cep: '70000-000', logradouro: `Rua das Águas ${'Bloco Norte '.repeat(index > 10 ? 4 : 1)}`, numero: '8', complemento: null, bairro: 'Centro', municipio: 'Brasília', uf: 'DF' },
    telefone: '(61) 3333-4444',
    data_consulta: '2026-09-28T12:00:00.000Z',
  }

  if (risk === 'APROVAR') {
    return {
      ...base,
      status_receita: 'SUCCESS',
      ibama_auto_infracao: 'NÃO',
      status_ibama_auto: 'SUCCESS',
      ibama_embargo: 'NÃO',
      status_ibama_embargo: 'SUCCESS',
      resultado_ambiental: 'NÃO',
      tem_embargo_ibama: 'NÃO',
      classificacao_risco: risk,
      motivo_classificacao: 'Empresa ATIVA, sem embargo confirmado.',
    }
  }

  if (risk === 'REVISAR') {
    return {
      ...base,
      razao_social: null,
      situacao_cadastral: null,
      status_receita: 'ERROR',
      error: 'BrasilAPI indisponível na fixture.',
      ibama_auto_infracao: 'NA',
      status_ibama_auto: 'ERROR',
      error_ibama_auto: 'Autos indisponível.',
      ibama_embargo: 'NA',
      status_ibama_embargo: 'ERROR',
      error_ibama_embargo: 'Embargos indisponível.',
      resultado_ambiental: 'NA',
      tem_embargo_ibama: 'NA',
      classificacao_risco: risk,
      motivo_classificacao: `Informação crítica não confirmada. ${'Detalhes extensos de revisão. '.repeat(index > 10 ? 8 : 1)}`,
    }
  }

  return {
    ...base,
    razao_social: null,
    situacao_cadastral: null,
    status_receita: 'NOT_FOUND',
    error: 'CNPJ não encontrado.',
    ibama_auto_infracao: 'NÃO',
    status_ibama_auto: 'SUCCESS',
    ibama_embargo: 'NÃO',
    status_ibama_embargo: 'SUCCESS',
    resultado_ambiental: 'NÃO',
    tem_embargo_ibama: 'NÃO',
    classificacao_risco: risk,
    motivo_classificacao: 'Empresa não encontrada na Receita Federal.',
  }
}

function invalidEntry() {
  return {
    original: INVALID_CNPJ,
    cnpj: INVALID_CNPJ,
    status: 'invalid',
    reason: 'Segundo dígito verificador inválido.',
    classificacao_risco: 'RECUSAR',
    motivo_classificacao: 'CNPJ inválido.',
  }
}

function validCnpjs(count: number) {
  const values: string[] = []
  for (let prefixNumber = 100_000_000_000; values.length < count; prefixNumber += 1) {
    const prefix = String(prefixNumber).padStart(12, '0')
    for (let first = 0; first <= 9 && values.length < count; first += 1) {
      for (let second = 0; second <= 9; second += 1) {
        const candidate = `${prefix}${first}${second}`
        if (!validateNormalizedCnpj(candidate)) {
          values.push(candidate)
          break
        }
      }
    }
  }
  return values
}

function monitor(page: Page) {
  const errors = { console: [] as string[], page: [] as string[] }
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  page.on('pageerror', (error) => errors.page.push(error.message))
  return errors
}

async function trackPdfMime(page: Page) {
  await page.addInitScript(() => {
    const original = URL.createObjectURL.bind(URL)
    const state = window as Window & { __pdfBlobTypes?: string[] }
    state.__pdfBlobTypes = []
    URL.createObjectURL = (value) => {
      if (value instanceof Blob) state.__pdfBlobTypes?.push(value.type)
      return original(value)
    }
  })
}

async function downloadPdf(page: Page, observeGeneration = false) {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar PDF' }).click()
  if (observeGeneration) await expect(page.getByRole('button', { name: 'Gerando PDF...' })).toBeDisabled()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^due-diligence-fornecedores-\d{4}-\d{2}-\d{2}\.pdf$/)
  const path = await download.path()
  assert.ok(path)
  const bytes = await readFile(path)
  expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  expect(bytes.byteLength).toBeGreaterThan(1_000)
  const types = await page.evaluate(() => (window as Window & { __pdfBlobTypes?: string[] }).__pdfBlobTypes ?? [])
  expect(types).toContain('application/pdf')
  return bytes
}

test('exporta todo o conjunto mesmo com filtro REVISAR ativo', async ({ page }) => {
  const errors = monitor(page)
  await trackPdfMime(page)
  await page.route('**/api/ibama/cnpjs', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      results: [makeResult(APPROVE_CNPJ, 'APROVAR'), makeResult(REVIEW_CNPJ, 'REVISAR')],
      invalid: [invalidEntry()],
      duplicates: [{ original: '11.222.333/0001-81', cnpj: APPROVE_CNPJ, status: 'duplicate' }],
    }),
  }))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Exportar PDF' })).toHaveCount(0)
  await page.locator('#cnpj-list').fill([APPROVE_CNPJ, REVIEW_CNPJ, INVALID_CNPJ].join('\n'))
  await page.getByRole('button', { name: 'Analisar fornecedores' }).click()
  await expect(page.locator('.supplier-row')).toHaveCount(3)
  await page.getByRole('button', { name: 'REVISAR', exact: true }).click()
  await expect(page.locator('.supplier-row')).toHaveCount(1)
  const bytes = await downloadPdf(page)
  expect(bytes.byteLength).toBeGreaterThan(2_000)
  assert.deepEqual(errors, { console: [], page: [] })
})

test('exporta quando há somente CNPJs inválidos', async ({ page }) => {
  const errors = monitor(page)
  await trackPdfMime(page)
  await page.route('**/api/ibama/cnpjs', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ results: [], invalid: [invalidEntry()], duplicates: [] }),
  }))
  await page.goto('/')
  await page.locator('#cnpj-list').fill(INVALID_CNPJ)
  await page.getByRole('button', { name: 'Analisar fornecedores' }).click()
  await expect(page.locator('.supplier-row .reason-cell')).toHaveText('CNPJ inválido.')
  await downloadPdf(page)
  assert.deepEqual(errors, { console: [], page: [] })
})

test('gera PDF consolidado longo com 48 entradas e textos extensos', async ({ page }) => {
  const errors = monitor(page)
  await trackPdfMime(page)
  const cnpjs = validCnpjs(47)
  const results = cnpjs.map((cnpj, index) => makeResult(
    cnpj,
    index % 3 === 0 ? 'APROVAR' : index % 3 === 1 ? 'REVISAR' : 'RECUSAR',
    index,
  ))
  await page.route('**/api/ibama/cnpjs', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ results, invalid: [invalidEntry()], duplicates: [] }),
  }))
  await page.goto('/')
  await page.locator('#cnpj-list').fill([...cnpjs, INVALID_CNPJ].join('\n'))
  await page.getByRole('button', { name: 'Analisar fornecedores' }).click()
  await expect(page.locator('.supplier-row')).toHaveCount(48)
  const bytes = await downloadPdf(page, true)
  expect(bytes.byteLength).toBeGreaterThan(20_000)
  assert.deepEqual(errors, { console: [], page: [] })
})

test('não oferece PDF após falha completa da análise', async ({ page }) => {
  const errors = monitor(page)
  await page.route('**/api/ibama/cnpjs', (route) => route.abort('failed'))
  await page.goto('/')
  await page.locator('#cnpj-list').fill(APPROVE_CNPJ)
  await page.getByRole('button', { name: 'Analisar fornecedores' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exportar PDF' })).toHaveCount(0)
  expect(errors.console.every((message) => message === 'Failed to load resource: net::ERR_FAILED')).toBe(true)
  assert.deepEqual(errors.page, [])
})