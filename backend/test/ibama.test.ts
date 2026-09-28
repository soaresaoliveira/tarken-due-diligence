import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import {
  IBAMA_SOURCE_URLS,
  IbamaService,
  consolidateEnvironmentalResult,
  type IbamaZipReader,
} from '../src/ibama.ts'

const MATCHED_CNPJ = '11222333000181'
const SECOND_CNPJ = '00000000000191'

const autosCsv = [
  'SEQ_AUTO_INFRACAO;CPF_CNPJ_INFRATOR;DESCRICAO',
  '1;"11.222.333/0001-81";"Auto com; delimitador"',
].join('\n')

const emptyAutosCsv = 'SEQ_AUTO_INFRACAO;CPF_CNPJ_INFRATOR;DESCRICAO\n2;02330709234;CPF'
const embargoCsv = 'SEQ_TAD;CPF_CNPJ_EMBARGADO;NOME\n1;11222333000181;Proprietária'
const emptyEmbargoCsv = 'SEQ_TAD;CPF_CNPJ_EMBARGADO;NOME\n2;;Sem identificador'

function zipReaderFor(csv: string): IbamaZipReader {
  return async function* () {
    yield {
      path: 'auto_infracao_2026.csv',
      type: 'File',
      stream: Readable.from([Buffer.from(csv, 'utf8')]),
      drain: async () => {},
    }
  }
}

function createService(options: {
  autosStatus?: number
  autosCsv?: string
  embargoStatus?: number
  embargoCsv?: string
  zipReader?: IbamaZipReader
} = {}) {
  const calls: string[] = []
  const service = new IbamaService({
    fetchImpl: async (input) => {
      const url = String(input)
      calls.push(url)
      if (url === IBAMA_SOURCE_URLS.autos) {
        return new Response('mock zip', { status: options.autosStatus ?? 200 })
      }
      return new Response(options.embargoCsv ?? emptyEmbargoCsv, {
        status: options.embargoStatus ?? 200,
      })
    },
    zipReader: options.zipReader ?? zipReaderFor(options.autosCsv ?? emptyAutosCsv),
    timeoutMs: 20,
    successCacheTtlMs: 1_000,
    errorCacheTtlMs: 100,
  })

  return { service, calls }
}

test('Autos SUCCESS encontra CNPJ normalizado; ausência em Embargos resulta NÃO', async () => {
  const { service } = createService({ autosCsv, embargoCsv: emptyEmbargoCsv })
  const [result] = await service.lookup([MATCHED_CNPJ])

  assert.equal(result?.ibama_auto_infracao, 'SIM')
  assert.equal(result?.status_ibama_auto, 'SUCCESS')
  assert.equal(result?.ibama_embargo, 'NÃO')
  assert.equal(result?.status_ibama_embargo, 'SUCCESS')
  assert.equal(result?.resultado_ambiental, 'SIM')
})

test('Autos e Embargos SUCCESS sem evidência retornam NÃO', async () => {
  const { service } = createService()
  const [result] = await service.lookup([SECOND_CNPJ])

  assert.equal(result?.ibama_auto_infracao, 'NÃO')
  assert.equal(result?.ibama_embargo, 'NÃO')
  assert.equal(result?.resultado_ambiental, 'NÃO')
})

test('Embargos SUCCESS encontra CNPJ com máscara normalizado', async () => {
  const { service } = createService({
    autosCsv: emptyAutosCsv,
    embargoCsv,
  })
  const [result] = await service.lookup(['11.222.333/0001-81'])

  assert.equal(result?.ibama_auto_infracao, 'NÃO')
  assert.equal(result?.ibama_embargo, 'SIM')
  assert.equal(result?.resultado_ambiental, 'SIM')
})

test('Autos ERROR com Embargos NÃO consolida em NÃO conforme o Master Plan', async () => {
  const { service } = createService({ autosStatus: 503, embargoCsv: emptyEmbargoCsv })
  const [result] = await service.lookup([SECOND_CNPJ])

  assert.equal(result?.status_ibama_auto, 'ERROR')
  assert.equal(result?.ibama_auto_infracao, 'NA')
  assert.equal(result?.status_ibama_embargo, 'SUCCESS')
  assert.equal(result?.ibama_embargo, 'NÃO')
  assert.equal(result?.resultado_ambiental, 'NÃO')
})

test('Embargos ERROR com Autos NÃO consolida em NÃO', async () => {
  const { service } = createService({
    autosCsv: emptyAutosCsv,
    embargoStatus: 503,
  })
  const [result] = await service.lookup([SECOND_CNPJ])

  assert.equal(result?.status_ibama_auto, 'SUCCESS')
  assert.equal(result?.ibama_auto_infracao, 'NÃO')
  assert.equal(result?.status_ibama_embargo, 'ERROR')
  assert.equal(result?.ibama_embargo, 'NA')
  assert.equal(result?.resultado_ambiental, 'NÃO')
})

test('ambas as fontes ERROR produzem ambiental NA', async () => {
  const { service } = createService({ autosStatus: 503, embargoStatus: 502 })
  const [result] = await service.lookup([MATCHED_CNPJ])

  assert.equal(result?.status_ibama_auto, 'ERROR')
  assert.equal(result?.status_ibama_embargo, 'ERROR')
  assert.equal(result?.ibama_auto_infracao, 'NA')
  assert.equal(result?.ibama_embargo, 'NA')
  assert.equal(result?.resultado_ambiental, 'NA')
})

test('evidência positiva preserva SIM mesmo quando a outra fonte falha', async () => {
  const { service } = createService({ autosStatus: 503, embargoCsv })
  const [result] = await service.lookup([MATCHED_CNPJ])

  assert.equal(result?.status_ibama_auto, 'ERROR')
  assert.equal(result?.ibama_embargo, 'SIM')
  assert.equal(result?.resultado_ambiental, 'SIM')
})

test('coluna CNPJ ausente transforma somente aquela fonte em ERROR/NA', async () => {
  const { service } = createService({
    autosCsv: 'OUTRA_COLUNA;VALOR\n1;2',
    embargoCsv,
  })
  const [result] = await service.lookup([MATCHED_CNPJ])

  assert.equal(result?.status_ibama_auto, 'ERROR')
  assert.equal(result?.ibama_auto_infracao, 'NA')
  assert.equal(result?.status_ibama_embargo, 'SUCCESS')
  assert.equal(result?.ibama_embargo, 'SIM')
})

test('CSV com estrutura inválida transforma a fonte em ERROR/NA', async () => {
  const { service } = createService({
    autosCsv: 'SEQ_AUTO_INFRACAO;CPF_CNPJ_INFRATOR\n1;123;extra',
  })
  const [result] = await service.lookup([MATCHED_CNPJ])

  assert.equal(result?.status_ibama_auto, 'ERROR')
  assert.equal(result?.ibama_auto_infracao, 'NA')
})

test('ZIP inválido transforma Autos em ERROR/NA e não impede Embargos', async () => {
  const invalidZipReader: IbamaZipReader = async function* () {
    throw new Error('ZIP inválido')
  }
  const { service } = createService({ zipReader: invalidZipReader, embargoCsv })
  const [result] = await service.lookup([MATCHED_CNPJ])

  assert.equal(result?.status_ibama_auto, 'ERROR')
  assert.equal(result?.ibama_auto_infracao, 'NA')
  assert.equal(result?.ibama_embargo, 'SIM')
  assert.equal(result?.resultado_ambiental, 'SIM')
})

test('HTTP error de uma fonte é independente do resultado da outra', async () => {
  const { service } = createService({ embargoStatus: 503 })
  const [result] = await service.lookup([SECOND_CNPJ])

  assert.equal(result?.status_ibama_auto, 'SUCCESS')
  assert.equal(result?.ibama_auto_infracao, 'NÃO')
  assert.equal(result?.status_ibama_embargo, 'ERROR')
  assert.equal(result?.resultado_ambiental, 'NÃO')
})

test('cache reutiliza índices e os recarrega após expirar', async () => {
  let now = 0
  const calls: string[] = []
  const service = new IbamaService({
    now: () => now,
    successCacheTtlMs: 100,
    fetchImpl: async (input) => {
      const url = String(input)
      calls.push(url)
      return url === IBAMA_SOURCE_URLS.autos
        ? new Response('zip')
        : new Response(emptyEmbargoCsv)
    },
    zipReader: zipReaderFor(emptyAutosCsv),
  })

  await service.lookup([MATCHED_CNPJ])
  await service.lookup([SECOND_CNPJ])
  assert.equal(calls.length, 2)

  now = 101
  await service.lookup([MATCHED_CNPJ])
  assert.equal(calls.length, 4)
})

test('CNPJ inválido não inicia download e duplicados geram uma única resposta', async () => {
  const { service, calls } = createService()

  await assert.rejects(service.lookup(['11222333000191']), /somente CNPJs válidos/)
  assert.equal(calls.length, 0)

  const results = await service.lookup(['11.222.333/0001-81', MATCHED_CNPJ])
  assert.equal(results.length, 1)
  assert.equal(results[0]?.cnpj, MATCHED_CNPJ)
})

test('consolidação segue a regra do Master Plan para os estados explícitos', () => {
  assert.equal(
    consolidateEnvironmentalResult(
      { status: 'ERROR', result: 'NA' },
      { status: 'SUCCESS', result: 'NÃO' },
    ),
    'NÃO',
  )
  assert.equal(
    consolidateEnvironmentalResult(
      { status: 'ERROR', result: 'NA' },
      { status: 'ERROR', result: 'NA' },
    ),
    'NA',
  )
})