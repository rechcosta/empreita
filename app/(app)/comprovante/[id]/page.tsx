'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Employee, EmployeeTransaction } from '@/types'
import { formatCurrency, formatCPF, formatDate } from '@/lib/utils'
import { PAYMENT_TYPE_LABELS } from '@/lib/payroll'
import { generateComprovantePDF } from '@/lib/employeePdf'

/**
 * Página-destino do QR Code do comprovante. Ao escanear no celular, abre aqui,
 * regenera o PDF e dispara o download automaticamente. Também oferece um botão
 * para baixar de novo, já que alguns navegadores bloqueiam download automático.
 */
export default function ComprovantePage({ params }: { params: { id: string } }) {
  const { data: session } = useSession()
  const [payment, setPayment] = useState<EmployeeTransaction | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const autoTried = useRef(false)

  useEffect(() => {
    fetch(`/api/comprovantes/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        setPayment(data.payment)
        setEmployee(data.employee)
        setLoading(false)
      })
      .catch(() => {
        setError('Comprovante não encontrado.')
        setLoading(false)
      })
  }, [params.id])

  const download = useCallback(async () => {
    if (!payment || !employee || !session) return
    setGenerating(true)
    try {
      await generateComprovantePDF(payment, employee, {
        companyName: session.user.companyName,
        cnpj: session.user.cnpj,
        logoBase64: session.user.logoBase64,
        email: session.user.email!,
        address: session.user.address,
        phone: session.user.phone,
      })
    } catch (e) {
      console.error('Falha ao gerar comprovante', e)
      setError('Não foi possível gerar o PDF.')
    } finally {
      setGenerating(false)
    }
  }, [payment, employee, session])

  // Tenta baixar automaticamente assim que os dados e a sessão estão prontos.
  useEffect(() => {
    if (autoTried.current) return
    if (payment && employee && session) {
      autoTried.current = true
      download()
    }
  }, [payment, employee, session, download])

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

  if (error || !payment || !employee) {
    return (
      <div className="max-w-md mx-auto">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          {error || 'Comprovante não encontrado.'}
        </div>
        <Link href="/funcionarios" className="btn-secondary mt-4 inline-flex">Voltar</Link>
      </div>
    )
  }

  const details = payment.paymentDetails

  return (
    <div className="max-w-md mx-auto">
      <div className="card p-6">
        <div className="flex items-center gap-2 text-green-700 mb-4">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <h1 className="text-lg font-semibold text-gray-900">Comprovante de pagamento</h1>
        </div>

        <dl className="space-y-2 text-sm">
          <Row label="Funcionário" value={employee.fullName} />
          <Row label="CPF" value={employee.cpf ? formatCPF(employee.cpf) : '—'} />
          <Row label="Cargo" value={employee.role} />
          <Row label="Pagamento" value={PAYMENT_TYPE_LABELS[employee.paymentType]} />
          <Row label="Data" value={payment.date ? formatDate(payment.date) : '—'} />
          {details && (
            <>
              <div className="border-t border-gray-100 my-2" />
              <Row label="Salário base" value={formatCurrency(details.baseSalary)} />
              <Row label="Adiantamentos" value={`− ${formatCurrency(details.advancesDiscounted)}`} />
              <Row label="Dívidas" value={`− ${formatCurrency(details.debtsDiscounted)}`} />
              <div className="flex justify-between pt-2">
                <span className="font-bold text-gray-900">Valor líquido pago</span>
                <span className="font-bold text-brand-600 text-lg">
                  {formatCurrency(details.netAmount)}
                </span>
              </div>
            </>
          )}
        </dl>

        <button onClick={download} disabled={generating} className="btn-primary w-full mt-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {generating ? 'Gerando PDF...' : 'Baixar comprovante (PDF)'}
        </button>

        <Link
          href={`/funcionarios/${employee._id}`}
          className="btn-secondary w-full mt-3 inline-flex"
        >
          Ver funcionário
        </Link>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium text-right">{value}</dd>
    </div>
  )
}
