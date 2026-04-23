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

/** Item de preço fixo: apenas descrição, sem valor individual (compartilham labor.fixedGroupValue). */
export interface LaborFixedItem {
  type: 'fixo'
  description: string
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
   * Valor único que cobre TODOS os itens de preço fixo.
   * null quando não há nenhum item do tipo "fixo" na lista.
   */
  fixedGroupValue: number | null
  /** Sum: (fixedGroupValue ?? 0) + sum(por_unidade subtotals) + sum(por_m2 subtotals). */
  total: number
}

export interface Orcamento {
  _id?: string
  userId?: string
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