'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Orcamento } from '@/types'
import OrcamentoCard from '@/components/orcamento/OrcamentoCard'

export default function DashboardPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Meus Orçamentos</h1>
          <p className="text-gray-500 text-sm mt-1">
            {orcamentos.length} orçamento{orcamentos.length !== 1 ? 's' : ''} cadastrado{orcamentos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/orcamentos/novo" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo orçamento
        </Link>
      </div>

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

      {!loading && !error && orcamentos.length === 0 && (
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

      {!loading && orcamentos.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orcamentos.map((orc) => (
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