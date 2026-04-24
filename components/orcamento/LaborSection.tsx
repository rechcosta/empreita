'use client'

import { useMemo } from 'react'
import { Labor, LaborItem, LaborItemType } from '@/types'
import { formatCurrency } from '@/lib/utils'
import {
  computeLaborTotal,
  computeUnitSubtotal,
  computeSqmSubtotal,
  hasFixedItems,
  sumFixedItemValues,
  sumUnitItems,
  sumSqmItems,
} from '@/lib/labor'

/**
 * Form-state shape for labor. All numeric fields are strings here so the
 * user can clear an input without it snapping back to "0". On save,
 * the parent converts these to proper numbers.
 */
export interface FormLaborItem {
  // Shared
  type: LaborItemType
  description: string
  // fixo (optional — empty string means "not informed")
  itemValue?: string
  // por_unidade
  quantity?: string
  unitPrice?: string
  // por_m2
  area?: string
  pricePerMeter?: string
}

export interface FormLaborState {
  items: FormLaborItem[]
  /** Optional shared value for all fixed items. Empty string = not informed. */
  fixedGroupValue: string
}

interface Props {
  value: FormLaborState
  onChange: (next: FormLaborState) => void
}

// ────────────────────────────────────────────────────────────────

function parseNum(s: string | undefined): number {
  return parseFloat(s ?? '0') || 0
}

/** Parses an optional numeric string: empty → null, otherwise a number. */
function parseOptionalNum(s: string | undefined): number | null {
  const raw = (s ?? '').trim()
  if (raw === '') return null
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

/** Converts the form state into a canonical Labor object (for saving). */
export function buildLaborPayload(form: FormLaborState): Labor {
  const items: LaborItem[] = form.items.map((item) => {
    if (item.type === 'fixo') {
      return {
        type: 'fixo',
        description: item.description.trim(),
        itemValue: parseOptionalNum(item.itemValue),
      }
    }
    if (item.type === 'por_unidade') {
      const quantity = parseNum(item.quantity)
      const unitPrice = parseNum(item.unitPrice)
      return {
        type: 'por_unidade',
        description: item.description.trim(),
        quantity,
        unitPrice,
        subtotal: computeUnitSubtotal({ quantity, unitPrice }),
      }
    }
    const area = parseNum(item.area)
    const pricePerMeter = parseNum(item.pricePerMeter)
    return {
      type: 'por_m2',
      description: item.description.trim(),
      area,
      pricePerMeter,
      subtotal: computeSqmSubtotal({ area, pricePerMeter }),
    }
  })

  const fixedPresent = items.some((i) => i.type === 'fixo')
  const fixedGroupValue = fixedPresent ? parseOptionalNum(form.fixedGroupValue) : null

  const labor: Labor = { items, fixedGroupValue, total: 0 }
  labor.total = computeLaborTotal(labor)
  return labor
}

export function emptyLaborState(): FormLaborState {
  return { items: [], fixedGroupValue: '' }
}

/** Loads an existing Labor (from API) into editable form state. */
export function laborToFormState(labor: Labor): FormLaborState {
  return {
    items: labor.items.map((i) => {
      if (i.type === 'fixo') {
        return {
          type: 'fixo',
          description: i.description,
          itemValue:
            i.itemValue === null || i.itemValue === undefined
              ? ''
              : i.itemValue.toString(),
        }
      }
      if (i.type === 'por_unidade') return {
        type: 'por_unidade',
        description: i.description,
        quantity: i.quantity.toString(),
        unitPrice: i.unitPrice.toString(),
      }
      return {
        type: 'por_m2',
        description: i.description,
        area: i.area.toString(),
        pricePerMeter: i.pricePerMeter.toString(),
      }
    }),
    fixedGroupValue:
      labor.fixedGroupValue === null || labor.fixedGroupValue === undefined
        ? ''
        : labor.fixedGroupValue.toString(),
  }
}

// ────────────────────────────────────────────────────────────────

export default function LaborSection({ value, onChange }: Props) {
  // Derived preview totals (UI-only; real saving rebuilds via buildLaborPayload)
  const previewLabor = useMemo(() => buildLaborPayload(value), [value])
  const fixedPresent = useMemo(() => hasFixedItems(previewLabor.items), [previewLabor])
  const fixedItemsSum = useMemo(() => sumFixedItemValues(previewLabor.items), [previewLabor])
  const unitSum = useMemo(() => sumUnitItems(previewLabor.items), [previewLabor])
  const sqmSum = useMemo(() => sumSqmItems(previewLabor.items), [previewLabor])
  const fixedGroup = previewLabor.fixedGroupValue ?? 0
  const fixedTotal = fixedGroup + fixedItemsSum

  function addItem(type: LaborItemType) {
    const base: FormLaborItem = { type, description: '' }
    if (type === 'fixo') {
      base.itemValue = ''
    } else if (type === 'por_unidade') {
      base.quantity = ''
      base.unitPrice = ''
    } else if (type === 'por_m2') {
      base.area = ''
      base.pricePerMeter = ''
    }
    onChange({ ...value, items: [...value.items, base] })
  }

  function removeItem(index: number) {
    const nextItems = value.items.filter((_, i) => i !== index)
    const stillHasFixed = nextItems.some((i) => i.type === 'fixo')
    onChange({
      items: nextItems,
      // Clear the shared fixed value when no fixed items remain
      fixedGroupValue: stillHasFixed ? value.fixedGroupValue : '',
    })
  }

  function updateItem(index: number, patch: Partial<FormLaborItem>) {
    onChange({
      ...value,
      items: value.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    })
  }

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4 gap-4">
        <h2 className="section-title mb-0">4. Mão de obra</h2>
        <p className="text-xs text-gray-500 max-w-xs text-right">
          Adicione serviços combinando tipos. Itens de preço fixo compartilham
          um valor comum e podem também ter valor individual opcional.
        </p>
      </div>

      {/* Empty state */}
      {value.items.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-[#FAFAFA] py-10 px-6 text-center">
          <p className="text-sm text-gray-500 mb-4">
            Nenhum serviço adicionado ainda.
          </p>
          <AddButtons onAdd={addItem} />
        </div>
      )}

      {/* Items list */}
      {value.items.length > 0 && (
        <>
          <div className="space-y-3">
            {value.items.map((item, i) => (
              <LaborItemRow
                key={i}
                index={i}
                item={item}
                onChange={(patch) => updateItem(i, patch)}
                onRemove={() => removeItem(i)}
              />
            ))}
          </div>

          {/* Shared fixed value input (only when fixed items exist) */}
          {fixedPresent && (
            <div className="mt-5 rounded-lg border-2 border-brand-200 bg-brand-50 p-4">
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Valor compartilhado do grupo (preço fixo){' '}
                <span className="text-gray-500 font-normal">— opcional</span>
              </label>
              <p className="text-xs text-gray-600 mb-3">
                Soma a todos os itens de preço fixo. Deixe vazio se cada item
                já tem seu valor individual informado.
              </p>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input-base max-w-xs"
                placeholder="0,00"
                value={value.fixedGroupValue}
                onChange={(e) => onChange({ ...value, fixedGroupValue: e.target.value })}
              />
            </div>
          )}

          {/* Add more buttons */}
          <div className="mt-5 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">Adicionar mais serviços:</p>
            <AddButtons onAdd={addItem} />
          </div>

          {/* Subtotals breakdown */}
          <div className="mt-5 rounded-lg bg-[#FAFAFA] border border-gray-200 divide-y divide-gray-200">
            {fixedPresent && fixedTotal > 0 && (
              <SubRow label="Subtotal preço fixo" value={fixedTotal} />
            )}
            {unitSum > 0 && (
              <SubRow label="Subtotal por unidade" value={unitSum} />
            )}
            {sqmSum > 0 && (
              <SubRow label="Subtotal por m²" value={sqmSum} />
            )}
            <div className="flex justify-between px-4 py-3">
              <span className="font-semibold text-gray-900">Total mão de obra</span>
              <span className="font-bold text-brand-600">
                {formatCurrency(previewLabor.total)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────

function SubRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between px-4 py-2.5 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{formatCurrency(value)}</span>
    </div>
  )
}

function AddButtons({ onAdd }: { onAdd: (type: LaborItemType) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <AddButton onClick={() => onAdd('fixo')} label="Preço fixo" />
      <AddButton onClick={() => onAdd('por_unidade')} label="Por unidade" />
      <AddButton onClick={() => onAdd('por_m2')} label="Por m²" />
    </div>
  )
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-brand-500 hover:text-brand-600 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      {label}
    </button>
  )
}

// ────────────────────────────────────────────────────────────────

interface ItemRowProps {
  index: number
  item: FormLaborItem
  onChange: (patch: Partial<FormLaborItem>) => void
  onRemove: () => void
}

const TYPE_LABELS: Record<LaborItemType, string> = {
  fixo: 'Preço fixo',
  por_unidade: 'Por unidade',
  por_m2: 'Por m²',
}

const TYPE_COLORS: Record<LaborItemType, string> = {
  // Subtle colored chip per type, all in brand palette family
  fixo: 'bg-blue-50 text-blue-700 border-blue-200',
  por_unidade: 'bg-purple-50 text-purple-700 border-purple-200',
  por_m2: 'bg-teal-50 text-teal-700 border-teal-200',
}

function LaborItemRow({ index, item, onChange, onRemove }: ItemRowProps) {
  // Compute per-item subtotal for unit / sqm types (read-only preview)
  const subtotal = useMemo(() => {
    if (item.type === 'por_unidade') {
      return computeUnitSubtotal({
        quantity: parseNum(item.quantity),
        unitPrice: parseNum(item.unitPrice),
      })
    }
    if (item.type === 'por_m2') {
      return computeSqmSubtotal({
        area: parseNum(item.area),
        pricePerMeter: parseNum(item.pricePerMeter),
      })
    }
    return null
  }, [item])

  return (
    <div className="rounded-lg border border-gray-200 bg-[#FAFAFA] p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-shrink-0">
            #{index + 1}
          </span>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${TYPE_COLORS[item.type]}`}
          >
            {TYPE_LABELS[item.type]}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
          aria-label="Remover item"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Description - always present */}
      <div className="mb-3">
        <label className="label text-xs">Descrição do serviço *</label>
        <input
          type="text"
          className="input-base"
          placeholder={
            item.type === 'fixo'
              ? 'Ex: Retirar piso, Derrubar parede...'
              : item.type === 'por_unidade'
              ? 'Ex: Troca de tomada, Instalação de porta...'
              : 'Ex: Pintura de parede, Assentamento de piso...'
          }
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      {/* Type-specific fields */}
      {item.type === 'fixo' && (
        <div>
          <label className="label text-xs">
            Valor individual (R$){' '}
            <span className="text-gray-400 font-normal">— opcional</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input-base max-w-xs"
            placeholder="Deixe vazio para usar só o valor compartilhado"
            value={item.itemValue ?? ''}
            onChange={(e) => onChange({ itemValue: e.target.value })}
          />
          <p className="text-xs text-gray-500 mt-1">
            Se informado, soma ao valor compartilhado do grupo no total do preço fixo.
          </p>
        </div>
      )}

      {item.type === 'por_unidade' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label text-xs">Quantidade *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input-base"
              placeholder="0"
              value={item.quantity ?? ''}
              onChange={(e) => onChange({ quantity: e.target.value })}
            />
          </div>
          <div>
            <label className="label text-xs">Valor por unidade (R$) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input-base"
              placeholder="0,00"
              value={item.unitPrice ?? ''}
              onChange={(e) => onChange({ unitPrice: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <div className="w-full rounded-lg bg-white border border-gray-200 px-4 py-2.5">
              <p className="text-xs text-gray-500 font-medium">Subtotal</p>
              <p className="text-base font-bold text-brand-600">
                {formatCurrency(subtotal ?? 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {item.type === 'por_m2' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label text-xs">Área (m²) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input-base"
              placeholder="0"
              value={item.area ?? ''}
              onChange={(e) => onChange({ area: e.target.value })}
            />
          </div>
          <div>
            <label className="label text-xs">Valor por m² (R$) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input-base"
              placeholder="0,00"
              value={item.pricePerMeter ?? ''}
              onChange={(e) => onChange({ pricePerMeter: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <div className="w-full rounded-lg bg-white border border-gray-200 px-4 py-2.5">
              <p className="text-xs text-gray-500 font-medium">Subtotal</p>
              <p className="text-base font-bold text-brand-600">
                {formatCurrency(subtotal ?? 0)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}