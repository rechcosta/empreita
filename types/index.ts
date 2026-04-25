export type UnitType = 'unidade' | 'm3' | 'kg'
export type LaborItemType = 'fixo' | 'por_unidade' | 'por_m2'

export interface Material {
  _id?: string
  name: string
  unit: UnitType
  quantity: number
  /** null when price was not informed; zero is a valid price (e.g., donated material). */
  unitPrice: number | null
  /** null when unitPrice is null — UI/PDF must render "—" in this case. */
  total: number | null
}

/**
 * Item de preço fixo: descrição obrigatória + valor individual opcional.
 *
 * - Sem `itemValue` (null/undefined): item é coberto apenas pelo valor
 *   compartilhado do grupo (`labor.fixedGroupValue`).
 * - Com `itemValue`: o valor soma ao valor compartilhado no total do grupo
 *   de preço fixo.
 *
 * Zero é um valor válido (item listado sem custo específico) e distinto de
 * null (valor não informado).
 */
export interface LaborFixedItem {
  type: 'fixo'
  description: string
  itemValue?: number | null
}

/** Item por unidade: descrição + quantidade × valor unitário. */
export interface LaborUnitItem {
  type: 'por_unidade'
  description: string
  quantity: number
  unitPrice: number
  subtotal: number
}

/** Item por m²: descrição + área × valor por m². */
export interface LaborSqmItem {
  type: 'por_m2'
  description: string
  area: number
  pricePerMeter: number
  subtotal: number
}

export type LaborItem = LaborFixedItem | LaborUnitItem | LaborSqmItem

export interface Labor {
  items: LaborItem[]
  /**
   * Valor compartilhado entre os itens de preço fixo. Opcional:
   * - null quando não há nenhum item do tipo "fixo" na lista;
   * - também pode ser null (ou zero) quando todos os itens fixos usam apenas
   *   seus valores individuais (`itemValue`).
   */
  fixedGroupValue: number | null
  /**
   * Fórmula canônica:
   *   total = (fixedGroupValue ?? 0)
   *         + Σ (itemValue dos itens fixos)
   *         + Σ (subtotal dos itens por_unidade)
   *         + Σ (subtotal dos itens por_m2)
   */
  total: number
}

export interface Orcamento {
  _id?: string
  userId?: string
  /**
   * Per-account sequential number, formatted in the PDF as `ORC-{padded}`.
   * Optional because documents created before the counter existed don't
   * have it — the PDF generator falls back to an ObjectId-derived format.
   */
  number?: number
  clientName: string
  clientAddress: string
  serviceName: string
  materials: Material[]
  labor: Labor
  /** Sum of materials with total !== null. Materials without price are excluded. */
  materialsTotal: number
  grandTotal: number
  createdAt?: string
  updatedAt?: string
}

export interface CompanyInfo {
  companyName: string
  cnpj: string
  logoBase64?: string
  email: string
}