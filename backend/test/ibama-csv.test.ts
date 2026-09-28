import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import { indexCnpjsFromCsv } from '../src/ibama-csv.ts'

function csvStream(value: string) {
  return Readable.from([Buffer.from(value, 'utf8')])
}

test('indexa CNPJs normalizados em CSV delimitado por ponto e vírgula', async () => {
  const csv = [
    'CPF_CNPJ_INFRATOR;DESCRICAO',
    '"07.161.332/0001-05";"Texto com; separador"',
    '02330709234;CPF não deve ser indexado',
    '07161332000105;Duplicado após normalização',
    ';Sem identificador',
  ].join('\n')

  const index = await indexCnpjsFromCsv(csvStream(csv), 'CPF_CNPJ_INFRATOR')

  assert.deepEqual([...index], ['07161332000105'])
})

test('falha claramente quando a coluna CNPJ não existe', async () => {
  await assert.rejects(
    indexCnpjsFromCsv(csvStream('OUTRA_COLUNA;VALOR\nabc;123'), 'CPF_CNPJ_INFRATOR'),
    /Coluna de identificador ausente/,
  )
})

test('falha para CSV com quantidade de campos inconsistente', async () => {
  await assert.rejects(
    indexCnpjsFromCsv(csvStream('CPF_CNPJ_INFRATOR;DESCRICAO\n123;um;dois'), 'CPF_CNPJ_INFRATOR'),
  )
})

test('falha para bytes que não formam UTF-8 válido', async () => {
  await assert.rejects(
    indexCnpjsFromCsv(Readable.from([Buffer.from([0xff, 0xfe, 0x41])]), 'CPF_CNPJ_INFRATOR'),
    /encoded data|encoding/i,
  )
})

test('aceita geometria WKT superior ao limite CSV padrão', async () => {
  const geometry = 'x'.repeat(1_500_000)
  const index = await indexCnpjsFromCsv(
    csvStream(`CPF_CNPJ_EMBARGADO;WKT_GEOM\n12345678000195;${geometry}`),
    'CPF_CNPJ_EMBARGADO',
  )

  assert.deepEqual([...index], ['12345678000195'])
})