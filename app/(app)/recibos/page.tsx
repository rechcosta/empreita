'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Recibo } from '@/types'
import ReciboCard from '@/components/recibo/ReciboCard'

export default function RecibosPage() {
  const [recibos, setRecibos] = useState<Recibo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  async function fetchRecibos() {
    const res = await fetch('/api/recibos')
    if (!res.ok) { setError('Erro ao carregar recibos.'); setLoading(false); return }
    setRecibos(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchRecibos() }, [])

  async function handleDelete(id: string) {
    if (!confirm('Deseja excluir este recibo?')) return
    const res = await fetch(`/api/recibos/${id}`, { method: 'DELETE' })
    if (res.ok) setRecibos((prev) => prev.filter((r) => r._id !== id))
    else alert('Erro ao excluir.')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recibos
    return recibos.filter((r) => {
      const numStr = r.number !== undefined && r.number !== null
        ? `rec-${r.number.toString().padStart(4, '0')}`
        : ''
      return (
        r.clientName.toLowerCase().includes(q) ||
        numStr.includes(q) ||
        (r.number !== undefined && r.number !== null && r.number.toString().includes(q))
      )
    })
  }, [recibos, query])

  const totalCount = recibos.length
  const isFiltering = query.trim().length > 0

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Recibos</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isFiltering
              ? `${filtered.length} de ${totalCount} ${totalCount === 1 ? 'recibo' : 'recibos'}`
              : `${totalCount} ${totalCount === 1 ? 'recibo emitido' : 'recibos emitidos'}`}
          </p>
        </div>
        <Link href="/recibos/novo" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo recibo
        </Link>
      </div>

      {!loading && totalCount > 0 && (
        <div className="mb-6 relative">
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" className="input-base pl-9 pr-9"
            placeholder="Buscar por tomador ou número (ex: REC-0007, ou 7)..."
            value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar recibos" />
          {query && (
            <button type="button" onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              aria-label="Limpar busca">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <svg className="animate-spin h-8 w-8 text-brand-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>
      )}

      {!loading && !error && totalCount === 0 && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 border border-gray-200 mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum recibo ainda</h3>
          <p className="text-gray-500 text-sm mb-6">
            Gere um recibo a partir de um orçamento ou crie um do zero.
          </p>
          <Link href="/recibos/novo" className="btn-primary">Criar recibo</Link>
        </div>
      )}

      {!loading && !error && totalCount > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-500">
          Nenhum recibo corresponde a <span className="font-medium text-gray-700">&ldquo;{query}&rdquo;</span>.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((rec) => (
            <ReciboCard key={rec._id} recibo={rec} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
