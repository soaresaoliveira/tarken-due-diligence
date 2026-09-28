import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApiServer, type IbamaLookup, type ReceitaLookup } from '../src/server.ts'
import type { IbamaResult } from '../src/ibama.ts'
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

async function withServer<T>(
  lookup: ReceitaLookup,
  run: (url: string) => Promise<T>,
  ibamaLookup?: IbamaLookup,
) {
  const server = createApiServer(lookup, ibamaLookup)
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

test('rota IBAMA envia somente válidos únicos e preserva status por fonte', async () => {
  const received: string[][] = []
  await withServer(
    async (cnpj) => result(cnpj, 'SUCCESS'),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/ibama/cnpjs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpjs: ['11.222.333/0001-81', '11222333000181', '123'] }),
      })
      const payload = await response.json() as {
        results: IbamaResult[]
        invalid: unknown[]
        duplicates: unknown[]
      }

      assert.equal(response.status, 200)
      assert.deepEqual(received, [['11222333000181']])
      assert.equal(payload.results[0]?.status_ibama_auto, 'SUCCESS')
      assert.equal(payload.results[0]?.ibama_auto_infracao, 'NÃO')
      assert.equal(payload.results[0]?.status_ibama_embargo, 'ERROR')
      assert.equal(payload.results[0]?.ibama_embargo, 'NA')
      assert.equal(payload.results[0]?.resultado_ambiental, 'NÃO')
      assert.equal(payload.invalid.length, 1)
      assert.equal(payload.duplicates.length, 1)
    },
    async (cnpjs) => {
      received.push(cnpjs)
      return cnpjs.map((cnpj) => ({
        cnpj,
        ibama_auto_infracao: 'NÃO',
        status_ibama_auto: 'SUCCESS',
        ibama_embargo: 'NA',
        status_ibama_embargo: 'ERROR',
        error_ibama_embargo: 'Fonte indisponível.',
        resultado_ambiental: 'NÃO',
      }))
    },
  )
})

test('rota IBAMA não carrega fontes se todas as entradas forem inválidas', async () => {
  let calls = 0
  await withServer(
    async (cnpj) => result(cnpj, 'SUCCESS'),
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/ibama/cnpjs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpjs: ['123', 'sem dígitos'] }),
      })
      const payload = await response.json() as { results: IbamaResult[]; invalid: unknown[] }

      assert.equal(response.status, 200)
      assert.equal(payload.results.length, 0)
      assert.equal(payload.invalid.length, 2)
      assert.equal(calls, 0)
    },
    async () => {
      calls += 1
      return []
    },
  )
})


test('rota IBAMA consolida Receita e IBAMA por CNPJ e mantém um resultado por CNPJ único', async () => {
  const receitaCalls: string[] = []
  const ibamaCalls: string[][] = []
  const firstCnpj = '11222333000181'
  const secondCnpj = '00000000000191'

  await withServer(
    async (cnpj) => {
      receitaCalls.push(cnpj)
      return {
        ...result(cnpj, 'SUCCESS'),
        razao_social: `Empresa ${cnpj}`,
        situacao_cadastral: 'ATIVA',
      }
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/ibama/cnpjs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpjs: [firstCnpj, secondCnpj, `11.222.333/0001-81`] }),
      })
      const payload = await response.json() as {
        results: (IbamaResult & {
          razao_social: string | null
          status_receita: ReceitaStatus
          tem_embargo_ibama: 'SIM' | 'NÃO' | 'NA'
          classificacao_risco: 'APROVAR' | 'REVISAR' | 'RECUSAR'
          motivo_classificacao: string
        })[]
        duplicates: { cnpj: string }[]
      }

      assert.equal(response.status, 200)
      assert.deepEqual(receitaCalls, [firstCnpj, secondCnpj])
      assert.deepEqual(ibamaCalls, [[firstCnpj, secondCnpj]])
      assert.equal(payload.results.length, 2)
      assert.equal(payload.duplicates.length, 1)

      const first = payload.results.find((item) => item.cnpj === firstCnpj)
      const second = payload.results.find((item) => item.cnpj === secondCnpj)
      assert.equal(first?.razao_social, `Empresa ${firstCnpj}`)
      assert.equal(first?.status_receita, 'SUCCESS')
      assert.equal(first?.status_ibama_auto, 'ERROR')
      assert.equal(first?.ibama_auto_infracao, 'NA')
      assert.equal(first?.status_ibama_embargo, 'SUCCESS')
      assert.equal(first?.ibama_embargo, 'NÃO')
      assert.equal(first?.tem_embargo_ibama, 'NÃO')
      assert.equal(first?.classificacao_risco, 'APROVAR')
      assert.ok(first?.motivo_classificacao)
      assert.equal(second?.ibama_embargo, 'SIM')
      assert.equal(second?.tem_embargo_ibama, 'SIM')
      assert.equal(second?.classificacao_risco, 'REVISAR')
    },
    async (cnpjs) => {
      ibamaCalls.push(cnpjs)
      return [...cnpjs].reverse().map((cnpj) => ({
        cnpj,
        ibama_auto_infracao: cnpj === firstCnpj ? 'NA' : 'NÃO',
        status_ibama_auto: cnpj === firstCnpj ? 'ERROR' : 'SUCCESS',
        ...(cnpj === firstCnpj ? { error_ibama_auto: 'Autos indisponível.' } : {}),
        ibama_embargo: cnpj === secondCnpj ? 'SIM' : 'NÃO',
        status_ibama_embargo: 'SUCCESS',
        resultado_ambiental: cnpj === secondCnpj ? 'SIM' : 'NÃO',
      }))
    },
  )
})

test('rota IBAMA classifica CNPJ inválido sem simular consulta de fonte', async () => {
  let receitaCalls = 0
  let ibamaCalls = 0

  await withServer(
    async (cnpj) => {
      receitaCalls += 1
      return result(cnpj, 'SUCCESS')
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/ibama/cnpjs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpjs: ['11222333000182'] }),
      })
      const payload = await response.json() as {
        results: unknown[]
        invalid: {
          classificacao_risco: string
          motivo_classificacao: string
          status_receita?: string
          status_ibama_auto?: string
          status_ibama_embargo?: string
        }[]
      }

      assert.equal(response.status, 200)
      assert.deepEqual(payload.results, [])
      assert.equal(payload.invalid[0]?.classificacao_risco, 'RECUSAR')
      assert.equal(payload.invalid[0]?.motivo_classificacao, 'CNPJ inválido.')
      assert.equal(payload.invalid[0]?.status_receita, undefined)
      assert.equal(payload.invalid[0]?.status_ibama_auto, undefined)
      assert.equal(payload.invalid[0]?.status_ibama_embargo, undefined)
      assert.equal(receitaCalls, 0)
      assert.equal(ibamaCalls, 0)
    },
    async () => {
      ibamaCalls += 1
      return []
    },
  )
})