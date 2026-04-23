'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Material, UnitType, Orcamento } from '@/types'
import { formatCurrency, formatCurrencyOrDash } from '@/lib/utils'
import { generateOrcamentoPDF } from '@/lib/pdf'
import LaborSection, {
  FormLaborState,
  emptyLaborState,
  laborToFormState,
  buildLaborPayload,
} from './LaborSection'

const UNIT_LABELS: Record<UnitType, string> = {
  unidade: 'Unidade',
  m3: 'Metro cúbico (m³)',
  kg: 'Quilograma (kg)',
}

interface FormMaterial {
  name: string
  unit: UnitType
  quantity: number
  unitPrice: string // empty = not informed (null)
}

const EMPTY_MATERIAL: FormMaterial = {
  name: '',
  unit: 'unidade',
  quantity: 0,
  unitPrice: '',
}

function calcMaterialTotal(m: FormMaterial): number | null {
  if (m.unitPrice.trim() === '') return null
  const price = parseFloat(m.unitPrice) || 0
  return Math.round(m.quantity * price * 100) / 100
}

interface Props {
  mode: 'create' | 'edit'
  id?: string
}

export default function OrcamentoFormPage({ mode, id }: Props) {
  const router = useRouter()
  const { data: session } = useSession()

  const [clientName, setClientName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [serviceName, setServiceName] = useState('')
  // Materials are OPTIONAL per spec — start with an empty list.
  const [materials, setMaterials] = useState<FormMaterial[]>([])
  const [formLabor, setFormLabor] = useState<FormLaborState>(emptyLaborState())

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(mode === 'edit')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Orcamento | null>(null)

  const computedMaterials: Material[] = materials.map((m) => ({
    name: m.name,
    unit: m.unit,
    quantity: m.quantity,
    unitPrice: m.unitPrice.trim() === '' ? null : parseFloat(m.unitPrice) || 0,
    total: calcMaterialTotal(m),
  }))

  const materialsTotal = computedMaterials.reduce(
    (s, m) => (m.total !== null ? s + m.total : s),
    0
  )

  const laborPayload = buildLaborPayload(formLabor)
  const laborTotal = laborPayload.total
  const grandTotal = materialsTotal + laborTotal

  useEffect(() => {
    if (mode !== 'edit' || !id) return
    fetch(`/api/orcamentos/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setClientName(data.clientName ?? '')
        setClientAddress(data.clientAddress ?? '')
        setServiceName(data.serviceName)
        setMaterials(
          (data.materials ?? []).map((m: Material) => ({
            name: m.name,
            unit: m.unit,
            quantity: m.quantity,
            unitPrice:
              m.unitPrice === null || m.unitPrice === undefined
                ? ''
                : m.unitPrice.toString(),
          }))
        )
        setFormLabor(laborToFormState(data.labor))
        setFetching(false)
      })
      .catch(() => { setError('Erro ao carregar orçamento.'); setFetching(false) })
  }, [mode, id])

  function addMaterial() {
    setMaterials((p) => [...p, { ...EMPTY_MATERIAL }])
  }

  function removeMaterial(i: number) {
    setMaterials((p) => p.filter((_, idx) => idx !== i))
  }

  function updateMaterial(i: number, field: keyof FormMaterial, value: string) {
    setMaterials((p) =>
      p.map((m, idx) => {
        if (idx !== i) return m
        const updated = { ...m }
        if (field === 'name') updated.name = value
        else if (field === 'unit') updated.unit = value as UnitType
        else if (field === 'quantity') updated.quantity = parseFloat(value) || 0
        else if (field === 'unitPrice') updated.unitPrice = value
        return updated
      })
    )
  }

  function validateLabor(): string | null {
    for (let i = 0; i < formLabor.items.length; i++) {
      const item = formLabor.items[i]
      if (!item.description.trim()) {
        return `Informe a descrição do serviço #${i + 1} da mão de obra.`
      }
    }
    const hasFixed = formLabor.items.some((i) => i.type === 'fixo')
    if (hasFixed && formLabor.fixedGroupValue.trim() === '') {
      return 'Informe o valor total da mão de obra (preço fixo).'
    }
    return null
  }

  function validateMaterials(): string | null {
    // Only validate materials that were actually added.
    // Materials are optional per spec — no item is fine.
    for (let i = 0; i < materials.length; i++) {
      const m = materials[i]
      if (!m.name.trim()) {
        return `Informe o nome do material #${i + 1}.`
      }
      if (!m.quantity || m.quantity <= 0) {
        return `Informe a quantidade do material #${i + 1}.`
      }
    }
    return null
  }

  async function handleSave() {
    if (!clientName.trim()) { setError('Informe o nome do cliente.'); return }
    if (!clientAddress.trim()) { setError('Informe o endereço.'); return }
    if (!serviceName.trim()) { setError('Informe o nome do serviço.'); return }

    const matErr = validateMaterials()
    if (matErr) { setError(matErr); return }

    const laborErr = validateLabor()
    if (laborErr) { setError(laborErr); return }

    // The only hard rule left: budget must have SOME value to exist.
    // Either priced materials, or labor with value, or both.
    if (materialsTotal === 0 && laborTotal === 0) {
      setError('O orçamento precisa ter ao menos um material com preço ou serviço de mão de obra com valor.')
      return
    }

    setError('')
    setLoading(true)

    const payload = {
      clientName: clientName.trim(),
      clientAddress: clientAddress.trim(),
      serviceName: serviceName.trim(),
      materials: computedMaterials,
      labor: laborPayload,
    }

    const url = mode === 'create' ? '/api/orcamentos' : `/api/orcamentos/${id}`
    const method = mode === 'create' ? 'POST' : 'PUT'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.message ?? 'Erro ao salvar.'); return }
    setSaved({
      ...data,
      materialsTotal,
      grandTotal,
      labor: laborPayload,
    })
  }

  function handleGeneratePDF() {
    if (!saved || !session) return
    generateOrcamentoPDF(saved, {
      companyName: session.user.companyName,
      cnpj: session.user.cnpj,
      logoBase64: session.user.logoBase64,
      email: session.user.email!,
    })
  }

  const materialsWithoutPrice = computedMaterials.filter((m) => m.total === null).length

  if (fetching) {
    return (
      <div className="flex justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-brand-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="page-title">
          {mode === 'create' ? 'Novo orçamento' : 'Editar orçamento'}
        </h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-green-700">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">Orçamento salvo com sucesso!</span>
          </div>
          <button onClick={handleGeneratePDF} className="btn-primary text-sm py-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Baixar PDF
          </button>
        </div>
      )}

      <div className="space-y-6">

        {/* 1. Cliente */}
        <div className="card p-6">
          <h2 className="section-title">1. Cliente</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Nome do cliente *</label>
              <input
                type="text"
                className="input-base"
                placeholder="Ex: João Silva, Construtora ABC Ltda."
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Endereço *</label>
              <input
                type="text"
                className="input-base"
                placeholder="Rua, número, bairro, cidade/UF"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 2. Serviço */}
        <div className="card p-6">
          <h2 className="section-title">2. Serviço</h2>
          <div>
            <label className="label">Nome / descrição do serviço *</label>
            <input
              type="text"
              className="input-base"
              placeholder="Ex: Reforma de banheiro, Instalação elétrica..."
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
            />
          </div>
        </div>

        {/* 3. Materiais (OPCIONAL) */}
        <div className="card p-6">
          <div className="flex items-start justify-between mb-4 gap-4">
            <div>
              <h2 className="section-title mb-0">
                3. Materiais{' '}
                <span className="text-sm font-normal text-gray-500">— opcional</span>
              </h2>
            </div>
            {materials.length > 0 && (
              <p className="text-xs text-gray-500 max-w-xs text-right">
                Preço unitário é opcional. Sem preço, o item aparece no orçamento
                mas não entra no subtotal.
              </p>
            )}
          </div>

          {/* Empty state — materials are optional */}
          {materials.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-[#FAFAFA] py-10 px-6 text-center">
              <p className="text-sm text-gray-500 mb-4">
                Nenhum material adicionado. Materiais são opcionais neste orçamento.
              </p>
              <button type="button" onClick={addMaterial} className="btn-secondary text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar material
              </button>
            </div>
          )}

          {/* Materials list */}
          {materials.length > 0 && (
            <>
              <div className="space-y-4">
                {materials.map((mat, i) => {
                  const total = calcMaterialTotal(mat)
                  return (
                    <div key={i} className="rounded-lg border border-gray-200 bg-[#FAFAFA] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Material {i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMaterial(i)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          aria-label="Remover material"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div className="sm:col-span-2">
                          <label className="label text-xs">Nome do material *</label>
                          <input type="text" className="input-base"
                            placeholder="Ex: Cimento CP II, Areia lavada..."
                            value={mat.name}
                            onChange={(e) => updateMaterial(i, 'name', e.target.value)} />
                        </div>

                        <div>
                          <label className="label text-xs">Unidade *</label>
                          <select className="input-base" value={mat.unit}
                            onChange={(e) => updateMaterial(i, 'unit', e.target.value)}>
                            {(Object.entries(UNIT_LABELS) as [UnitType, string][]).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="label text-xs">Quantidade *</label>
                          <input type="number" min="0" step="0.01" className="input-base"
                            placeholder="0" value={mat.quantity || ''}
                            onChange={(e) => updateMaterial(i, 'quantity', e.target.value)} />
                        </div>

                        <div>
                          <label className="label text-xs">
                            Valor por unidade (R$){' '}
                            <span className="text-gray-400 font-normal">— opcional</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input-base"
                            placeholder="Deixe vazio se não tiver"
                            value={mat.unitPrice}
                            onChange={(e) => updateMaterial(i, 'unitPrice', e.target.value)}
                          />
                        </div>

                        <div className="flex items-end">
                          <div className={`w-full rounded-lg border px-4 py-2.5 ${
                            total === null
                              ? 'bg-gray-50 border-gray-200'
                              : 'bg-white border-gray-200'
                          }`}>
                            <p className="text-xs text-gray-500 font-medium">Subtotal</p>
                            <p className={`text-base font-bold ${
                              total === null ? 'text-gray-400' : 'text-brand-600'
                            }`}>
                              {formatCurrencyOrDash(total)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <button type="button" onClick={addMaterial} className="btn-secondary text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar material
                </button>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    Total de materiais
                    {materialsWithoutPrice > 0 && (
                      <span className="ml-1">
                        ({materialsWithoutPrice} sem preço ignorado{materialsWithoutPrice !== 1 ? 's' : ''})
                      </span>
                    )}
                  </p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(materialsTotal)}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 4. Mão de obra */}
        <LaborSection value={formLabor} onChange={setFormLabor} />

        {/* 5. Resumo final */}
        <div className="card p-6">
          <h2 className="section-title">5. Resumo final</h2>

          <div className="rounded-lg bg-[#FAFAFA] border border-gray-200 divide-y divide-gray-200">
            <div className="flex justify-between px-4 py-3 text-sm">
              <span className="text-gray-600">Total materiais</span>
              <span className="font-medium text-gray-900">{formatCurrency(materialsTotal)}</span>
            </div>
            <div className="flex justify-between px-4 py-3 text-sm">
              <span className="text-gray-600">Total mão de obra</span>
              <span className="font-medium text-gray-900">{formatCurrency(laborTotal)}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="font-bold text-gray-900">TOTAL GERAL</span>
              <span className="font-bold text-xl text-brand-600">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button type="button" onClick={handleSave} disabled={loading} className="btn-primary flex-1">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Salvando...
                </span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  {mode === 'create' ? 'Salvar orçamento' : 'Salvar alterações'}
                </>
              )}
            </button>

            {saved && (
              <button type="button" onClick={handleGeneratePDF} className="btn-secondary flex-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Gerar PDF
              </button>
            )}

            <Link href="/dashboard" className="btn-secondary flex-1 text-center">
              Voltar
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}