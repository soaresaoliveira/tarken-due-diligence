import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lookupBrasilApi } from '../src/brasilapi.ts'

const VALID_CNPJ = '11222333000181'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('normaliza os campos cadastrais recebidos em HTTP 200', async () => {
  const result = await lookupBrasilApi(VALID_CNPJ, {
    fetchImpl: async (input) => {
      assert.equal(String(input), `https://brasilapi.com.br/api/cnpj/v1/${VALID_CNPJ}`)
      return jsonResponse({
        cnpj: VALID_CNPJ,
        razao_social: 'Empresa Exemplo Ltda.',
        descricao_situacao_cadastral: 'ATIVA',
        data_inicio_atividade: '2000-01-02',
        cnae_fiscal: 1234567,
        cnae_fiscal_descricao: 'Atividade de exemplo',
        cep: '01001-000',
        logradouro: 'Praça da Sé',
        numero: '1',
        complemento: '',
        bairro: 'Sé',
        municipio: 'São Paulo',
        uf: 'SP',
        ddd_telefone_1: '(11) 1234-5678',
      })
    },
  })

  assert.equal(result.status, 'SUCCESS')
  assert.equal(result.cnpj, VALID_CNPJ)
  assert.equal(result.razao_social, 'Empresa Exemplo Ltda.')
  assert.equal(result.situacao_cadastral, 'ATIVA')
  assert.equal(result.data_abertura, '2000-01-02')
  assert.deepEqual(result.cnae, { codigo: '1234567', descricao: 'Atividade de exemplo' })
  assert.deepEqual(result.endereco, {
    cep: '01001-000',
    logradouro: 'Praça da Sé',
    numero: '1',
    complemento: null,
    bairro: 'Sé',
    municipio: 'São Paulo',
    uf: 'SP',
  })
  assert.equal(result.telefone, '(11) 1234-5678')
})

test('retorna NOT_FOUND para HTTP 404 sem retry', async () => {
  let calls = 0
  const result = await lookupBrasilApi(VALID_CNPJ, {
    fetchImpl: async () => {
      calls += 1
      return jsonResponse({ message: 'not found' }, 404)
    },
    retryDelayMs: 0,
  })

  assert.equal(result.status, 'NOT_FOUND')
  assert.equal(calls, 1)
})

test('retorna ERROR para erro HTTP definitivo sem retry', async () => {
  let calls = 0
  const result = await lookupBrasilApi(VALID_CNPJ, {
    fetchImpl: async () => {
      calls += 1
      return jsonResponse({ message: 'bad request' }, 400)
    },
    retryDelayMs: 0,
  })

  assert.equal(result.status, 'ERROR')
  assert.match(result.error ?? '', /HTTP 400/)
  assert.equal(calls, 1)
})

test('não retenta HTTP 403 de acesso bloqueado', async () => {
  let calls = 0
  const result = await lookupBrasilApi(VALID_CNPJ, {
    fetchImpl: async () => {
      calls += 1
      return jsonResponse({ message: 'forbidden' }, 403)
    },
    retryDelayMs: 0,
  })

  assert.equal(result.status, 'ERROR')
  assert.match(result.error ?? '', /HTTP 403/)
  assert.equal(calls, 1)
})

test('retenta uma vez erro HTTP transitório e retorna sucesso', async () => {
  let calls = 0
  const result = await lookupBrasilApi(VALID_CNPJ, {
    fetchImpl: async () => {
      calls += 1
      return calls === 1 ? jsonResponse({}, 503) : jsonResponse({ razao_social: 'Recuperada' })
    },
    retryDelayMs: 0,
  })

  assert.equal(result.status, 'SUCCESS')
  assert.equal(result.razao_social, 'Recuperada')
  assert.equal(calls, 2)
})

test('retenta uma vez erro de rede transitório', async () => {
  let calls = 0
  const result = await lookupBrasilApi(VALID_CNPJ, {
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) throw new TypeError('fetch failed')
      return jsonResponse({ cnpj: VALID_CNPJ })
    },
    retryDelayMs: 0,
  })

  assert.equal(result.status, 'SUCCESS')
  assert.equal(calls, 2)
})

test('limita retry de timeout a uma repetição e retorna ERROR', async () => {
  let calls = 0
  const result = await lookupBrasilApi(VALID_CNPJ, {
    timeoutMs: 5,
    retryDelayMs: 0,
    fetchImpl: async (_input, init) => {
      calls += 1
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    },
  })

  assert.equal(result.status, 'ERROR')
  assert.match(result.error ?? '', /excedeu o limite/)
  assert.equal(calls, 2)
})

test('resposta JSON inválida retorna ERROR sem retry', async () => {
  let calls = 0
  const result = await lookupBrasilApi(VALID_CNPJ, {
    fetchImpl: async () => {
      calls += 1
      return new Response('{inválido', { status: 200 })
    },
    retryDelayMs: 0,
  })

  assert.equal(result.status, 'ERROR')
  assert.match(result.error ?? '', /JSON inválido/)
  assert.equal(calls, 1)
})

test('resposta JSON válida mas inesperada retorna ERROR', async () => {
  const result = await lookupBrasilApi(VALID_CNPJ, {
    fetchImpl: async () => jsonResponse(['resposta', 'inesperada']),
  })

  assert.equal(result.status, 'ERROR')
  assert.match(result.error ?? '', /resposta inesperada/)
})

test('resposta incompleta permanece SUCCESS com campos ausentes nulos', async () => {
  const result = await lookupBrasilApi(VALID_CNPJ, {
    fetchImpl: async () => jsonResponse({ cnpj: VALID_CNPJ, razao_social: 'Parcial' }),
  })

  assert.equal(result.status, 'SUCCESS')
  assert.equal(result.razao_social, 'Parcial')
  assert.equal(result.situacao_cadastral, null)
  assert.equal(result.data_abertura, null)
  assert.equal(result.cnae, null)
  assert.equal(result.endereco, null)
  assert.equal(result.telefone, null)
})

test('CNPJ inválido é rejeitado antes de qualquer chamada de rede', async () => {
  let calls = 0

  await assert.rejects(
    lookupBrasilApi('11222333000180', {
      fetchImpl: async () => {
        calls += 1
        return jsonResponse({})
      },
    }),
    /CNPJ não validado/,
  )

  assert.equal(calls, 0)
})

test('não retenta rate limit HTTP 429', async () => {
  let calls = 0
  const result = await lookupBrasilApi(VALID_CNPJ, {
    fetchImpl: async () => {
      calls += 1
      return jsonResponse({ message: 'rate limited' }, 429)
    },
    retryDelayMs: 0,
  })

  assert.equal(result.status, 'ERROR')
  assert.equal(calls, 1)
})