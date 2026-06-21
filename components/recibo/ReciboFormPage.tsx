'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Orcamento, Recibo, ReciboItem } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { buildReciboFromOrcamento } from '@/lib/recibo'
import { generateReciboPDF } from '@/lib/reciboPdf'

interface FormItem {
  quantity: string
  description: string
  value: string
}

interface Props {
  mode: 'create' | 'edit'
  id?: string
}

function toDateInput(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

function itemsToForm(items: ReciboItem[]): FormItem[] {
  return items.map((it) => ({
    quantity: it.quantity === null || it.quantity === undefined ? '' : String(it.quantity),
    description: it.description ?? '',
    value: it.value === null || it.value === undefined ? '' : String(it.value),
  }))
}

export default function ReciboFormPage({ mode, id }: Props) {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const orcamentoId = searchParams.get('orcamento')

  const [city, setCity] = useState('')
  const [dateStr, setDateStr] = useState(toDateInput(new Date()))
  const [clientName, setClientName] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientAddressNumber, setClientAddressNumber] = useState('')
  const [clientNeighborhood, setClientNeighborhood] = useState('')
  const [clientCity, setClientCity] = useState('')
  const [clientState, setClientState] = useState('')
  const [clientCnpj, setClientCnpj] = useState('')
  const [clientIE, setClientIE] = useState('')
  const [items, setItems] = useState<FormItem[]>([])
  const [laborTotal, setLaborTotal] = useState('')
  const [materialsTotal, setMaterialsTotal] = useState('')
  const [totalStr, setTotalStr] = useState('')
  const [totalTouched, setTotalTouched] = useState(false)

  const [linkedOrcamentoId, setLinkedOrcamentoId] = useState<string | null>(null)
  const [fetching, setFetching] = useState(mode === 'edit' || !!orcamentoId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Recibo | null>(null)

  // Total exibido: derivado de (mão de obra + material) até o usuário editar.
  const computedTotal =
    (parseFloat(laborTotal) || 0) + (parseFloat(materialsTotal) || 0)
  const effectiveTotal = totalTouched ? parseFloat(totalStr) || 0 : computedTotal

  // ── Prefill: edição carrega o recibo; criação a partir de orçamento ──
  useEffect(() => {
    if (mode === 'edit' && id) {
      fetch(`/api/recibos/${id}`)
        .then((r) => { if (!r.ok) throw new Error(); return r.json() })
        .then((rec: Recibo) => {
          applyRecibo(rec)
          setSaved(rec)
          setFetching(false)
        })
        .catch(() => { setError('Erro ao carregar recibo.'); setFetching(false) })
      return
    }
    if (mode === 'create' && orcamentoId) {
      fetch(`/api/orcamentos/${orcamentoId}`)
        .then((r) => { if (!r.ok) throw new Error(); return r.json() })
        .then((orc: Orcamento) => {
          applyOrcamento(orc)
          setFetching(false)
        })
        .catch(() => { setError('Erro ao carregar orçamento de origem.'); setFetching(false) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id, orcamentoId])

  function applyRecibo(rec: Recibo) {
    setCity(rec.city ?? '')
    setDateStr(rec.date ? toDateInput(new Date(rec.date)) : toDateInput(new Date()))
    setClientName(rec.clientName ?? '')
    setClientAddress(rec.clientAddress ?? '')
    setClientAddressNumber(rec.clientAddressNumber ?? '')
    setClientNeighborhood(rec.clientNeighborhood ?? '')
    setClientCity(rec.clientCity ?? '')
    setClientState(rec.clientState ?? '')
    setClientCnpj(rec.clientCnpj ?? '')
    setClientIE(rec.clientInscricaoEstadual ?? '')
    setItems(itemsToForm(rec.items ?? []))
    setLaborTotal(rec.laborTotal ? String(rec.laborTotal) : '')
    setMaterialsTotal(rec.materialsTotal ? String(rec.materialsTotal) : '')
    setTotalStr(rec.total ? String(rec.total) : '')
    setTotalTouched(true)
    setLinkedOrcamentoId(rec.orcamentoId ?? null)
  }

  function applyOrcamento(orc: Orcamento) {
    // Linhas e totais saem da MESMA fonte (regra da mão de obra do orçamento),
    // então o recibo não excede o orçamento.
    const prefill = buildReciboFromOrcamento(orc)
    setClientName(orc.clientName ?? '')
    setClientAddress(orc.clientAddress ?? '')
    setItems(itemsToForm(prefill.items))
    setLaborTotal(prefill.laborTotal ? String(prefill.laborTotal) : '')
    setMaterialsTotal(prefill.materialsTotal ? String(prefill.materialsTotal) : '')
    setTotalStr(prefill.total ? String(prefill.total) : '')
    setTotalTouched(false)
    setLinkedOrcamentoId(orc._id ?? null)
  }

  function updateItem(i: number, field: keyof FormItem, value: string) {
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)))
  }
  function addItem() {
    setItems((p) => [...p, { quantity: '', description: '', value: '' }])
  }
  function removeItem(i: number) {
    setItems((p) => p.filter((_, idx) => idx !== i))
  }

  function buildPayload() {
    return {
      orcamentoId: linkedOrcamentoId,
      city: city.trim(),
      date: new Date(dateStr).toISOString(),
      clientName: clientName.trim(),
      clientAddress: clientAddress.trim(),
      clientAddressNumber: clientAddressNumber.trim(),
      clientNeighborhood: clientNeighborhood.trim(),
      clientCity: clientCity.trim(),
      clientState: clientState.trim(),
      clientCnpj: clientCnpj.trim(),
      clientInscricaoEstadual: clientIE.trim(),
      items: items.map((it) => ({
        quantity: it.quantity.trim() === '' ? null : parseFloat(it.quantity),
        description: it.description.trim(),
        value: it.value.trim() === '' ? null : parseFloat(it.value),
      })),
      laborTotal: parseFloat(laborTotal) || 0,
      materialsTotal: parseFloat(materialsTotal) || 0,
      total: effectiveTotal,
    }
  }

  async function handleSave() {
    if (!clientName.trim()) { setError('Informe o tomador (Firma ou Sr.).'); return }
    setError('')
    setLoading(true)

    const url = mode === 'create' ? '/api/recibos' : `/api/recibos/${id}`
    const method = mode === 'create' ? 'POST' : 'PUT'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.message ?? 'Erro ao salvar.'); return }
    setSaved(data)
  }

  function handleDownload() {
    if (!saved || !session) return
    generateReciboPDF(saved, {
      companyName: session.user.companyName,
      cnpj: session.user.cnpj,
      logoBase64: session.user.logoBase64,
      email: session.user.email!,
      address: session.user.address,
      phone: session.user.phone,
    })
  }

  if (fetching) {
    return (
      <div className="flex justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-brand-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/recibos" className="text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="page-title">{mode === 'create' ? 'Novo recibo' : 'Editar recibo'}</h1>
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
            <span className="text-sm font-medium">
              Recibo salvo
              {saved.number ? ` (REC-${saved.number.toString().padStart(4, '0')})` : ''}!
            </span>
          </div>
          <button onClick={handleDownload} className="btn-primary text-sm py-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Baixar recibo (PDF)
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* 1. Local e data */}
        <div className="card p-6">
          <h2 className="section-title">1. Local e data</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Cidade</label>
              <input type="text" className="input-base" placeholder="Ex: Capão da Canoa"
                value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className="label">Data</label>
              <input type="date" className="input-base"
                value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
            </div>
          </div>
        </div>

        {/* 2. Tomador do serviço */}
        <div className="card p-6">
          <h2 className="section-title">2. Tomador do serviço</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Firma ou Sr. *</label>
              <input type="text" className="input-base" placeholder="Nome do cliente / empresa"
                value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-3">
                <label className="label">Endereço</label>
                <input type="text" className="input-base" placeholder="Rua / Av."
                  value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
              </div>
              <div>
                <label className="label">Nº</label>
                <input type="text" className="input-base" placeholder="123"
                  value={clientAddressNumber} onChange={(e) => setClientAddressNumber(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Bairro</label>
                <input type="text" className="input-base"
                  value={clientNeighborhood} onChange={(e) => setClientNeighborhood(e.target.value)} />
              </div>
              <div>
                <label className="label">Município</label>
                <input type="text" className="input-base"
                  value={clientCity} onChange={(e) => setClientCity(e.target.value)} />
              </div>
              <div>
                <label className="label">Estado</label>
                <input type="text" className="input-base" placeholder="RS"
                  value={clientState} onChange={(e) => setClientState(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">CNPJ</label>
                <input type="text" className="input-base"
                  value={clientCnpj} onChange={(e) => setClientCnpj(e.target.value)} />
              </div>
              <div>
                <label className="label">Inscr. Est.</label>
                <input type="text" className="input-base"
                  value={clientIE} onChange={(e) => setClientIE(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Serviços */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">3. Descrição dos serviços</h2>
            <button type="button" onClick={addItem} className="btn-secondary text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Adicionar linha
            </button>
          </div>

          {items.length === 0 && (
            <p className="text-sm text-gray-500 py-6 text-center">
              Nenhuma linha. Adicione os serviços/materiais que aparecerão no recibo.
            </p>
          )}

          {items.length > 0 && (
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-12 gap-2 px-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <span className="col-span-2">Quant.</span>
                <span className="col-span-7">Descrição dos serviços</span>
                <span className="col-span-3">Valores</span>
              </div>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input type="number" min="0" step="0.01" className="input-base col-span-3 sm:col-span-2"
                    placeholder="Qtd" value={it.quantity}
                    onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
                  <input type="text" className="input-base col-span-6 sm:col-span-7"
                    placeholder="Descrição" value={it.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)} />
                  <input type="number" min="0" step="0.01" className="input-base col-span-2 sm:col-span-2"
                    placeholder="R$" value={it.value}
                    onChange={(e) => updateItem(i, 'value', e.target.value)} />
                  <button type="button" onClick={() => removeItem(i)}
                    className="col-span-1 text-gray-400 hover:text-red-600 transition-colors flex justify-center"
                    aria-label="Remover linha">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Totais */}
        <div className="card p-6">
          <h2 className="section-title">4. Totais</h2>
          <p className="text-xs text-gray-500 -mt-2 mb-4">
            Vêm do orçamento. Mão de Obra pode incluir um valor de preço fixo
            compartilhado que não aparece linha a linha. Tudo é editável.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Mão de Obra (R$)</label>
              <input type="number" min="0" step="0.01" className="input-base" placeholder="0,00"
                value={laborTotal} onChange={(e) => setLaborTotal(e.target.value)} />
            </div>
            <div>
              <label className="label">Material Empregado (R$)</label>
              <input type="number" min="0" step="0.01" className="input-base" placeholder="0,00"
                value={materialsTotal} onChange={(e) => setMaterialsTotal(e.target.value)} />
            </div>
            <div>
              <label className="label">TOTAL (R$)</label>
              <input type="number" min="0" step="0.01" className="input-base"
                placeholder="0,00"
                value={totalTouched ? totalStr : (computedTotal ? String(computedTotal) : '')}
                onChange={(e) => { setTotalTouched(true); setTotalStr(e.target.value) }} />
              {!totalTouched && (
                <p className="text-xs text-gray-400 mt-1">
                  = Mão de obra + Material ({formatCurrency(computedTotal)})
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button type="button" onClick={handleSave} disabled={loading} className="btn-primary flex-1">
              {loading ? 'Salvando...' : (mode === 'create' ? 'Salvar recibo' : 'Salvar alterações')}
            </button>
            {saved && (
              <button type="button" onClick={handleDownload} className="btn-secondary flex-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Baixar PDF
              </button>
            )}
            <Link href="/recibos" className="btn-secondary flex-1 text-center">Voltar</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
