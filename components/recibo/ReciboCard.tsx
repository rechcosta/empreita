'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Recibo } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { generateReciboPDF } from '@/lib/reciboPdf'

interface Props {
  recibo: Recibo
  onDelete: (id: string) => void
}

export default function ReciboCard({ recibo, onDelete }: Props) {
  const { data: session } = useSession()
  const { _id, number, clientName, total, date, items } = recibo

  const numberLabel =
    number !== undefined && number !== null
      ? `REC-${number.toString().padStart(4, '0')}`
      : null

  function handleDownload() {
    if (!session) return
    generateReciboPDF(recibo, {
      companyName: session.user.companyName,
      cnpj: session.user.cnpj,
      logoBase64: session.user.logoBase64,
      email: session.user.email!,
      address: session.user.address,
      phone: session.user.phone,
    })
  }

  return (
    <div className="card p-5 flex flex-col gap-3 hover:border-gray-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {numberLabel && (
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              {numberLabel}
            </p>
          )}
          <h3 className="font-semibold text-gray-900 truncate">{clientName || 'Sem tomador'}</h3>
          {date && <p className="text-xs text-gray-500 mt-0.5">{formatDate(date)}</p>}
        </div>
        <span className="flex-shrink-0 text-sm font-bold text-brand-600 bg-brand-50 rounded-lg px-2 py-1">
          {formatCurrency(total)}
        </span>
      </div>

      <div className="text-xs text-gray-500 border-t border-gray-100 pt-3">
        {items.length} {items.length === 1 ? 'item' : 'itens'} de serviço
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={handleDownload} className="btn-secondary flex-1 text-xs py-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          PDF
        </button>
        <Link href={`/recibos/${_id}/editar`} className="btn-secondary flex-1 text-xs py-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editar
        </Link>
        <button onClick={() => onDelete(_id!)} className="btn-danger flex-1 text-xs py-1.5">
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
