'use client'

import { useState } from 'react'

interface Props {
  employeeId: string
  onClose: () => void
  onSaved: () => void
}

export default function ObservationModal({ employeeId, onClose, onSaved }: Props) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!reason.trim()) return setError('Informe o texto da observação.')
    setError('')
    setLoading(true)
    const res = await fetch(`/api/funcionarios/${employeeId}/observacoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return setError(data.message ?? 'Erro ao registrar observação.')
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Registrar observação</h2>
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

        <div>
          <label className="label">Observação</label>
          <textarea
            className="input-base min-h-[100px]"
            placeholder="Anotação sobre o funcionário"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
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
