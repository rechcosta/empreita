import { describe, it, expect } from 'vitest'
import {
  addDays,
  addMonths,
  snapToNextFriday,
  lastFridayOfMonth,
  computeNextPaymentDate,
  computeFirstPaymentDate,
  computeNetPayment,
  computeDailyBase,
  computeDailyRate,
} from '@/lib/payroll'

/**
 * Why these tests matter:
 *
 * The payroll module encodes the two financial rules a payment depends on:
 *
 *  1. computeNextPaymentDate — drives the automatic cycle close. A bug pays
 *     a weekly worker on the wrong week or skips a monthly cycle entirely.
 *  2. computeNetPayment — the canonical "Valor Líquido = Salário Base −
 *     Adiantamentos − Dívidas" formula. This is exactly the kind of silent
 *     calculation bug that overpays or underpays a real person.
 *
 * Following the project convention, these pure functions get a mirrored test
 * file so the formulas can't drift during a refactor.
 */

describe('addDays / addMonths', () => {
  it('adds days without mutating the input', () => {
    const base = new Date('2026-06-18T00:00:00')
    const out = addDays(base, 7)
    expect(out.toISOString().slice(0, 10)).toBe('2026-06-25')
    // input untouched
    expect(base.toISOString().slice(0, 10)).toBe('2026-06-18')
  })

  it('adds months, clamping to the last day when the day overflows', () => {
    // 31 Jan + 1 month → Feb has no 31st → clamp to 28 (2026 not leap).
    const out = addMonths(new Date('2026-01-31T00:00:00'), 1)
    expect(out.getMonth()).toBe(1) // February
    expect(out.getDate()).toBe(28)
  })

  it('adds months normally when the day exists in the target month', () => {
    const out = addMonths(new Date('2026-06-15T00:00:00'), 1)
    expect(out.toISOString().slice(0, 10)).toBe('2026-07-15')
  })
})

describe('snapToNextFriday', () => {
  it('keeps the date when it is already a Friday', () => {
    const friday = new Date('2026-06-19T00:00:00') // Friday
    expect(snapToNextFriday(friday).toISOString().slice(0, 10)).toBe('2026-06-19')
  })

  it('advances a Thursday to the next day (Friday)', () => {
    const thursday = new Date('2026-06-18T00:00:00')
    expect(snapToNextFriday(thursday).toISOString().slice(0, 10)).toBe('2026-06-19')
  })

  it('advances a Saturday forward to the next Friday', () => {
    const saturday = new Date('2026-06-20T00:00:00')
    expect(snapToNextFriday(saturday).toISOString().slice(0, 10)).toBe('2026-06-26')
  })
})

describe('lastFridayOfMonth', () => {
  it('junho/2026 → 26/06 (sexta)', () => {
    const d = lastFridayOfMonth(2026, 5) // monthIndex 5 = junho
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-26')
    expect(d.getDay()).toBe(5)
  })

  it('julho/2026 → 31/07 (o último dia já é sexta)', () => {
    expect(lastFridayOfMonth(2026, 6).toISOString().slice(0, 10)).toBe('2026-07-31')
  })

  it('agosto/2026 → 28/08', () => {
    expect(lastFridayOfMonth(2026, 7).toISOString().slice(0, 10)).toBe('2026-08-28')
  })
})

describe('computeNextPaymentDate (avanço de ciclo ao pagar)', () => {
  const from = new Date('2026-06-18T00:00:00') // a Thursday

  // Toda previsão deve cair numa sexta-feira, qualquer que seja o tipo.
  it('always lands on a Friday', () => {
    for (const t of ['diario', 'semanal', 'quinzenal', 'mensal'] as const) {
      expect(computeNextPaymentDate(t, from).getDay()).toBe(5)
    }
  })

  it('diário → próximo dia, ajustado para sexta', () => {
    expect(computeNextPaymentDate('diario', from).toISOString().slice(0, 10)).toBe('2026-06-19')
  })

  it('semanal → +7 dias, ajustado para sexta', () => {
    expect(computeNextPaymentDate('semanal', from).toISOString().slice(0, 10)).toBe('2026-06-26')
  })

  it('quinzenal → +14 dias, ajustado para sexta', () => {
    expect(computeNextPaymentDate('quinzenal', from).toISOString().slice(0, 10)).toBe('2026-07-03')
  })

  it('mensal → última sexta do mês SEGUINTE', () => {
    // from em junho → mês seguinte julho → última sexta = 31/07.
    expect(computeNextPaymentDate('mensal', from).toISOString().slice(0, 10)).toBe('2026-07-31')
  })

  it('caso do usuário: pagar competência 24/07 (mensal) agenda 28/08', () => {
    const scheduled = new Date('2026-07-24T00:00:00')
    expect(computeNextPaymentDate('mensal', scheduled).toISOString().slice(0, 10)).toBe('2026-08-28')
  })

  it('mantém cadência semanal de sexta a sexta no fechamento do ciclo', () => {
    const friday = new Date('2026-06-19T00:00:00')
    const next = computeNextPaymentDate('semanal', friday)
    expect(next.toISOString().slice(0, 10)).toBe('2026-06-26')
    expect(next.getDay()).toBe(5)
  })
})

describe('computeFirstPaymentDate (criação / auto-cura)', () => {
  it('mensal → última sexta deste mês quando ainda no futuro', () => {
    // 18/06: última sexta de junho (26/06) ainda está à frente.
    const from = new Date('2026-06-18T00:00:00')
    expect(computeFirstPaymentDate('mensal', from).toISOString().slice(0, 10)).toBe('2026-06-26')
  })

  it('mensal → última sexta do mês seguinte quando a deste mês já passou', () => {
    // 29/06 é depois de 26/06 → vai para julho (31/07).
    const from = new Date('2026-06-29T00:00:00')
    expect(computeFirstPaymentDate('mensal', from).toISOString().slice(0, 10)).toBe('2026-07-31')
  })

  it('semanal/diário → próxima sexta', () => {
    const from = new Date('2026-06-18T00:00:00') // quinta
    expect(computeFirstPaymentDate('semanal', from).toISOString().slice(0, 10)).toBe('2026-06-19')
    expect(computeFirstPaymentDate('diario', from).toISOString().slice(0, 10)).toBe('2026-06-19')
  })
})

describe('computeDailyRate (valor de um dia — dias úteis)', () => {
  it('diário → o próprio valor', () => {
    expect(computeDailyRate('diario', 120)).toBe(120)
  })
  it('semanal → ÷ 5', () => {
    expect(computeDailyRate('semanal', 500)).toBe(100)
  })
  it('quinzenal → ÷ 10', () => {
    expect(computeDailyRate('quinzenal', 1000)).toBe(100)
  })
  it('mensal → ÷ 22', () => {
    expect(computeDailyRate('mensal', 2200)).toBe(100)
  })
  it('arredonda para 2 casas', () => {
    expect(computeDailyRate('mensal', 3000)).toBe(136.36)
  })
})

describe('desconto de falta (mensal): salário − faltas × diária', () => {
  it('mensal 2200, 2 faltas (diária 100) → base 2000', () => {
    const dr = computeDailyRate('mensal', 2200) // 100 (÷ 22 dias úteis)
    const base = Math.max(0, 2200 - 2 * dr)
    const r = computeNetPayment({ baseSalary: base, pendingAdvances: 0, pendingDebts: 0 })
    expect(dr).toBe(100)
    expect(r.netAmount).toBe(2000)
  })
})

describe('computeDailyBase', () => {
  it('acumula o valor da diária por dias trabalhados', () => {
    // Carlos: diária R$120, 5 dias → R$600.
    expect(computeDailyBase(120, 5)).toBe(600)
  })

  it('zero dias trabalhados → zero', () => {
    expect(computeDailyBase(120, 0)).toBe(0)
  })

  it('arredonda para 2 casas', () => {
    expect(computeDailyBase(33.33, 3)).toBe(99.99)
  })
})

describe('computeNetPayment (diarista usa a base acumulada)', () => {
  it('5 dias × 120 = 600, menos 100 de adiantamento = 500', () => {
    const base = computeDailyBase(120, 5)
    const r = computeNetPayment({ baseSalary: base, pendingAdvances: 100, pendingDebts: 0 })
    expect(r.baseSalary).toBe(600)
    expect(r.netAmount).toBe(500)
  })
})

describe('computeNetPayment', () => {
  it('matches the spec example: 600 − 100 − 50 = 450', () => {
    const r = computeNetPayment({ baseSalary: 600, pendingAdvances: 100, pendingDebts: 50 })
    expect(r.totalDiscounts).toBe(150)
    expect(r.netAmount).toBe(450)
  })

  it('returns the full salary when there are no discounts', () => {
    const r = computeNetPayment({ baseSalary: 2500, pendingAdvances: 0, pendingDebts: 0 })
    expect(r.netAmount).toBe(2500)
  })

  it('floors the net at 0 when discounts exceed the salary', () => {
    const r = computeNetPayment({ baseSalary: 500, pendingAdvances: 400, pendingDebts: 200 })
    expect(r.totalDiscounts).toBe(600)
    expect(r.netAmount).toBe(0) // never negative
  })

  it('rounds to two decimals, resisting float drift', () => {
    const r = computeNetPayment({ baseSalary: 100.1, pendingAdvances: 0.2, pendingDebts: 0 })
    expect(r.netAmount).toBe(99.9)
  })

  it('separates advances and debts in the breakdown', () => {
    const r = computeNetPayment({ baseSalary: 1000, pendingAdvances: 120, pendingDebts: 80 })
    expect(r.advancesDiscounted).toBe(120)
    expect(r.debtsDiscounted).toBe(80)
    expect(r.netAmount).toBe(800)
  })
})
