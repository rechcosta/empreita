'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Orcamento } from '@/types'
import OrcamentoCard from '@/components/orcamento/OrcamentoCard'

export default function DashboardPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  async function fetchOrcamentos() {
    const res = await fetch('/api/orcamentos')
    if (!res.ok) { setError('Erro ao carregar orçamentos.'); setLoading(false); return }
    const data = await res.json()
    setOrcamentos(data)
    setLoading(false)
  }

  useEffect(() => { fetchOrcamentos() }, [])

  async function handleDelete(id: string) {
    if (!confirm('Deseja excluir este orçamento?')) return
    const res = await fetch(`/api/orcamentos/${id}`, { method: 'DELETE' })
    if (res.ok) setOrcamentos((prev) => prev.filter((o) => o._id !== id))
    else alert('Erro ao excluir.')
  }

  // Client-side filter. Works as long as a user's full list fits in one
  // GET — which is the case for the foreseeable future. If/when a single
  // user has hundreds of budgets, this moves to a server-side query with
  // a `?q=` param and a text index on (clientName, serviceName).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return orcamentos

    return orcamentos.filter((o) => {
      const numStr = o.number !== undefined && o.number !== null
        ? `orc-${o.number.toString().padStart(4, '0')}`
        : ''
      return (
        o.clientName.toLowerCase().includes(q) ||
        o.serviceName.toLowerCase().includes(q) ||
        numStr.includes(q) ||
        // Also match the bare number ("17" finds ORC-0017).
        (o.number !== undefined && o.number !== null && o.number.toString().includes(q))
      )
    })
  }, [orcamentos, query])

  const totalCount = orcamentos.length
  const filteredCount = filtered.length
  const isFiltering = query.trim().length > 0

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Meus Orçamentos</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isFiltering
              ? `${filteredCount} de ${totalCount} ${totalCount === 1 ? 'orçamento' : 'orçamentos'}`
              : `${totalCount} ${totalCount === 1 ? 'orçamento cadastrado' : 'orçamentos cadastrados'}`}
          </p>
        </div>
        <Link href="/orcamentos/novo" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo orçamento
        </Link>
      </div>

      {/* Search — only shown once there's something to search through. */}
      {!loading && totalCount > 0 && (
        <div className="mb-6 relative">
          <svg
            className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="input-base pl-9 pr-9"
            placeholder="Buscar por cliente, serviço ou número (ex: ORC-0017, ou 17)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar orçamentos"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              aria-label="Limpar busca"
            >
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
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Empty state — no budgets yet at all. */}
      {!loading && !error && totalCount === 0 && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 border border-gray-200 mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum orçamento ainda</h3>
          <p className="text-gray-500 text-sm mb-6">Crie seu primeiro orçamento para começar.</p>
          <Link href="/orcamentos/novo" className="btn-primary">Criar orçamento</Link>
        </div>
      )}

      {/* Filter produced no matches. */}
      {!loading && !error && totalCount > 0 && filteredCount === 0 && (
        <div className="text-center py-12 text-sm text-gray-500">
          Nenhum orçamento corresponde a <span className="font-medium text-gray-700">&ldquo;{query}&rdquo;</span>.
        </div>
      )}

      {!loading && filteredCount > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((orc) => (
            <OrcamentoCard
              key={orc._id}
              orcamento={orc}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}