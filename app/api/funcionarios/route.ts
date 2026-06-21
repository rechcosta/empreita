import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Employee from '@/models/Employee'
import EmployeeTransaction from '@/models/EmployeeTransaction'
import { aggregatePendingByEmployee, aggregateOpenAttendance } from '@/lib/employeeFinancials'
import { computeFirstPaymentDate, computeDailyRate } from '@/lib/payroll'
import { validateCPF } from '@/lib/utils'
import { PaymentType } from '@/types'

const VALID_PAYMENT_TYPES: PaymentType[] = ['diario', 'semanal', 'quinzenal', 'mensal']

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })

  await connectDB()
  const employees = await Employee.find({ userId: session.user.id, deletedAt: null })
    .sort({ fullName: 1 })
    .lean()

  const pending = await aggregatePendingByEmployee(session.user.id)
  const attendanceMap = await aggregateOpenAttendance(session.user.id)

  // Anexa os totais pendentes e o líquido previsto a cada funcionário.
  // Diaristas: base = dias presentes × diária. Demais: salário cheio menos uma
  // diária por falta.
  const enriched = employees.map((e) => {
    const totals = pending.get(e._id.toString()) ?? { advances: 0, debts: 0 }
    const att = attendanceMap.get(e._id.toString()) ?? { present: 0, absent: 0 }
    const isDaily = e.paymentType === 'diario'
    const dailyRate = computeDailyRate(e.paymentType, e.baseSalary)

    let workedDays: number | undefined
    let accumulatedValue: number | undefined
    let absenceDays: number | undefined
    let absenceDeduction: number | undefined
    let base: number
    if (isDaily) {
      workedDays = att.present
      accumulatedValue = Math.round(workedDays * e.baseSalary * 100) / 100
      base = accumulatedValue
    } else {
      absenceDays = att.absent
      absenceDeduction = Math.round(absenceDays * dailyRate * 100) / 100
      base = Math.max(0, e.baseSalary - absenceDeduction)
    }
    const netForecast = Math.max(0, base - totals.advances - totals.debts)
    return {
      ...e,
      pendingAdvancesTotal: totals.advances,
      pendingDebtsTotal: totals.debts,
      netForecast,
      workedDays,
      accumulatedValue,
      absenceDays,
      absenceDeduction,
    }
  })

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })

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
      initialDebt,
    } = body as {
      fullName?: string
      cpf?: string
      birthDate?: string | null
      phone?: string
      address?: string
      role?: string
      admissionDate?: string | null
      notes?: string
      paymentType?: PaymentType
      baseSalary?: number
      initialDebt?: { amount?: number; reason?: string } | null
    }

    if (!fullName?.trim() || !cpf?.trim() || !role?.trim() || !paymentType) {
      return NextResponse.json({ message: 'Dados incompletos.' }, { status: 400 })
    }
    if (!VALID_PAYMENT_TYPES.includes(paymentType)) {
      return NextResponse.json({ message: 'Tipo de pagamento inválido.' }, { status: 400 })
    }
    const cpfDigits = cpf.replace(/\D/g, '')
    if (!validateCPF(cpfDigits)) {
      return NextResponse.json({ message: 'CPF inválido.' }, { status: 400 })
    }
    const salary = Number(baseSalary)
    if (!Number.isFinite(salary) || salary < 0) {
      return NextResponse.json({ message: 'Salário base inválido.' }, { status: 400 })
    }

    await connectDB()

    // Bloqueia CPF duplicado dentro da mesma empresa (entre ativos).
    const exists = await Employee.findOne({
      userId: session.user.id,
      cpf: cpfDigits,
      deletedAt: null,
    }).lean()
    if (exists) {
      return NextResponse.json(
        { message: 'Já existe um funcionário com este CPF.' },
        { status: 409 }
      )
    }

    // Primeiro vencimento calculado a partir de HOJE — a admissão pode ser
    // muito anterior (ex: funcionário antigo) e geraria previsão no passado.
    // Mensal cai na última sexta do mês; os demais, na próxima sexta.
    const nextPaymentDate = computeFirstPaymentDate(paymentType, new Date())

    const employee = await Employee.create({
      userId: session.user.id,
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
      active: true,
      createdByUserId: session.user.id,
      createdByName: session.user.companyName,
    })

    // Dívida inicial opcional → vira lançamento pendente no extrato.
    if (initialDebt && Number(initialDebt.amount) > 0) {
      await EmployeeTransaction.create({
        userId: session.user.id,
        employeeId: employee._id,
        type: 'divida_inicial',
        amount: Number(initialDebt.amount),
        date: new Date(),
        reason: initialDebt.reason?.trim() || 'Dívida inicial',
        status: 'pendente',
        responsibleUserId: session.user.id,
        responsibleName: session.user.companyName,
      })
    }

    return NextResponse.json(employee, { status: 201 })
  } catch (err) {
    console.error('[POST /api/funcionarios]', err)
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 })
  }
}
