'use client'

import { useMemo, useState } from 'react'
import { Employee, EmployeeTransaction, CompanyInfo, EmployeeFinancials } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { computeNetPayment, PAYMENT_TYPE_LABELS, ADVANCE_CATEGORY_LABELS } from '@/lib/payroll'
import { generateComprovantePDF } from '@/lib/employeePdf'

interface Props {
  employee: Employee
  transactions: EmployeeTransaction[]
  financials: EmployeeFinancials
  company: CompanyInfo
  onClose: () => void
  onPaid: () => void
}

export default function PaymentModal({
  employee,
  transactions,
  financials,
  company,
  onClose,
  onPaid,
}: Props) {
  // Diaristas: base = dias presentes × diária. Demais: salário cheio menos
  // uma diária por falta.
  const isDaily = employee.paymentType === 'diario'
  const workedDays = financials.workedDays ?? 0
  const absenceDays = financials.absenceDays ?? 0
  const absenceDeduction = financials.absenceDeduction ?? 0
  const dailyRate = financials.dailyRate ?? 0
  const baseAmount = isDaily
    ? financials.accumulatedValue ?? 0
    : Math.max(0, employee.baseSalary - absenceDeduction)
  // Pendências descontáveis (adiantamentos + dívidas).
  const pendings = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.status === 'pendente' &&
          (t.type === 'adiantamento' || t.type === 'divida_inicial')
      ),
    [transactions]
  )

  // Todas selecionadas por padrão.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(pendings.map((p) => p._id!))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Quando preenchido, o modal exibe a confirmação com a próxima data de pagamento.
  const [done, setDone] = useState<{
    payment: EmployeeTransaction
    nextPaymentDate: string
    netAmount: number
  } | null>(null)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pendingAdvances = pendings
    .filter((p) => p.type === 'adiantamento' && selected.has(p._id!))
    .reduce((s, p) => s + p.amount, 0)
  const pendingDebts = pendings
    .filter((p) => p.type === 'divida_inicial' && selected.has(p._id!))
    .reduce((s, p) => s + p.amount, 0)

  const result = computeNetPayment({
    baseSalary: baseAmount,
    pendingAdvances,
    pendingDebts,
  })
  const exceedsSalary = baseAmount - result.totalDiscounts < 0

  async function handlePay() {
    if (exceedsSalary) {
      return setError('Os descontos selecionados excedem o valor a receber. Deselecione parte deles.')
    }
    setError('')
    setLoading(true)
    const res = await fetch(`/api/funcionarios/${employee._id}/pagamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discountTransactionIds: Array.from(selected) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setLoading(false)
      return setError(data.message ?? 'Erro ao processar pagamento.')
    }

    // Gera o comprovante em PDF automaticamente.
    try {
      await generateComprovantePDF(data.payment, employee, company)
    } catch (e) {
      console.error('Falha ao gerar comprovante', e)
    }
    setLoading(false)
    // Mostra a confirmação com a próxima data de pagamento (não fecha ainda).
    setDone({
      payment: data.payment,
      nextPaymentDate: data.nextPaymentDate,
      netAmount: result.netAmount,
    })
  }

  async function redownload() {
    if (!done) return
    try {
      await generateComprovantePDF(done.payment, employee, company)
    } catch (e) {
      console.error('Falha ao gerar comprovante', e)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {done ? 'Pagamento concluído' : 'Pagar funcionário'}
          </h2>
          <button
            onClick={done ? onPaid : onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Fechar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Confirmação após o pagamento — destaca a próxima data de pagamento */}
        {done ? (
          <div>
            <div className="flex items-center gap-2 text-green-700 mb-4">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-medium">
                Pagamento de {employee.fullName} registrado com sucesso.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 mb-4">
              <div className="flex justify-between px-4 py-3 text-sm">
                <span className="text-gray-600">Valor líquido pago</span>
                <span className="font-bold text-gray-900">{formatCurrency(done.netAmount)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-brand-50">
                <span className="flex items-center gap-2 font-semibold text-gray-900">
                  <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Próximo pagamento
                </span>
                <span className="font-bold text-lg text-brand-600">
                  {done.nextPaymentDate ? formatDate(done.nextPaymentDate) : '—'}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              O comprovante em PDF foi baixado automaticamente. O ciclo foi fechado e o próximo
              vencimento já está agendado.
            </p>

            <div className="flex gap-3">
              <button onClick={onPaid} className="btn-primary flex-1">Concluir</button>
              <button onClick={redownload} className="btn-secondary flex-1">Baixar comprovante</button>
            </div>
          </div>
        ) : (
        <>
        {/* Resumo do funcionário */}
        <div className="rounded-lg bg-[#FAFAFA] border border-gray-200 p-4 mb-4">
          <p className="font-semibold text-gray-900">{employee.fullName}</p>
          <p className="text-xs text-gray-500">
            {employee.role} · {PAYMENT_TYPE_LABELS[employee.paymentType]}
          </p>
          {employee.nextPaymentDate && (
            <p className="text-xs text-gray-500 mt-1">
              Vencimento atual: {formatDate(employee.nextPaymentDate)}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Descontos */}
        {pendings.length > 0 ? (
          <div className="mb-4">
            <p className="label">Descontos a aplicar</p>
            <div className="space-y-2">
              {pendings.map((p) => (
                <label
                  key={p._id}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    checked={selected.has(p._id!)}
                    onChange={() => toggle(p._id!)}
                  />
                  <span className="flex-1 text-sm">
                    <span className="font-medium text-gray-800">
                      {p.type === 'adiantamento' ? 'Adiantamento' : 'Dívida'}
                    </span>
                    {p.type === 'adiantamento' && p.category && (
                      <span className="text-gray-400"> · {ADVANCE_CATEGORY_LABELS[p.category]}</span>
                    )}
                    {p.reason && <span className="block text-xs text-gray-400">{p.reason}</span>}
                  </span>
                  <span className="text-sm font-medium text-red-600">− {formatCurrency(p.amount)}</span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">Nenhum desconto pendente.</p>
        )}

        {/* Cálculo do líquido */}
        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 mb-4">
          {isDaily ? (
            <>
              <Row
                label="Dias trabalhados"
                value={`${workedDays} × ${formatCurrency(employee.baseSalary)}`}
              />
              <Row label="Bruto acumulado" value={formatCurrency(result.baseSalary)} />
            </>
          ) : (
            <>
              <Row label="Salário base" value={formatCurrency(employee.baseSalary)} />
              {absenceDays > 0 && (
                <Row
                  label={`Faltas (${absenceDays} × ${formatCurrency(dailyRate)})`}
                  value={`− ${formatCurrency(absenceDeduction)}`}
                  valueClass="text-red-600"
                />
              )}
            </>
          )}
          <Row label="Adiantamentos pendentes" value={`− ${formatCurrency(result.advancesDiscounted)}`}
            valueClass="text-red-600" />
          <Row label="Dívidas pendentes" value={`− ${formatCurrency(result.debtsDiscounted)}`}
            valueClass="text-red-600" />
          <div className="flex justify-between px-4 py-3 bg-brand-50">
            <span className="font-bold text-gray-900">Valor líquido a receber</span>
            <span className={`font-bold text-xl ${exceedsSalary ? 'text-red-600' : 'text-brand-600'}`}>
              {formatCurrency(result.netAmount)}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Ao confirmar, o pagamento é registrado (não pode ser excluído), os descontos
          selecionados são quitados, o próximo vencimento é recalculado e o comprovante em
          PDF é gerado automaticamente.
        </p>

        {isDaily && workedDays === 0 && (
          <p className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-700">
            Nenhum dia trabalhado registrado neste ciclo. Registre a presença antes de pagar.
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handlePay}
            disabled={loading || exceedsSalary || (isDaily && workedDays === 0)}
            className="btn-primary flex-1"
          >
            {loading ? 'Processando...' : 'Confirmar pagamento'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
        </div>
        </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between px-4 py-2.5 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={`font-medium text-gray-900 ${valueClass ?? ''}`}>{value}</span>
    </div>
  )
}
