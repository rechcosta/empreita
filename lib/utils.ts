export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Formats a price for display. When the value is null/undefined
 * (user didn't inform the price), renders "—" instead of R$ 0,00.
 */
export function formatCurrencyOrDash(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return formatCurrency(value)
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr))
}

export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/**
 * Validates a Brazilian CNPJ.
 *
 * Rules applied (in order):
 * 1. Must have exactly 14 digits after stripping non-digits.
 * 2. Cannot be a sequence of identical digits (00000000000000, 11111111111111, …).
 *    These pass the DV math but are invalid by SRF convention.
 * 3. The two check digits (DV1, DV2) must match the standard CNPJ algorithm.
 *
 * Algorithm:
 *   DV1 = mod11 of (sum of first 12 digits × weights [5,4,3,2,9,8,7,6,5,4,3,2])
 *   DV2 = mod11 of (sum of first 13 digits × weights [6,5,4,3,2,9,8,7,6,5,4,3,2])
 *   where mod11(x) = (x % 11 < 2) ? 0 : 11 - (x % 11)
 */
export function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')

  if (digits.length !== 14) return false
  if (/^(\d)\1+$/.test(digits)) return false

  const calcCheckDigit = (base: string, weights: number[]): number => {
    const sum = weights.reduce(
      (acc, weight, i) => acc + parseInt(base[i], 10) * weight,
      0
    )
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const dv1 = calcCheckDigit(digits.slice(0, 12), weights1)
  if (dv1 !== parseInt(digits[12], 10)) return false

  const dv2 = calcCheckDigit(digits.slice(0, 13), weights2)
  if (dv2 !== parseInt(digits[13], 10)) return false

  return true
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}