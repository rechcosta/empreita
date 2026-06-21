'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { EmployeesDashboard } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { VerticalBars, HorizontalBars } from '@/components/funcionario/Charts'

export default function FuncionariosDashboardPage() {
  const [data, setData] = useState<EmployeesDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/funcionarios/dashboard')
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        setError('Erro ao carregar o dashboard.')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-brand-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
        {error || 'Sem dados.'}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-700">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="page-title">Dashboard de funcionários</h1>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Total de funcionários" value={data.totalEmployees.toString()} />
        <Stat label="Folha salarial" value={formatCurrency(data.payrollTotal)} accent="text-brand-600" />
        <Stat label="Adiantamentos pendentes"
          value={formatCurrency(data.pendingAdvancesTotal)} accent="text-amber-600" />
        <Stat label="Dívidas pendentes"
          value={formatCurrency(data.pendingDebtsTotal)} accent="text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Evolução da folha salarial */}
        <div className="card p-6">
          <h2 className="section-title mb-1">Evolução da folha salarial</h2>
          <p className="text-xs text-gray-500 mb-2">Total pago por mês (últimos 6 meses)</p>
          <VerticalBars data={data.monthlyPayments.map((m) => ({ label: m.month, value: m.total }))} />
        </div>

        {/* Pagamentos por período */}
        <div className="card p-6">
          <h2 className="section-title mb-1">Pagamentos por período</h2>
          <p className="text-xs text-gray-500 mb-2">Quantidade de pagamentos por mês</p>
          <VerticalBars
            data={data.monthlyPayments.map((m) => ({ label: m.month, value: m.count }))}
            formatValue={(n) => `${n} pagamento${n !== 1 ? 's' : ''}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximos pagamentos */}
        <div className="card p-6">
          <h2 className="section-title">Próximos pagamentos</h2>
          {data.upcomingPayments.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">Nenhum pagamento previsto.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.upcomingPayments.map((p) => (
                <li key={p.employeeId} className="flex items-center justify-between py-2.5">
                  <Link href={`/funcionarios/${p.employeeId}`} className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate hover:text-brand-600">
                      {p.fullName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.role}
                      {p.nextPaymentDate ? ` · ${formatDate(p.nextPaymentDate)}` : ''}
                    </p>
                  </Link>
                  <span className="text-sm font-semibold text-brand-600 flex-shrink-0">
                    {formatCurrency(p.netForecast)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Adiantamentos por funcionário */}
        <div className="card p-6">
          <h2 className="section-title">Adiantamentos por funcionário</h2>
          <HorizontalBars data={data.advancesByEmployee.map((a) => ({ label: a.fullName, value: a.total }))} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )
}
