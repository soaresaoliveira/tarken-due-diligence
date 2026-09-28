import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApiServer, type ReceitaLookup } from '../src/server.ts'
import type { ReceitaResult, ReceitaStatus } from '../src/brasilapi.ts'

function result(cnpj: string, status: ReceitaStatus): ReceitaResult {
  return {
    cnpj,
    razao_social: null,
    situacao_cadastral: null,
    data_abertura: null,
    cnae: null,
    endereco: null,
    telefone: null,
    status,
  }
}

async function withServer<T>(lookup: ReceitaLookup, run: (url: string) => Promise<T>) {
  const server = createApiServer(lookup)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Servidor não abriu uma porta TCP.')

  try {
    return await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

test('rota envia somente CNPJs válidos únicos ao cliente BrasilAPI', async () => {
  const calls: string[] = []
  await withServer(async (cnpj) => {
    calls.push(cnpj)
    return result(cnpj, 'SUCCESS')
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/receita/cnpjs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnpjs: ['11.222.333/0001-81', '11222333000181', '123'] }),
    })
    const payload = await response.json() as {
      results: ReceitaResult[]
      invalid: { cnpj: string }[]
      duplicates: { cnpj: string }[]
    }

    assert.equal(response.status, 200)
    assert.deepEqual(calls, ['11222333000181'])
    assert.equal(payload.results.length, 1)
    assert.equal(payload.invalid[0]?.cnpj, '123')
    assert.equal(payload.duplicates[0]?.cnpj, '11222333000181')
  })
})

test('rota não chama o cliente externo quando todas as entradas são inválidas', async () => {
  let calls = 0
  await withServer(async (cnpj) => {
    calls += 1
    return result(cnpj, 'SUCCESS')
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/receita/cnpjs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnpjs: ['123', 'sem dígitos'] }),
    })
    const payload = await response.json() as { results: ReceitaResult[]; invalid: unknown[] }

    assert.equal(response.status, 200)
    assert.equal(payload.results.length, 0)
    assert.equal(payload.invalid.length, 2)
    assert.equal(calls, 0)
  })
})

test('rota preserva NOT_FOUND sem convertê-lo em ERROR', async () => {
  await withServer(async (cnpj) => result(cnpj, 'NOT_FOUND'), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/receita/cnpjs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnpjs: ['11222333000181'] }),
    })
    const payload = await response.json() as { results: ReceitaResult[] }

    assert.equal(payload.results[0]?.status, 'NOT_FOUND')
  })
})

test('rota responde 400 para JSON inválido', async () => {
  await withServer(async (cnpj) => result(cnpj, 'SUCCESS'), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/receita/cnpjs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{inválido',
    })

    assert.equal(response.status, 400)
  })
})