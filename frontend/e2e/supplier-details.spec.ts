import { expect, test } from '@playwright/test'

const APPROVE_CNPJ = '11222333000181'
const REVIEW_CNPJ = '00000000000191'
const INVALID_CNPJ = '11222333000182'

const results = [
  {
    cnpj: APPROVE_CNPJ,
    razao_social: 'Cooperativa São José Ltda.',
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
    motivo_classificacao: 'Empresa ATIVA sem embargo confirmado.',
    data_consulta: '2026-09-29T12:00:00.000Z',
  },
  {
    cnpj: REVIEW_CNPJ,
    razao_social: null,
    situacao_cadastral: null,
    data_abertura: null,
    cnae: null,
    endereco: null,
    telefone: null,
    status_receita: 'ERROR',
    error: 'BrasilAPI indisponível na consulta.',
    ibama_auto_infracao: 'NA',
    status_ibama_auto: 'ERROR',
    error_ibama_auto: 'Fonte de Autos indisponível.',
    ibama_embargo: 'NA',
    status_ibama_embargo: 'ERROR',
    error_ibama_embargo: 'Fonte de Embargos indisponível.',
    resultado_ambiental: 'NA',
    tem_embargo_ibama: 'NA',
    classificacao_risco: 'REVISAR',
    motivo_classificacao: 'Informação crítica não confirmada.',
    data_consulta: '2026-09-29T12:00:00.000Z',
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

test('exibe e fecha detalhes por fornecedor sem alterar a classificação', async ({ page }) => {
  await page.route('**/api/ibama/cnpjs', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ results, invalid: [invalid], duplicates: [] }),
  }))

  await page.goto('/')
  await page.locator('#cnpj-list').fill([APPROVE_CNPJ, REVIEW_CNPJ, INVALID_CNPJ].join('\n'))
  await page.getByRole('button', { name: 'Analisar fornecedores' }).click()

  const rows = page.locator('.supplier-row')
  await expect(rows).toHaveCount(3)
  await expect(page.locator('.supplier-row .details-toggle')).toHaveCount(3)
  await expect(rows.nth(0).locator('td').nth(1).locator('.source-outcome')).toHaveText('ATIVA')
  await expect(rows.nth(0).locator('td').nth(2).locator('.source-outcome')).toHaveText('SIM')
  await expect(rows.nth(0).locator('td').nth(3).locator('.source-outcome')).toHaveText('NÃO')
  await expect(rows.nth(0).locator('td').nth(4).locator('.source-outcome')).toHaveText('SIM')
  await expect(rows.nth(0)).not.toContainText('SUCCESS')
  await expect(rows.nth(2).locator('td').nth(1).locator('.source-outcome')).toHaveText('CNPJ inválido')
  await expect(rows.nth(1).locator('td').nth(1).locator('.source-outcome')).toContainText('ERROR')
  await expect(rows.nth(1).locator('td').nth(1).locator('.source-outcome')).toContainText('NA')
  await expect(page.locator('.supplier-table thead')).toContainText('Embargos')
  await expect(page.locator('.supplier-table thead')).toContainText('Risco')
  const summaryBefore = await page.locator('.summary-strip').innerText()

  await rows.nth(0).getByRole('button', { name: 'Ver detalhes de Cooperativa São José Ltda.' }).click()
  let details = page.locator('.supplier-details-row')
  await expect(details).toHaveCount(1)
  await expect(details).toContainText(APPROVE_CNPJ)
  await expect(details).toContainText('Cooperativa São José Ltda.')
  await expect(details).toContainText('ATIVA')
  await expect(details).toContainText('2001-02-03')
  await expect(details).toContainText('Cultivo de arroz')
  await expect(details).toContainText('Rua das Flores')
  await expect(details).toContainText('(61) 3333-4444')
  await expect(details).toContainText('Receita Federal')
  await expect(details).toContainText('IBAMA — Autos de Infração')
  await expect(details).toContainText('IBAMA — Áreas Embargadas')
  await expect(details).toContainText('Status da consulta')
  await expect(details).toContainText('SUCCESS')
  await expect(details).toContainText('SIM')
  await expect(details).toContainText('NÃO')
  await expect(details).toContainText('APROVAR')
  await expect(rows.nth(0).locator('.risk-badge')).toHaveText('APROVAR')

  await rows.nth(0).getByRole('button', { name: 'Ocultar detalhes de Cooperativa São José Ltda.' }).click()
  await expect(page.locator('.supplier-details-row')).toHaveCount(0)
  expect(await page.locator('.summary-strip').innerText()).toBe(summaryBefore)
  await expect(rows).toHaveCount(3)

  await rows.nth(1).getByRole('button', { name: 'Ver detalhes de 00000000000191' }).click()
  details = page.locator('.supplier-details-row')
  await expect(details).toHaveCount(1)
  await expect(details).toContainText(REVIEW_CNPJ)
  await expect(details).toContainText('ERROR')
  await expect(details).toContainText('NA')
  await expect(details).toContainText('BrasilAPI indisponível na consulta.')
  await expect(details).toContainText('Fonte de Autos indisponível.')
  await expect(details).toContainText('Fonte de Embargos indisponível.')
  await expect(details).toContainText('REVISAR')
  await expect(rows.nth(1).locator('.risk-badge')).toHaveText('REVISAR')

  await rows.nth(2).getByRole('button', { name: 'Ver detalhes de 11222333000182' }).click()
  details = page.locator('.supplier-details-row')
  await expect(details).toHaveCount(1)
  await expect(details).toContainText(INVALID_CNPJ)
  await expect(details).toContainText('Não consultada: CNPJ inválido.')
  await expect(details).toContainText('RECUSAR')
  await expect(rows.nth(2).locator('.risk-badge')).toHaveText('RECUSAR')
  expect(await page.locator('.summary-strip').innerText()).toBe(summaryBefore)

  await page.getByRole('button', { name: 'Ocultar detalhes de 11222333000182' }).click()
  await expect(page.locator('.supplier-details-row')).toHaveCount(0)
  await expect(rows).toHaveCount(3)
})