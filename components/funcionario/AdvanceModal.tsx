'use client'

import { useState } from 'react'
import { AdvanceCategory } from '@/types'
import { ADVANCE_CATEGORY_LABELS } from '@/lib/payroll'

interface Props {
  employeeId: string
  onClose: () => void
  onSaved: () => void
}

export default function AdvanceModal({ employeeId, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState<AdvanceCategory>('vale')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    const value = parseFloat(amount)
    if (!Number.isFinite(value) || value <= 0) return setError('Informe um valor maior que zero.')

    setError('')
    setLoading(true)
    const res = await fetch(`/api/funcionarios/${employeeId}/adiantamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: value, date, category, reason }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return setError(data.message ?? 'Erro ao registrar adiantamento.')
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Registrar adiantamento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Fechar">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$) *</label>
              <input type="number" min="0" step="0.01" className="input-base" placeholder="0,00"
                value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Data</label>
              <input type="date" className="input-base"
                value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Motivo</label>
            <select className="input-base" value={category}
              onChange={(e) => setCategory(e.target.value as AdvanceCategory)}>
              {(Object.entries(ADVANCE_CATEGORY_LABELS) as [AdvanceCategory, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Observação</label>
            <input className="input-base" placeholder="Detalhe (opcional)"
              value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Registrando...' : 'Registrar'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
