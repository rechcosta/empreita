'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { EmployeeDetail, EmployeeTransaction } from '@/types'
import { formatCurrency, formatCPF, formatDate } from '@/lib/utils'
import { PAYMENT_TYPE_LABELS } from '@/lib/payroll'
import FinancialHistory from '@/components/funcionario/FinancialHistory'
import AdvanceModal from '@/components/funcionario/AdvanceModal'
import ObservationModal from '@/components/funcionario/ObservationModal'
import ConfirmDialog from '@/components/funcionario/ConfirmDialog'
import PaymentModal from '@/components/funcionario/PaymentModal'

export default function FuncionarioDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { data: session } = useSession()
  const [detail, setDetail] = useState<EmployeeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdvance, setShowAdvance] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [actionError, setActionError] = useState('')
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [txToDelete, setTxToDelete] = useState<EmployeeTransaction | null>(null)
  const [deletingTx, setDeletingTx] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/funcionarios/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        setDetail(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Erro ao carregar funcionário.')
        setLoading(false)
      })
  }, [params.id])

  useEffect(() => {
    load()
  }, [load])

  async function handleArchive() {
    setArchiving(true)
    const res = await fetch(`/api/funcionarios/${params.id}`, { method: 'DELETE' })
    setArchiving(false)
    if (res.ok) {
      router.push('/funcionarios')
      router.refresh()
    } else {
      setConfirmArchive(false)
      setActionError('Erro ao arquivar.')
    }
  }

  async function handleDeleteTx() {
    if (!txToDelete) return
    setDeletingTx(true)
    const res = await fetch(`/api/funcionarios/${params.id}/transacoes/${txToDelete._id}`, {
      method: 'DELETE',
    })
    setDeletingTx(false)
    setTxToDelete(null)
    if (res.ok) load()
    else {
      const data = await res.json().catch(() => ({}))
      setActionError(data.message ?? 'Erro ao excluir.')
    }
  }

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

  if (error || !detail) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
        {error || 'Funcionário não encontrado.'}
      </div>
    )
  }

  const { employee, transactions, financials } = detail

  return (
    <div className="max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3 mb-6">
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-700 mt-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="page-title">{employee.fullName}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {employee.role} · {PAYMENT_TYPE_LABELS[employee.paymentType]} ·{' '}
            {formatCurrency(employee.baseSalary)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/funcionarios/${employee._id}/editar`} className="btn-secondary text-sm py-2">
            Editar
          </Link>
          <button onClick={() => setConfirmArchive(true)} className="btn-danger text-sm py-2">Arquivar</button>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-700" aria-label="Fechar">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Ações principais */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={() => setShowPayment(true)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Pagar funcionário
        </button>
        <button onClick={() => setShowAdvance(true)} className="btn-secondary">
          + Adiantamento
        </button>
        <button onClick={() => setShowNote(true)} className="btn-secondary">+ Observação</button>
        <Link href="/funcionarios/presenca" className="btn-secondary">Registrar presença</Link>
      </div>

      {/* Indicadores financeiros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {employee.paymentType === 'diario' ? (
          <Indicator
            label="Acumulado (dias trabalhados)"
            value={`${formatCurrency(financials.accumulatedValue ?? 0)} · ${financials.workedDays ?? 0}d`}
          />
        ) : (financials.absenceDays ?? 0) > 0 ? (
          <Indicator
            label={`Salário base (− ${financials.absenceDays} falta${(financials.absenceDays ?? 0) > 1 ? 's' : ''})`}
            value={`${formatCurrency(employee.baseSalary)} · − ${formatCurrency(financials.absenceDeduction ?? 0)}`}
            accent="text-red-600"
          />
        ) : (
          <Indicator label="Salário base" value={formatCurrency(employee.baseSalary)} />
        )}
        <Indicator label="Adiantamentos pendentes"
          value={formatCurrency(financials.pendingAdvancesTotal)} accent="text-amber-600" />
        <Indicator label="Dívidas pendentes"
          value={formatCurrency(financials.pendingDebtsTotal)} accent="text-red-600" />
        <Indicator label="Líquido previsto"
          value={formatCurrency(financials.netForecast)} accent="text-brand-600" />
      </div>

      {/* Previsão de próximo pagamento */}
      <div className="card p-6 mb-6">
        <h2 className="section-title">Previsão de próximo pagamento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Próxima data</p>
            <p className="text-lg font-semibold text-gray-900">
              {financials.nextPaymentDate ? formatDate(financials.nextPaymentDate) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Valor previsto</p>
            <p className="text-lg font-semibold text-brand-600">
              {formatCurrency(financials.netForecast)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Descontos previstos</p>
            <p className="text-lg font-semibold text-red-600">
              {formatCurrency(financials.totalDiscountsPending)}
            </p>
          </div>
        </div>
      </div>

      {/* Dados cadastrais */}
      <div className="card p-6 mb-6">
        <h2 className="section-title">Dados cadastrais</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Field label="CPF" value={employee.cpf ? formatCPF(employee.cpf) : '—'} />
          <Field label="Telefone" value={employee.phone || '—'} />
          <Field label="Data de nascimento"
            value={employee.birthDate ? formatDate(employee.birthDate) : '—'} />
          <Field label="Data de admissão"
            value={employee.admissionDate ? formatDate(employee.admissionDate) : '—'} />
          <Field label="Endereço" value={employee.address || '—'} />
          <Field label="Observações" value={employee.notes || '—'} />
        </dl>
      </div>

      {/* Histórico financeiro */}
      <div className="card p-6">
        <h2 className="section-title">Histórico financeiro</h2>
        <FinancialHistory
          transactions={transactions}
          onDelete={(tx) => setTxToDelete(tx)}
        />
      </div>

      {/* Modais */}
      {showAdvance && (
        <AdvanceModal
          employeeId={employee._id!}
          onClose={() => setShowAdvance(false)}
          onSaved={() => {
            setShowAdvance(false)
            load()
          }}
        />
      )}
      {showNote && (
        <ObservationModal
          employeeId={employee._id!}
          onClose={() => setShowNote(false)}
          onSaved={() => {
            setShowNote(false)
            load()
          }}
        />
      )}
      {confirmArchive && (
        <ConfirmDialog
          title="Arquivar funcionário"
          message="O funcionário será arquivado (soft delete). O histórico financeiro é preservado para auditoria."
          confirmLabel="Arquivar"
          danger
          loading={archiving}
          onConfirm={handleArchive}
          onClose={() => setConfirmArchive(false)}
        />
      )}
      {txToDelete && (
        <ConfirmDialog
          title="Excluir lançamento"
          message="Este lançamento será excluído (soft delete). Pagamentos não podem ser excluídos."
          confirmLabel="Excluir"
          danger
          loading={deletingTx}
          onConfirm={handleDeleteTx}
          onClose={() => setTxToDelete(null)}
        />
      )}
      {showPayment && session && (
        <PaymentModal
          employee={employee}
          transactions={transactions}
          financials={financials}
          company={{
            companyName: session.user.companyName,
            cnpj: session.user.cnpj,
            logoBase64: session.user.logoBase64,
            email: session.user.email!,
            address: session.user.address,
            phone: session.user.phone,
          }}
          onClose={() => setShowPayment(false)}
          onPaid={() => {
            setShowPayment(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function Indicator({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold mt-1 ${accent ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-gray-900 mt-0.5">{value}</dd>
    </div>
  )
}
