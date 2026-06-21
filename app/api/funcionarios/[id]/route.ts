import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Employee from '@/models/Employee'
import EmployeeTransaction from '@/models/EmployeeTransaction'
import { getPendingTotals, getOpenAttendance } from '@/lib/employeeFinancials'
import { computeFirstPaymentDate, computeDailyRate } from '@/lib/payroll'
import { validateCPF } from '@/lib/utils'
import mongoose from 'mongoose'
import { PaymentType } from '@/types'

type Params = { params: { id: string } }

const VALID_PAYMENT_TYPES: PaymentType[] = ['diario', 'semanal', 'quinzenal', 'mensal']

async function authorize(id: string) {
  const session = await getServerSession(authOptions)
  if (!session) return { error: NextResponse.json({ message: 'Não autorizado.' }, { status: 401 }) }
  if (!mongoose.Types.ObjectId.isValid(id))
    return { error: NextResponse.json({ message: 'ID inválido.' }, { status: 400 }) }
  return { session }
}

export async function GET(_: NextRequest, { params }: Params) {
  const { session, error } = await authorize(params.id)
  if (error) return error

  await connectDB()
  const employee = await Employee.findOne({
    _id: params.id,
    userId: session!.user.id,
    deletedAt: null,
  }).lean()
  if (!employee) return NextResponse.json({ message: 'Não encontrado.' }, { status: 404 })

  const transactions = await EmployeeTransaction.find({
    employeeId: params.id,
    userId: session!.user.id,
    deletedAt: null,
  })
    .sort({ date: -1, createdAt: -1 })
    .lean()

  const totals = await getPendingTotals(session!.user.id, params.id)
  const totalDiscountsPending = totals.advances + totals.debts

  // Presença em aberto. Diaristas: base = dias presentes × diária. Demais:
  // salário cheio menos uma diária por falta.
  const attendance = await getOpenAttendance(session!.user.id, params.id)
  const dailyRate = computeDailyRate(employee.paymentType, employee.baseSalary)
  let workedDays: number | undefined
  let accumulatedValue: number | undefined
  let absenceDays: number | undefined
  let absenceDeduction: number | undefined
  let baseAmount: number
  if (employee.paymentType === 'diario') {
    workedDays = attendance.present
    accumulatedValue = Math.round(workedDays * employee.baseSalary * 100) / 100
    baseAmount = accumulatedValue
  } else {
    absenceDays = attendance.absent
    absenceDeduction = Math.round(absenceDays * dailyRate * 100) / 100
    baseAmount = Math.max(0, employee.baseSalary - absenceDeduction)
  }

  const netForecast = Math.max(0, baseAmount - totalDiscountsPending)

  return NextResponse.json({
    employee,
    transactions,
    financials: {
      pendingAdvancesTotal: totals.advances,
      pendingDebtsTotal: totals.debts,
      totalDiscountsPending,
      netForecast,
      nextPaymentDate: employee.nextPaymentDate ?? null,
      dailyRate,
      workedDays,
      accumulatedValue,
      absenceDays,
      absenceDeduction,
    },
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { session, error } = await authorize(params.id)
  if (error) return error

  try {
    const body = await req.json()
    const {
      fullName,
      cpf,
      birthDate,
      phone,
      address,
      role,
      admissionDate,
      notes,
      paymentType,
      baseSalary,
    } = body as Record<string, any>

    if (!fullName?.trim() || !cpf?.trim() || !role?.trim() || !paymentType) {
      return NextResponse.json({ message: 'Dados incompletos.' }, { status: 400 })
    }
    if (!VALID_PAYMENT_TYPES.includes(paymentType)) {
      return NextResponse.json({ message: 'Tipo de pagamento inválido.' }, { status: 400 })
    }
    const cpfDigits = String(cpf).replace(/\D/g, '')
    if (!validateCPF(cpfDigits)) {
      return NextResponse.json({ message: 'CPF inválido.' }, { status: 400 })
    }
    const salary = Number(baseSalary)
    if (!Number.isFinite(salary) || salary < 0) {
      return NextResponse.json({ message: 'Salário base inválido.' }, { status: 400 })
    }

    await connectDB()

    // CPF não pode colidir com outro funcionário ativo da mesma empresa.
    const clash = await Employee.findOne({
      userId: session!.user.id,
      cpf: cpfDigits,
      deletedAt: null,
      _id: { $ne: params.id },
    }).lean()
    if (clash) {
      return NextResponse.json(
        { message: 'Já existe um funcionário com este CPF.' },
        { status: 409 }
      )
    }

    const current = await Employee.findOne({
      _id: params.id,
      userId: session!.user.id,
      deletedAt: null,
    })
    if (!current) return NextResponse.json({ message: 'Não encontrado.' }, { status: 404 })

    // Auto-cura do vencimento: recalcula a partir de hoje (sempre numa sexta)
    // quando a previsão está vazia, no passado, ou o tipo de pagamento mudou.
    // Resolve funcionários antigos cujo vencimento ficou preso na admissão.
    const now = new Date()
    const stale =
      !current.nextPaymentDate ||
      current.nextPaymentDate < now ||
      current.paymentType !== paymentType
    const nextPaymentDate = stale
      ? computeFirstPaymentDate(paymentType, now)
      : current.nextPaymentDate

    current.set({
      fullName: fullName.trim(),
      cpf: cpfDigits,
      birthDate: birthDate ? new Date(birthDate) : null,
      phone: phone?.trim() ?? '',
      address: address?.trim() ?? '',
      role: role.trim(),
      admissionDate: admissionDate ? new Date(admissionDate) : null,
      notes: notes?.trim() ?? '',
      paymentType,
      baseSalary: salary,
      nextPaymentDate,
    })
    await current.save()
    return NextResponse.json(current)
  } catch (err) {
    console.error('[PUT /api/funcionarios/:id]', err)
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 })
  }
}

/**
 * Soft delete — nunca remove fisicamente. O histórico financeiro (incluindo
 * pagamentos) permanece no banco para auditoria.
 */
export async function DELETE(_: NextRequest, { params }: Params) {
  const { session, error } = await authorize(params.id)
  if (error) return error

  await connectDB()
  const employee = await Employee.findOneAndUpdate(
    { _id: params.id, userId: session!.user.id, deletedAt: null },
    { deletedAt: new Date(), active: false },
    { new: true }
  )
  if (!employee) return NextResponse.json({ message: 'Não encontrado.' }, { status: 404 })
  return NextResponse.json({ message: 'Funcionário arquivado com sucesso.' })
}
