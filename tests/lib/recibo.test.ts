import { describe, it, expect } from 'vitest'
import {
  buildReciboItemsFromOrcamento,
  buildReciboFromOrcamento,
  sanitizeReciboItems,
  positiveNumber,
} from '@/lib/recibo'
import { Orcamento } from '@/types'

/**
 * Why these tests matter:
 *
 * O recibo herda as linhas do orçamento. A regra "materiais sem preço não
 * viram linha" e o mapeamento por tipo de mão de obra (fixo/unidade/m²) são
 * fáceis de quebrar num refactor — e o erro só apareceria no PDF final.
 */

const baseOrcamento = (over: Partial<Orcamento> = {}): Orcamento => ({
  clientName: 'Cliente X',
  clientAddress: 'Rua Y, 100',
  serviceName: 'Serviço',
  materials: [],
  labor: { items: [], fixedGroupValue: null, total: 0 },
  materialsTotal: 0,
  grandTotal: 0,
  ...over,
})

describe('buildReciboItemsFromOrcamento', () => {
  it('mapeia mão de obra por unidade e por m² com quantidade/área', () => {
    const orc = baseOrcamento({
      labor: {
        items: [
          { type: 'por_unidade', description: 'Cravação', quantity: 30, unitPrice: 120, subtotal: 3600 },
          { type: 'por_m2', description: 'Pintura', area: 50, pricePerMeter: 20, subtotal: 1000 },
        ],
        fixedGroupValue: null,
        total: 4600,
      },
    })
    const items = buildReciboItemsFromOrcamento(orc)
    expect(items).toEqual([
      { quantity: 30, description: 'Cravação', value: 3600 },
      { quantity: 50, description: 'Pintura (m²)', value: 1000 },
    ])
  })

  it('item fixo COM valor mostra o valor; SEM valor fica em branco', () => {
    const orc = baseOrcamento({
      labor: {
        items: [
          { type: 'fixo', description: 'Escavação', itemValue: 1000 },
          { type: 'fixo', description: 'Acabamento' },
        ],
        fixedGroupValue: null,
        total: 1000,
      },
    })
    expect(buildReciboItemsFromOrcamento(orc)).toEqual([
      { quantity: null, description: 'Escavação', value: 1000 },
      { quantity: null, description: 'Acabamento', value: null },
    ])
  })

  it('NÃO cria linha para o valor compartilhado do grupo (evita dupla contagem)', () => {
    const orc = baseOrcamento({
      labor: {
        items: [
          { type: 'fixo', description: 'Escavação', itemValue: 1000 },
          { type: 'fixo', description: 'Acabamento' },
        ],
        fixedGroupValue: 500,
        total: 1500,
      },
    })
    const items = buildReciboItemsFromOrcamento(orc)
    // Só os dois itens; o grupo (500) entra no total de Mão de Obra, não numa linha.
    expect(items).toHaveLength(2)
    expect(items.find((i) => i.description === 'Serviço (preço fixo)')).toBeUndefined()
  })

  it('inclui materiais com preço e ignora os sem preço', () => {
    const orc = baseOrcamento({
      materials: [
        { name: 'Cimento', unit: 'unidade', quantity: 8, unitPrice: 40, total: 320 },
        { name: 'Areia (doada)', unit: 'm3', quantity: 2, unitPrice: null, total: null },
      ],
      materialsTotal: 320,
      grandTotal: 320,
    })
    const items = buildReciboItemsFromOrcamento(orc)
    expect(items).toEqual([{ quantity: 8, description: 'Cimento', value: 320 }])
  })
})

describe('buildReciboFromOrcamento — totais nunca excedem o orçamento', () => {
  it('Mão de Obra inclui o grupo; TOTAL = labor + material = grandTotal', () => {
    // labor.total = grupo(500) + indiv(1000) + unidade(200) + m²(500) = 2200
    const orc = baseOrcamento({
      materials: [
        { name: 'Cimento', unit: 'unidade', quantity: 8, unitPrice: 40, total: 320 },
        { name: 'Areia (doada)', unit: 'm3', quantity: 2, unitPrice: null, total: null },
      ],
      labor: {
        items: [
          { type: 'fixo', description: 'Escavação', itemValue: 1000 },
          { type: 'fixo', description: 'Acabamento' },
          { type: 'por_unidade', description: 'Tomada', quantity: 2, unitPrice: 100, subtotal: 200 },
          { type: 'por_m2', description: 'Pintura', area: 10, pricePerMeter: 50, subtotal: 500 },
        ],
        fixedGroupValue: 500,
        total: 2200,
      },
      materialsTotal: 320,
      grandTotal: 2520,
    })
    const r = buildReciboFromOrcamento(orc)
    expect(r.laborTotal).toBe(2200)
    expect(r.materialsTotal).toBe(320)
    expect(r.total).toBe(2520)
    expect(r.total).toBe(orc.grandTotal)
  })
})

describe('sanitizeReciboItems', () => {
  it('descarta linhas totalmente vazias e normaliza números', () => {
    const out = sanitizeReciboItems([
      { quantity: '3', description: ' Mão de obra ', value: '150' },
      { quantity: '', description: '', value: '' },
      { quantity: null, description: 'Só descrição', value: null },
    ])
    expect(out).toEqual([
      { quantity: 3, description: 'Mão de obra', value: 150 },
      { quantity: null, description: 'Só descrição', value: null },
    ])
  })

  it('retorna lista vazia para entrada inválida', () => {
    expect(sanitizeReciboItems(undefined)).toEqual([])
    expect(sanitizeReciboItems('nope')).toEqual([])
  })
})

describe('positiveNumber', () => {
  it('mantém positivos, zera o resto', () => {
    expect(positiveNumber('1500')).toBe(1500)
    expect(positiveNumber(0)).toBe(0)
    expect(positiveNumber(-5)).toBe(0)
    expect(positiveNumber('abc')).toBe(0)
    expect(positiveNumber(null)).toBe(0)
  })
})
