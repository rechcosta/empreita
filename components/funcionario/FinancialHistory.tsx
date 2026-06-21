'use client'

import { EmployeeTransaction, TransactionType } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ADVANCE_CATEGORY_LABELS } from '@/lib/payroll'

interface Props {
  transactions: EmployeeTransaction[]
  onDelete: (tx: EmployeeTransaction) => void
}

const TYPE_META: Record<
  TransactionType,
  { label: string; sign: '+' | '-' | ''; color: string; badge: string }
> = {
  pagamento: { label: 'Salário pago', sign: '+', color: 'text-green-700', badge: 'bg-green-50 text-green-700' },
  adiantamento: { label: 'Adiantamento', sign: '-', color: 'text-red-600', badge: 'bg-amber-50 text-amber-700' },
  divida_inicial: { label: 'Dívida', sign: '-', color: 'text-red-600', badge: 'bg-red-50 text-red-700' },
  observacao: { label: 'Observação', sign: '', color: 'text-gray-500', badge: 'bg-gray-100 text-gray-600' },
}

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  quitado: 'Quitado',
  pago: 'Pago',
  registrado: 'Registrado',
}

export default function FinancialHistory({ transactions, onDelete }: Props) {
  if (transactions.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-6 text-center">
        Nenhum lançamento no histórico ainda.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
            <th className="py-2 pr-3 font-medium">Data</th>
            <th className="py-2 pr-3 font-medium">Tipo</th>
            <th className="py-2 pr-3 font-medium">Descrição</th>
            <th className="py-2 pr-3 font-medium text-right">Valor</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 pr-3 font-medium">Responsável</th>
            <th className="py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.map((tx) => {
            const meta = TYPE_META[tx.type]
            const canDelete = tx.type !== 'pagamento' && tx.status !== 'quitado'
            const categoryLabel =
              tx.category && tx.type === 'adiantamento'
                ? ADVANCE_CATEGORY_LABELS[tx.category]
                : null
            return (
              <tr key={tx._id} className="text-gray-700">
                <td className="py-2.5 pr-3 whitespace-nowrap text-gray-500">
                  {tx.date ? formatDate(tx.date) : '—'}
                </td>
                <td className="py-2.5 pr-3">
                  <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                    {meta.label}
                  </span>
                </td>
                <td className="py-2.5 pr-3 max-w-[220px]">
                  <span className="block truncate">{tx.reason || '—'}</span>
                  {categoryLabel && (
                    <span className="text-xs text-gray-400">{categoryLabel}</span>
                  )}
                </td>
                <td className={`py-2.5 pr-3 text-right font-medium whitespace-nowrap ${meta.color}`}>
                  {tx.type === 'observacao' ? '—' : `${meta.sign} ${formatCurrency(tx.amount)}`}
                </td>
                <td className="py-2.5 pr-3 text-xs text-gray-500">
                  {STATUS_LABELS[tx.status] ?? tx.status}
                </td>
                <td className="py-2.5 pr-3 text-xs text-gray-500 max-w-[120px] truncate">
                  {tx.responsibleName || '—'}
                </td>
                <td className="py-2.5 text-right">
                  {canDelete && (
                    <button
                      onClick={() => onDelete(tx)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      aria-label="Excluir lançamento"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
