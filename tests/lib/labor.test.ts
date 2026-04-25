import { describe, it, expect } from 'vitest'
import {
  computeLaborTotal,
  computeUnitSubtotal,
  computeSqmSubtotal,
  hasFixedItems,
  sumFixedItemValues,
  sumUnitItems,
  sumSqmItems,
} from '@/lib/labor'
import { Labor, LaborItem } from '@/types'

/**
 * Why these tests matter:
 *
 * The labor total is the most consequential calculation in the product —
 * it directly determines what the customer pays. The formula has three
 * sources that combine, plus the subtle case of "fixed item without
 * itemValue" (covered only by the shared group), which is easy to mis-handle
 * during a refactor. These tests pin down the canonical behavior so the
 * formula can't drift silently.
 */

// ────────────────────────────────────────────────────────────────
// Helpers — keep test bodies focused on the case under test, not on
// boilerplate construction of items.

function fixed(description: string, itemValue?: number | null): LaborItem {
  return { type: 'fixo', description, itemValue: itemValue ?? null }
}

function unit(description: string, quantity: number, unitPrice: number): LaborItem {
  return {
    type: 'por_unidade',
    description,
    quantity,
    unitPrice,
    subtotal: computeUnitSubtotal({ quantity, unitPrice }),
  }
}

function sqm(description: string, area: number, pricePerMeter: number): LaborItem {
  return {
    type: 'por_m2',
    description,
    area,
    pricePerMeter,
    subtotal: computeSqmSubtotal({ area, pricePerMeter }),
  }
}

function labor(items: LaborItem[], fixedGroupValue: number | null = null): Labor {
  const l: Labor = { items, fixedGroupValue, total: 0 }
  l.total = computeLaborTotal(l)
  return l
}

// ────────────────────────────────────────────────────────────────

describe('computeLaborTotal', () => {
  it('returns 0 for an empty labor', () => {
    expect(computeLaborTotal(labor([]))).toBe(0)
  })

  it('handles only fixed items covered by the shared group value', () => {
    // Two fixed items, neither with itemValue. fixedGroupValue covers both.
    const l = labor(
      [fixed('Retirar piso'), fixed('Derrubar parede')],
      3000
    )
    expect(l.total).toBe(3000)
  })

  it('handles only fixed items priced individually (no shared group)', () => {
    const l = labor(
      [fixed('A', 500), fixed('B', 800)],
      null
    )
    expect(l.total).toBe(1300)
  })

  it('combines shared group value with individual itemValues', () => {
    // This is the canonical "mixed fixed pricing" case. Both sources sum.
    const l = labor(
      [fixed('A'), fixed('B', 800)],
      3000
    )
    expect(l.total).toBe(3800)
  })

  it('treats itemValue null as 0, not as missing-and-error', () => {
    // The form sends null when the user leaves the field empty. The total
    // should compute as if that contribution were 0, not blow up.
    const l = labor([fixed('A', null), fixed('B', 100)], 0)
    expect(l.total).toBe(100)
  })

  it('treats itemValue 0 as a valid zero contribution (distinct from null)', () => {
    // 0 means "explicitly priced at zero" (e.g., bonus item).
    // Same numeric outcome as null here, but semantically different.
    const l = labor([fixed('A', 0), fixed('B', 100)], 200)
    expect(l.total).toBe(300)
  })

  it('sums por_unidade items via their subtotal field', () => {
    const l = labor([unit('Trocar tomadas', 5, 40)])
    expect(l.total).toBe(200)
  })

  it('sums por_m2 items via their subtotal field', () => {
    const l = labor([sqm('Pintura', 30, 25)])
    expect(l.total).toBe(750)
  })

  it('combines all three types in the same labor', () => {
    // The exact scenario from ARCHITECTURE.md — a useful regression anchor.
    const l = labor(
      [
        fixed('Retirar piso'),
        fixed('Derrubar parede', 800),
        sqm('Pintura', 30, 25),
        unit('Trocar tomadas', 5, 40),
      ],
      3000
    )
    expect(l.total).toBe(4750)
  })

  it('treats fixedGroupValue null as 0', () => {
    const l = labor([unit('X', 2, 10)], null)
    expect(l.total).toBe(20)
  })

  it('rounds the final total to 2 decimal places', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754. The product expects
    // currency precision, not float drift.
    const l = labor([fixed('A', 0.1), fixed('B', 0.2)], null)
    expect(l.total).toBe(0.3)
  })
})

describe('computeUnitSubtotal', () => {
  it('multiplies quantity by unit price', () => {
    expect(computeUnitSubtotal({ quantity: 5, unitPrice: 40 })).toBe(200)
  })

  it('rounds to 2 decimal places', () => {
    // 3 × 0.1 = 0.30000000000000004
    expect(computeUnitSubtotal({ quantity: 3, unitPrice: 0.1 })).toBe(0.3)
  })

  it('returns 0 when either factor is 0', () => {
    expect(computeUnitSubtotal({ quantity: 0, unitPrice: 100 })).toBe(0)
    expect(computeUnitSubtotal({ quantity: 5, unitPrice: 0 })).toBe(0)
  })
})

describe('computeSqmSubtotal', () => {
  it('multiplies area by price per meter', () => {
    expect(computeSqmSubtotal({ area: 30, pricePerMeter: 25 })).toBe(750)
  })

  it('handles fractional area correctly', () => {
    // 12.5 m² × 18.40 = 230.00 (no float drift after rounding).
    expect(computeSqmSubtotal({ area: 12.5, pricePerMeter: 18.4 })).toBe(230)
  })
})

describe('hasFixedItems', () => {
  it('is false for an empty list', () => {
    expect(hasFixedItems([])).toBe(false)
  })

  it('is false when no item is type "fixo"', () => {
    expect(hasFixedItems([unit('X', 1, 10), sqm('Y', 1, 10)])).toBe(false)
  })

  it('is true when at least one item is type "fixo"', () => {
    expect(hasFixedItems([unit('X', 1, 10), fixed('Y')])).toBe(true)
  })
})

describe('sumFixedItemValues', () => {
  it('returns 0 for items without itemValue', () => {
    expect(sumFixedItemValues([fixed('A'), fixed('B')])).toBe(0)
  })

  it('sums only the itemValue of fixed items, ignoring other types', () => {
    const items: LaborItem[] = [
      fixed('A', 100),
      unit('B', 5, 40), // 200 — must NOT be counted here
      fixed('C', 250),
      sqm('D', 10, 5), // 50 — must NOT be counted here
    ]
    expect(sumFixedItemValues(items)).toBe(350)
  })
})

describe('sumUnitItems', () => {
  it('sums por_unidade subtotals only', () => {
    const items: LaborItem[] = [
      unit('A', 2, 10),  // 20
      unit('B', 3, 10),  // 30
      fixed('C', 999),   // not counted
      sqm('D', 5, 5),    // not counted
    ]
    expect(sumUnitItems(items)).toBe(50)
  })

  it('treats undefined subtotal defensively as 0', () => {
    // Defensive: malformed item from elsewhere shouldn't make the whole
    // total NaN. computeLaborTotal calling sumUnitItems must stay safe.
    const items: LaborItem[] = [
      // Bypass the helper to construct a malformed item on purpose.
      { type: 'por_unidade', description: 'broken', quantity: 1, unitPrice: 10 } as LaborItem,
    ]
    expect(sumUnitItems(items)).toBe(0)
  })
})

describe('sumSqmItems', () => {
  it('sums por_m2 subtotals only', () => {
    const items: LaborItem[] = [
      sqm('A', 10, 5),  // 50
      sqm('B', 4, 25),  // 100
      fixed('C', 999),  // not counted
      unit('D', 1, 1),  // not counted
    ]
    expect(sumSqmItems(items)).toBe(150)
  })
})