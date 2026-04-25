import { describe, it, expect } from 'vitest'
import {
  validateCNPJ,
  formatCNPJ,
  formatCurrency,
  formatCurrencyOrDash,
} from '@/lib/utils'

/**
 * Why these tests matter:
 *
 * validateCNPJ is the gatekeeper at registration. A bug here either lets
 * malformed CNPJs into the database (UX problem in the PDF later) or
 * blocks legitimate companies (revenue problem). Pinning the algorithm
 * matters more than most of what we test.
 *
 * formatCurrencyOrDash encodes a domain-critical distinction: null
 * ("not informed") vs 0 ("priced at zero"). Confusing the two changes
 * what the customer pays.
 */

describe('validateCNPJ', () => {
  describe('valid cases', () => {
    it('accepts a known-valid CNPJ without mask', () => {
      // 11.222.333/0001-81 is a well-known example from SRF documentation,
      // not a real company. DV1 = 8, DV2 = 1.
      expect(validateCNPJ('11222333000181')).toBe(true)
    })

    it('accepts the same CNPJ with full mask', () => {
      expect(validateCNPJ('11.222.333/0001-81')).toBe(true)
    })

    it('accepts another valid CNPJ', () => {
      // Generated via the reference algorithm. Independent example so a
      // bug in the first one doesn't pass undetected.
      expect(validateCNPJ('45.997.418/0001-53')).toBe(true)
    })

    it('strips any non-digit characters before validating', () => {
      // Whitespace, letters, weird punctuation — all should be tolerated
      // since formatting is a UI concern, not a validation one.
      expect(validateCNPJ(' 11.222.333/0001-81 ')).toBe(true)
      expect(validateCNPJ('11-222-333-0001-81')).toBe(true)
    })
  })

  describe('rejected by length', () => {
    it('rejects an empty string', () => {
      expect(validateCNPJ('')).toBe(false)
    })

    it('rejects fewer than 14 digits', () => {
      expect(validateCNPJ('1122233300018')).toBe(false)  // 13
    })

    it('rejects more than 14 digits', () => {
      expect(validateCNPJ('112223330001811')).toBe(false) // 15
    })
  })

  describe('rejected by repeated-digit rule', () => {
    // These pass the DV math (00...00 calc to 00) but are SRF-invalid.
    it('rejects all zeros', () => {
      expect(validateCNPJ('00000000000000')).toBe(false)
    })

    it('rejects all ones', () => {
      expect(validateCNPJ('11111111111111')).toBe(false)
    })

    it('rejects all nines', () => {
      expect(validateCNPJ('99999999999999')).toBe(false)
    })
  })

  describe('rejected by check-digit failure', () => {
    it('rejects when DV1 is wrong', () => {
      // Take the valid 11222333000181, flip the 13th digit (DV1 = 8 → 9).
      expect(validateCNPJ('11222333000191')).toBe(false)
    })

    it('rejects when DV2 is wrong', () => {
      // Flip the 14th digit (DV2 = 1 → 2).
      expect(validateCNPJ('11222333000182')).toBe(false)
    })

    it('rejects an arbitrary random-looking CNPJ', () => {
      // Random 14-digit string that's overwhelmingly likely to fail DV math.
      expect(validateCNPJ('12345678901234')).toBe(false)
    })
  })
})

describe('formatCNPJ', () => {
  it('progressively applies the mask as the user types', () => {
    // The form calls formatCNPJ on every keystroke. The mask must apply
    // partially; a half-typed value should still look right.
    expect(formatCNPJ('11')).toBe('11')
    expect(formatCNPJ('11222')).toBe('11.222')
    expect(formatCNPJ('11222333')).toBe('11.222.333')
    expect(formatCNPJ('112223330001')).toBe('11.222.333/0001')
    expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81')
  })

  it('strips non-digit characters before applying the mask', () => {
    expect(formatCNPJ('abc11.222def')).toBe('11.222')
  })

  it('caps the input at 14 digits even if more are typed', () => {
    expect(formatCNPJ('112223330001811234')).toBe('11.222.333/0001-81')
  })
})

describe('formatCurrency', () => {
  it('renders BRL with comma decimal and dot thousands', () => {
    // Intl uses a non-breaking space between R$ and the number — we don't
    // assert the exact whitespace because that's implementation detail of
    // the Node ICU build. We do assert the parts we care about.
    const result = formatCurrency(1234.5)
    expect(result).toContain('R$')
    expect(result).toContain('1.234,50')
  })

  it('renders zero correctly', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0,00')
  })
})

describe('formatCurrencyOrDash', () => {
  // This is the function that encodes the null-vs-zero distinction visible
  // in the PDF and the form. Worth pinning down.

  it('renders null as an em-dash, not as zero', () => {
    expect(formatCurrencyOrDash(null)).toBe('—')
  })

  it('renders undefined as an em-dash too', () => {
    // The API may send undefined for optional fields; same UX as null.
    expect(formatCurrencyOrDash(undefined)).toBe('—')
  })

  it('renders 0 as R$ 0,00 — a valid price, not a missing one', () => {
    // The crucial domain distinction: zero is a real price (donated
    // material, free service) and must not collapse into the "not
    // informed" state.
    const result = formatCurrencyOrDash(0)
    expect(result).toContain('0,00')
    expect(result).not.toBe('—')
  })

  it('renders normal positive values as currency', () => {
    expect(formatCurrencyOrDash(100)).toContain('100,00')
  })
})