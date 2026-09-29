import assert from 'node:assert/strict'
import { expect, test } from '@playwright/test'
import { DEFAULT_RISK_CRITERIA, type RiskCriteria } from '../../shared/risk-engine.ts'

const CNPJ = '84046101000193'

test('Recalcular reaplica critérios localmente sem nova consulta e preserva evidências', async ({ page }) => {
  let analysisRequests = 0
  let collectedCnpjs: string[] = []

  await page.route('**/api/ibama/cnpjs', async (route) => {
    analysisRequests += 1
    const request = route.request().postDataJSON() as { cnpjs: string[]; riskCriteria: RiskCriteria }
    collectedCnpjs = request.cnpjs
    expect(request.riskCriteria).toEqual(DEFAULT_RISK_CRITERIA)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [{
          cnpj: CNPJ,
          razao_social: 'BUNGE ALIMENTOS S/A',
          situacao_cadastral: 'ATIVA',
          data_abertura: '1972-03-27',
          cnae: { codigo: '1041400', descricao: 'Fabricação de óleos vegetais' },
          endereco: null,
          telefone: '4737032500',
          status_receita: 'SUCCESS',
          ibama_auto_infracao: 'SIM',
          status_ibama_auto: 'SUCCESS',
          ibama_embargo: 'NÃO',
          status_ibama_embargo: 'SUCCESS',
          resultado_ambiental: 'SIM',
          tem_embargo_ibama: 'NÃO',
          classificacao_risco: 'REVISAR',
          motivo_classificacao: 'Auto de Infração IBAMA encontrado.',
          data_consulta: '2026-09-29T12:00:00.000Z',
        }],
        invalid: [],
        duplicates: [],
      }),
    })
  })

  await page.goto('/')
  await expect(page.locator('#cnpj-list')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'CNPJ inválido / dígito verificador inválido' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Auto de Infração IBAMA encontrado' })).toBeChecked()
  await expect(page.getByRole('button', { name: 'Recalcular' })).toHaveCount(0)
  await page.locator('#cnpj-list').fill(CNPJ)
  await page.getByRole('button', { name: 'Analisar fornecedores' }).click()
  const row = page.locator('.supplier-row').first()
  await expect(row.locator('.risk-badge')).toHaveText('REVISAR')
  await expect(page.locator('#cnpj-list')).toHaveCount(0)
  await expect(page.locator('.analysis-controls__summary')).toContainText('1 fornecedor analisado')
  const resultGridColumns = await page.locator('.analysis-layout').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(resultGridColumns.trim().split(/\s+/)).toHaveLength(1)
  expect(analysisRequests).toBe(1)
  expect(collectedCnpjs).toEqual([CNPJ])

  await page.locator('.risk-criteria-disclosure > summary').click()
  const recalculateButton = page.getByRole('button', { name: 'Recalcular' })
  await expect(recalculateButton).toBeEnabled()
  const autoCriterion = page.getByRole('checkbox', { name: 'Auto de Infração IBAMA encontrado' })
  await autoCriterion.uncheck()
  await expect(row.locator('.risk-badge')).toHaveText('REVISAR')
  expect(analysisRequests).toBe(1)

  await recalculateButton.click()
  await expect(row.locator('.risk-badge')).toHaveText('APROVAR')
  expect(analysisRequests).toBe(1)

  await row.getByRole('button', { name: 'Ver detalhes de BUNGE ALIMENTOS S/A' }).click()
  const details = page.locator('.supplier-details-row')
  await expect(details).toContainText('Autos')
  await expect(details).toContainText('SIM')
  await expect(details).toContainText('SUCCESS')
  await expect(details).toContainText('APROVAR')
  expect(analysisRequests).toBe(1)
  assert.deepEqual(collectedCnpjs, [CNPJ])
})

test('Nova análise limpa resultados sem consultar até Analisar fornecedores', async ({ page }) => {
  let analysisRequests = 0
  await page.route('**/api/ibama/cnpjs', async (route) => {
    analysisRequests += 1
    const request = route.request().postDataJSON() as { cnpjs: string[] }
    const cnpj = request.cnpjs[0]
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [{
          cnpj,
          razao_social: 'Fornecedor de teste',
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
          classificacao_risco: 'APROVAR',
          motivo_classificacao: 'Nenhum critério acionado.',
          data_consulta: '2026-09-29T12:00:00.000Z',
        }],
        invalid: [],
        duplicates: [],
      }),
    })
  })

  await page.goto('/')
  await page.locator('#cnpj-list').fill(CNPJ)
  await page.getByRole('button', { name: 'Analisar fornecedores' }).click()
  await expect(page.locator('.supplier-row')).toHaveCount(1)
  expect(analysisRequests).toBe(1)

  await page.getByRole('button', { name: 'Nova análise' }).click()
  await expect(page.locator('.supplier-row')).toHaveCount(0)
  await expect(page.locator('.analysis-controls')).toHaveCount(0)
  await expect(page.locator('#cnpj-list')).toBeVisible()
  await expect(page.locator('#cnpj-list')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Analisar fornecedores' })).toBeDisabled()
  expect(analysisRequests).toBe(1)

  await page.locator('#cnpj-list').fill(CNPJ)
  await expect(page.getByRole('button', { name: 'Analisar fornecedores' })).toBeEnabled()
  await page.getByRole('button', { name: 'Analisar fornecedores' }).click()
  await expect(page.locator('.supplier-row')).toHaveCount(1)
  expect(analysisRequests).toBe(2)
})