'use client'

import Link from 'next/link'
import { Employee } from '@/types'
import { formatCurrency, formatDate, formatCPF } from '@/lib/utils'
import { PAYMENT_TYPE_LABELS } from '@/lib/payroll'

interface Props {
  employee: Employee
}

export default function EmployeeCard({ employee }: Props) {
  const {
    _id,
    fullName,
    cpf,
    role,
    paymentType,
    baseSalary,
    nextPaymentDate,
    netForecast,
    pendingAdvancesTotal = 0,
    pendingDebtsTotal = 0,
  } = employee

  const pendingDiscounts = pendingAdvancesTotal + pendingDebtsTotal

  return (
    <Link
      href={`/funcionarios/${_id}`}
      className="card p-5 flex flex-col gap-3 hover:border-gray-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{fullName}</h3>
          <p className="text-xs text-gray-600 mt-0.5 truncate">{role}</p>
          {cpf && <p className="text-xs text-gray-400 mt-0.5">{formatCPF(cpf)}</p>}
        </div>
        <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-brand-700 bg-brand-50 rounded-md px-2 py-1">
          {PAYMENT_TYPE_LABELS[paymentType]}
        </span>
      </div>

      <div className="text-xs text-gray-500 space-y-1 border-t border-gray-100 pt-3">
        <div className="flex justify-between">
          <span>Salário base</span>
          <span className="text-gray-700 font-medium">{formatCurrency(baseSalary)}</span>
        </div>
        {pendingDiscounts > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Descontos pendentes</span>
            <span className="font-medium">− {formatCurrency(pendingDiscounts)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Líquido previsto</span>
          <span className="text-brand-600 font-bold">
            {formatCurrency(netForecast ?? baseSalary)}
          </span>
        </div>
      </div>

      {nextPaymentDate && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Próximo pagamento: <span className="font-medium text-gray-700">{formatDate(nextPaymentDate)}</span>
        </div>
      )}
    </Link>
  )
}
