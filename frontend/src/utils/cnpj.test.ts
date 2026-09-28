import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeCnpj, parseCnpjLines } from './cnpj.ts'

test('normaliza identificadores removendo caracteres não numéricos', () => {
  assert.equal(normalizeCnpj('  12.345.678/0001-90  '), '12345678000190')
})

test('aceita CNPJ válido com máscara', () => {
  const batch = parseCnpjLines('11.222.333/0001-81')

  assert.equal(batch.valid[0]?.cnpj, '11222333000181')
  assert.equal(batch.valid.length, 1)
})

test('aceita CNPJ válido sem máscara', () => {
  const batch = parseCnpjLines('11222333000181')

  assert.equal(batch.valid[0]?.cnpj, '11222333000181')
  assert.equal(batch.invalid.length, 0)
})

test('rejeita dígitos verificadores inválidos', () => {
  const batch = parseCnpjLines('11222333000180')

  assert.equal(batch.invalid[0]?.reason, 'Segundo dígito verificador inválido.')
})

test('rejeita quantidade diferente de 14 dígitos', () => {
  const batch = parseCnpjLines('123')

  assert.equal(batch.invalid[0]?.cnpj, '123')
  assert.match(batch.invalid[0]?.reason ?? '', /esperado: 14/)
})

test('ignora linhas vazias e conta apenas entradas preenchidas', () => {
  const batch = parseCnpjLines('\n  \n11222333000181\n')

  assert.equal(batch.informedCount, 1)
  assert.equal(batch.valid.length, 1)
})

test('rejeita texto sem números', () => {
  const batch = parseCnpjLines('empresa sem cadastro')

  assert.equal(batch.invalid[0]?.cnpj, '')
  assert.equal(batch.invalid[0]?.reason, 'A entrada não contém dígitos.')
})

test('remove duplicado com máscara e sem máscara', () => {
  const batch = parseCnpjLines('11.222.333/0001-81\n11222333000181')

  assert.equal(batch.valid.length, 1)
  assert.equal(batch.duplicates.length, 1)
  assert.equal(batch.duplicates[0]?.cnpj, '11222333000181')
})

test('remove CNPJ duplicado idêntico', () => {
  const batch = parseCnpjLines('11222333000181\n11222333000181')

  assert.equal(batch.valid.length, 1)
  assert.equal(batch.duplicates.length, 1)
})

test('identifica falha no primeiro dígito verificador', () => {
  const batch = parseCnpjLines('11222333000191')

  assert.equal(batch.invalid[0]?.reason, 'Primeiro dígito verificador inválido.')
})

test('identifica falha no segundo dígito verificador', () => {
  const batch = parseCnpjLines('11222333000182')

  assert.equal(batch.invalid[0]?.reason, 'Segundo dígito verificador inválido.')
})

test('remove caracteres não numéricos antes da validação', () => {
  const batch = parseCnpjLines('CNPJ: 11.222.333/0001-81')

  assert.equal(batch.valid[0]?.cnpj, '11222333000181')
})