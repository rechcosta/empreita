import { Labor, LaborItem, LaborFixedItem, LaborUnitItem, LaborSqmItem } from '@/types'

/** Returns true when there is at least one item of type "fixo" in the list. */
export function hasFixedItems(items: LaborItem[]): boolean {
  return items.some((i) => i.type === 'fixo')
}

/**
 * Sums the individual `itemValue` of fixed items. Items without `itemValue`
 * (null/undefined) contribute zero — they are covered only by the group's
 * shared value (`fixedGroupValue`).
 */
export function sumFixedItemValues(items: LaborItem[]): number {
  return items
    .filter((i): i is LaborFixedItem => i.type === 'fixo')
    .reduce((s, i) => s + (i.itemValue ?? 0), 0)
}

/** Sums "por_unidade" items' subtotals. */
export function sumUnitItems(items: LaborItem[]): number {
  return items
    .filter((i): i is LaborUnitItem => i.type === 'por_unidade')
    .reduce((s, i) => s + (i.subtotal ?? 0), 0)
}

/** Sums "por_m2" items' subtotals. */
export function sumSqmItems(items: LaborItem[]): number {
  return items
    .filter((i): i is LaborSqmItem => i.type === 'por_m2')
    .reduce((s, i) => s + (i.subtotal ?? 0), 0)
}

/**
 * Canonical labor total formula:
 *   total = (fixedGroupValue ?? 0)
 *         + Σ (itemValue of fixed items)
 *         + Σ (subtotal of por_unidade items)
 *         + Σ (subtotal of por_m2 items)
 *
 * Fixed items share a base (`fixedGroupValue`) and may optionally declare
 * their own `itemValue`, which is added on top of the shared base. Either
 * source can be null/empty; the group total is the sum of both.
 */
export function computeLaborTotal(labor: Labor): number {
  const fixedGroup = labor.fixedGroupValue ?? 0
  return round2(
    fixedGroup
      + sumFixedItemValues(labor.items)
      + sumUnitItems(labor.items)
      + sumSqmItems(labor.items)
  )
}

/** Subtotal calculations per item type. */
export function computeUnitSubtotal(item: { quantity: number; unitPrice: number }): number {
  return round2(item.quantity * item.unitPrice)
}

export function computeSqmSubtotal(item: { area: number; pricePerMeter: number }): number {
  return round2(item.area * item.pricePerMeter)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}