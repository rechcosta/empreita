import { Orcamento, ReciboItem } from '@/types'

/**
 * Converte um valor opcional para número, tratando null/undefined, string
 * vazia/em branco e NaN como "não informado" (null). Atenção: `Number('')`
 * é 0, não NaN — daí o check explícito de string vazia.
 */
function optionalNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' && v.trim() === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

/** Normaliza itens vindos do cliente, descartando linhas totalmente vazias. */
export function sanitizeReciboItems(items: unknown): ReciboItem[] {
  if (!Array.isArray(items)) return []
  return items
    .map((raw): ReciboItem => {
      const it = raw as Partial<ReciboItem>
      return {
        quantity: optionalNumber(it.quantity),
        description: (it.description ?? '').toString().trim(),
        value: optionalNumber(it.value),
      }
    })
    .filter((it) => it.description !== '' || it.value !== null || it.quantity !== null)
}

/** Converte um valor numérico opcional, mantendo apenas positivos. */
export function positiveNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Deriva as linhas e os totais do recibo a partir de um orçamento, obedecendo
 * a regra da mão de obra do orçamento.
 *
 * Mão de obra (regra do orçamento):
 *   total = (valor compartilhado do grupo de preço fixo)
 *         + Σ (valor individual dos itens de preço fixo)
 *         + Σ (subtotal por_unidade)
 *         + Σ (subtotal por_m2)
 *
 * Linhas listadas (coluna "Valores"):
 *   - item de preço fixo COM valor individual → mostra o valor;
 *   - item de preço fixo SEM valor individual → fica sem valor (é coberto pelo
 *     valor compartilhado do grupo, que NÃO vira linha — entra apenas no total
 *     de Mão de Obra, evitando contar duas vezes);
 *   - por_unidade / por_m2 → mostram o subtotal;
 *   - material COM preço → vira linha; sem preço é ignorado (igual ao orçamento).
 *
 * Os totais saem direto do orçamento, então o recibo nunca excede o orçamento:
 *   Mão de Obra = labor.total · Material Empregado = materialsTotal ·
 *   TOTAL = grandTotal.
 */
export interface ReciboPrefill {
  items: ReciboItem[]
  laborTotal: number
  materialsTotal: number
  total: number
}

export function buildReciboFromOrcamento(orc: Orcamento): ReciboPrefill {
  const items: ReciboItem[] = []

  for (const it of orc.labor.items) {
    if (it.type === 'fixo') {
      items.push({
        quantity: null,
        description: it.description,
        value: it.itemValue ?? null,
      })
    } else if (it.type === 'por_unidade') {
      items.push({
        quantity: it.quantity,
        description: it.description,
        value: it.subtotal,
      })
    } else if (it.type === 'por_m2') {
      items.push({
        quantity: it.area,
        description: `${it.description} (m²)`,
        value: it.subtotal,
      })
    }
  }

  // Apenas materiais com preço informado entram como linha.
  for (const m of orc.materials) {
    if (m.total !== null && m.total !== undefined) {
      items.push({
        quantity: m.quantity,
        description: m.name,
        value: m.total,
      })
    }
  }

  const laborTotal = orc.labor?.total ?? 0
  const materialsTotal = orc.materialsTotal ?? 0
  return { items, laborTotal, materialsTotal, total: laborTotal + materialsTotal }
}

/** Compat: só as linhas, para quem não precisa dos totais. */
export function buildReciboItemsFromOrcamento(orc: Orcamento): ReciboItem[] {
  return buildReciboFromOrcamento(orc).items
}
