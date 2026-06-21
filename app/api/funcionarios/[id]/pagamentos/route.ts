import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Employee from '@/models/Employee'
import EmployeeTransaction from '@/models/EmployeeTransaction'
import Attendance from '@/models/Attendance'
import {
  computeNetPayment,
  computeNextPaymentDate,
  computeDailyBase,
  computeDailyRate,
  PAYMENT_TYPE_LABELS,
} from '@/lib/payroll'
import { formatDate } from '@/lib/utils'
import mongoose from 'mongoose'

type Params = { params: { id: string } }

/**
 * Efetua o pagamento de um funcionário (fechamento automático do ciclo):
 *
 * 1. Recalcula o líquido no servidor (Salário Base − adiantamentos − dívidas).
 * 2. Cria o lançamento `pagamento` (status `pago`) com o detalhamento — nunca
 *    excluível, base do comprovante em PDF.
 * 3. Quita os adiantamentos/dívidas descontados (status `quitado`, vinculados
 *    ao pagamento).
 * 4. Avança `nextPaymentDate` para o próximo ciclo conforme o tipo salarial.
 *
 * `discountTransactionIds` (opcional) permite escolher quais pendências
 * descontar; por padrão, desconta todas as pendentes.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })
  if (!mongoose.Types.ObjectId.isValid(params.id))
    return NextResponse.json({ message: 'ID inválido.' }, { status: 400 })

  try {
    const body = await req.json().catch(() => ({}))
    const { discountTransactionIds, paymentDate } = body as {
      discountTransactionIds?: string[]
      paymentDate?: string
    }

    await connectDB()

    const employee = await Employee.findOne({
      _id: params.id,
      userId: session.user.id,
      deletedAt: null,
    })
    if (!employee) return NextResponse.json({ message: 'Não encontrado.' }, { status: 404 })

    // Pendências do funcionário (adiantamentos + dívidas).
    const pendings = await EmployeeTransaction.find({
      employeeId: params.id,
      userId: session.user.id,
      deletedAt: null,
      status: 'pendente',
      type: { $in: ['adiantamento', 'divida_inicial'] },
    })

    // Seleciona quais descontar. Se o cliente ENVIOU a lista (mesmo vazia),
    // respeita exatamente a escolha — nada selecionado = nada descontado, e os
    // adiantamentos/dívidas não escolhidos seguem pendentes para o próximo
    // pagamento. Só na ausência total do campo (chamada sem corpo) é que cai no
    // padrão de descontar todas as pendências.
    const idSet = Array.isArray(discountTransactionIds)
      ? new Set(discountTransactionIds)
      : null
    const selected = idSet
      ? pendings.filter((p) => idSet.has(p._id.toString()))
      : pendings

    const pendingAdvances = selected
      .filter((p) => p.type === 'adiantamento')
      .reduce((s, p) => s + p.amount, 0)
    const pendingDebts = selected
      .filter((p) => p.type === 'divida_inicial')
      .reduce((s, p) => s + p.amount, 0)

    // Presenças/faltas em aberto (não pagas). Diaristas ACUMULAM por presença;
    // os demais DESCONTAM uma diária por falta. Em ambos, todos os registros do
    // ciclo são quitados ao pagar.
    const openAttendance = await Attendance.find({
      employeeId: employee._id,
      userId: session.user.id,
      settledByPaymentId: null,
    }).select('_id present')
    const presentDays = openAttendance.filter((a) => a.present).length
    const absentDays = openAttendance.filter((a) => !a.present).length
    const openAttendanceIds = openAttendance.map((a) => a._id)

    const dailyRate = computeDailyRate(employee.paymentType, employee.baseSalary)
    let baseAmount: number
    let daysWorked: number | undefined
    let absenceDays: number | undefined
    let absenceDeduction: number | undefined
    if (employee.paymentType === 'diario') {
      daysWorked = presentDays
      baseAmount = computeDailyBase(dailyRate, presentDays)
    } else {
      absenceDays = absentDays
      absenceDeduction = Math.round(absentDays * dailyRate * 100) / 100
      baseAmount = Math.max(0, employee.baseSalary - absenceDeduction)
    }

    const result = computeNetPayment({
      baseSalary: baseAmount,
      pendingAdvances,
      pendingDebts,
    })

    // Trava de segurança: descontos não podem exceder a base (líquido < 0).
    if (baseAmount - result.totalDiscounts < 0) {
      return NextResponse.json(
        {
          message:
            'Os descontos selecionados excedem o valor a receber. Deselecione parte deles para concluir o pagamento.',
        },
        { status: 400 }
      )
    }

    const payDate = paymentDate ? new Date(paymentDate) : new Date()
    const periodLabel = `${PAYMENT_TYPE_LABELS[employee.paymentType]} · pago em ${formatDate(
      payDate.toISOString()
    )}`

    // 2. Cria o pagamento (auditável, imutável).
    const payment = await EmployeeTransaction.create({
      userId: session.user.id,
      employeeId: employee._id,
      type: 'pagamento',
      amount: result.netAmount,
      date: payDate,
      reason: periodLabel,
      status: 'pago',
      paymentDetails: {
        // Diarista: base = bruto acumulado. Demais: salário cheio (a falta é
        // mostrada como desconto à parte no comprovante).
        baseSalary:
          employee.paymentType === 'diario' ? result.baseSalary : employee.baseSalary,
        advancesDiscounted: result.advancesDiscounted,
        debtsDiscounted: result.debtsDiscounted,
        totalDiscounts: result.totalDiscounts,
        netAmount: result.netAmount,
        daysWorked,
        dailyRate,
        absenceDays,
        absenceDeduction,
        periodLabel,
        discountedTransactionIds: selected.map((s) => s._id),
      },
      responsibleUserId: session.user.id,
      responsibleName: session.user.companyName,
    })

    // 3. Quita as pendências descontadas.
    if (selected.length > 0) {
      await EmployeeTransaction.updateMany(
        { _id: { $in: selected.map((s) => s._id) }, userId: session.user.id },
        { status: 'quitado', settledByPaymentId: payment._id }
      )
    }

    // 3b. Quita os registros de presença do ciclo (presenças e faltas) para
    // não contarem no próximo pagamento.
    if (openAttendanceIds.length > 0) {
      await Attendance.updateMany(
        { _id: { $in: openAttendanceIds }, userId: session.user.id },
        { settledByPaymentId: payment._id }
      )
    }

    // 4. Avança o próximo vencimento a partir da COMPETÊNCIA agendada (a que
    // está sendo paga), não da data em que se pagou — assim pagar a
    // competência de julho agenda agosto, mesmo pagando adiantado.
    const anchor = employee.nextPaymentDate ?? payDate
    let nextPaymentDate = computeNextPaymentDate(employee.paymentType, anchor)
    // Salvaguarda contra atraso extremo: nunca agenda um vencimento no passado.
    if (nextPaymentDate.getTime() <= payDate.getTime()) {
      nextPaymentDate = computeNextPaymentDate(employee.paymentType, payDate)
    }
    employee.nextPaymentDate = nextPaymentDate
    await employee.save()

    return NextResponse.json(
      {
        payment,
        nextPaymentDate,
        employee: { _id: employee._id, fullName: employee.fullName },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/funcionarios/:id/pagamentos]', err)
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 })
  }
}
