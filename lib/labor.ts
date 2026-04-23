import { Labor, LaborItem, LaborUnitItem, LaborSqmItem } from '@/types'

/** Returns true when there is at least one item of type "fixo" in the list. */
export function hasFixedItems(items: LaborItem[]): boolean {
  return items.some((i) => i.type === 'fixo')
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
 *   total = (fixedGroupValue ?? 0) + sum(por_unidade) + sum(por_m2)
 * Fixed items share a single value (`fixedGroupValue`), which is null
 * when there are no fixed items in the list.
 */
export function computeLaborTotal(labor: Labor): number {
  const fixed = labor.fixedGroupValue ?? 0
  return round2(fixed + sumUnitItems(labor.items) + sumSqmItems(labor.items))
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