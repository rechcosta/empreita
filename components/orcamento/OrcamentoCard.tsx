'use client'

import Link from 'next/link'
import { Orcamento } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props {
  orcamento: Orcamento
  onDelete: (id: string) => void
}

export default function OrcamentoCard({ orcamento, onDelete }: Props) {
  const {
    _id,
    clientName,
    serviceName,
    grandTotal,
    materialsTotal,
    createdAt,
    materials,
    labor,
  } = orcamento

  const laborItemCount = labor.items?.length ?? 0

  return (
    <div className="card p-5 flex flex-col gap-3 hover:border-gray-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{serviceName}</h3>
          {clientName && (
            <p className="text-xs text-gray-600 mt-0.5 truncate">{clientName}</p>
          )}
          {createdAt && (
            <p className="text-xs text-gray-500 mt-0.5">{formatDate(createdAt)}</p>
          )}
        </div>
        <span className="flex-shrink-0 text-sm font-bold text-brand-600 bg-brand-50 rounded-lg px-2 py-1">
          {formatCurrency(grandTotal)}
        </span>
      </div>

      <div className="text-xs text-gray-500 space-y-1 border-t border-gray-100 pt-3">
        <div className="flex justify-between">
          <span>{materials.length} material{materials.length !== 1 ? 'is' : ''}</span>
          <span className="text-gray-700">{formatCurrency(materialsTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>
            {laborItemCount} serviço{laborItemCount !== 1 ? 's' : ''} de mão de obra
          </span>
          <span className="text-gray-700">{formatCurrency(labor.total)}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Link
          href={`/orcamentos/${_id}/editar`}
          className="btn-secondary flex-1 text-xs py-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editar
        </Link>
        <button
          onClick={() => onDelete(_id!)}
          className="btn-danger flex-1 text-xs py-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Excluir
        </button>
      </div>
    </div>
  )
}