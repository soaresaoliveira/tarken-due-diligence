export type CnpjEntry = {
  original: string
  cnpj: string
  status: 'valid' | 'invalid' | 'duplicate'
  reason?: string
}

export type CnpjBatch = {
  informedCount: number
  entries: CnpjEntry[]
  valid: CnpjEntry[]
  invalid: CnpjEntry[]
  duplicates: CnpjEntry[]
}

const FIRST_DIGIT_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const SECOND_DIGIT_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

function calculateDigit(base: string, weights: number[]) {
  const sum = weights.reduce(
    (total, weight, index) => total + Number(base[index]) * weight,
    0,
  )
  const remainder = sum % 11

  return remainder < 2 ? 0 : 11 - remainder
}

export function validateNormalizedCnpj(cnpj: string): string | undefined {
  if (!/^\d{14}$/.test(cnpj)) {
    return `Quantidade inválida de dígitos: ${cnpj.length}; esperado: 14.`
  }

  if (/^(\d)\1{13}$/.test(cnpj)) {
    return 'CNPJ com todos os dígitos iguais é inválido.'
  }

  if (Number(cnpj[12]) !== calculateDigit(cnpj.slice(0, 12), FIRST_DIGIT_WEIGHTS)) {
    return 'Primeiro dígito verificador inválido.'
  }

  if (Number(cnpj[13]) !== calculateDigit(cnpj.slice(0, 13), SECOND_DIGIT_WEIGHTS)) {
    return 'Segundo dígito verificador inválido.'
  }

  return undefined
}

export function parseCnpjLines(input: string): CnpjBatch {
  const entries: CnpjEntry[] = []
  const valid: CnpjEntry[] = []
  const invalid: CnpjEntry[] = []
  const duplicates: CnpjEntry[] = []
  const seen = new Set<string>()
  let informedCount = 0

  for (const line of input.split(/\r?\n/)) {
    const original = line.trim()
    if (!original) continue

    informedCount += 1
    const cnpj = original.replace(/\D/g, '')

    if (!cnpj) {
      const entry: CnpjEntry = {
        original,
        cnpj,
        status: 'invalid',
        reason: 'A entrada não contém dígitos.',
      }
      entries.push(entry)
      invalid.push(entry)
      continue
    }

    if (seen.has(cnpj)) {
      const entry: CnpjEntry = {
        original,
        cnpj,
        status: 'duplicate',
        reason: 'CNPJ duplicado após a normalização; ocorrência removida.',
      }
      entries.push(entry)
      duplicates.push(entry)
      continue
    }

    seen.add(cnpj)
    const reason = validateNormalizedCnpj(cnpj)

    if (reason) {
      const entry: CnpjEntry = { original, cnpj, status: 'invalid', reason }
      entries.push(entry)
      invalid.push(entry)
    } else {
      const entry: CnpjEntry = { original, cnpj, status: 'valid' }
      entries.push(entry)
      valid.push(entry)
    }
  }

  return { informedCount, entries, valid, invalid, duplicates }
}