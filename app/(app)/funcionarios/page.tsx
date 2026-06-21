'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Employee } from '@/types'
import EmployeeCard from '@/components/funcionario/EmployeeCard'

export default function FuncionariosPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/funcionarios')
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        setEmployees(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Erro ao carregar funcionários.')
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        (e.cpf ?? '').includes(q.replace(/\D/g, ''))
    )
  }, [employees, query])

  const total = employees.length
  const isFiltering = query.trim().length > 0

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Funcionários</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isFiltering
              ? `${filtered.length} de ${total} ${total === 1 ? 'funcionário' : 'funcionários'}`
              : `${total} ${total === 1 ? 'funcionário cadastrado' : 'funcionários cadastrados'}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/funcionarios/presenca" className="btn-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Presença
          </Link>
          <Link href="/funcionarios/dashboard" className="btn-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Dashboard
          </Link>
          <Link href="/funcionarios/novo" className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo funcionário
          </Link>
        </div>
      </div>

      {!loading && total > 0 && (
        <div className="mb-6 relative">
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" className="input-base pl-9"
            placeholder="Buscar por nome, cargo ou CPF..."
            value={query} onChange={(e) => setQuery(e.target.value)} />
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

      {!loading && !error && total === 0 && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 border border-gray-200 mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum funcionário ainda</h3>
          <p className="text-gray-500 text-sm mb-6">Cadastre seu primeiro funcionário para começar.</p>
          <Link href="/funcionarios/novo" className="btn-primary">Cadastrar funcionário</Link>
        </div>
      )}

      {!loading && !error && total > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-500">
          Nenhum funcionário corresponde a{' '}
          <span className="font-medium text-gray-700">&ldquo;{query}&rdquo;</span>.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <EmployeeCard key={e._id} employee={e} />
          ))}
        </div>
      )}
    </div>
  )
}
