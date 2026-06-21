import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Employee from '@/models/Employee'
import EmployeeTransaction from '@/models/EmployeeTransaction'
import { aggregatePendingByEmployee } from '@/lib/employeeFinancials'
import mongoose from 'mongoose'

/**
 * Indicadores e séries do dashboard de funcionários:
 * - Totais: nº de funcionários, folha salarial, adiantamentos e dívidas pendentes.
 * - Próximos pagamentos (ordenados por vencimento).
 * - Série mensal de pagamentos (evolução da folha + nº de pagamentos).
 * - Adiantamentos por funcionário.
 *
 * Nota: este segmento estático (`/dashboard`) tem precedência sobre `[id]` no
 * App Router, então não há conflito de rota.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })

  await connectDB()
  const userId = session.user.id
  const userObjectId = new mongoose.Types.ObjectId(userId)

  const employees = await Employee.find({ userId, deletedAt: null })
    .sort({ nextPaymentDate: 1 })
    .lean()

  const pending = await aggregatePendingByEmployee(userId)

  // Soma apenas as pendências de funcionários NÃO excluídos. Arquivar um
  // funcionário não apaga as transações dele, então iteramos sobre a lista de
  // ativos (já filtrada por deletedAt: null) em vez de todo o mapa.
  let pendingAdvancesTotal = 0
  let pendingDebtsTotal = 0
  employees.forEach((e) => {
    const totals = pending.get(e._id.toString())
    if (!totals) return
    pendingAdvancesTotal += totals.advances
    pendingDebtsTotal += totals.debts
  })

  const payrollTotal = employees.reduce((s, e) => s + e.baseSalary, 0)

  // Próximos pagamentos — até 6, com líquido previsto.
  const upcomingPayments = employees.slice(0, 6).map((e) => {
    const totals = pending.get(e._id.toString()) ?? { advances: 0, debts: 0 }
    return {
      employeeId: e._id.toString(),
      fullName: e.fullName,
      role: e.role,
      nextPaymentDate: e.nextPaymentDate ?? null,
      netForecast: Math.max(0, e.baseSalary - totals.advances - totals.debts),
    }
  })

  // Série mensal de pagamentos (últimos 6 meses).
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  sixMonthsAgo.setHours(0, 0, 0, 0)

  const monthlyRaw = await EmployeeTransaction.aggregate<{
    _id: { y: number; m: number }
    total: number
    count: number
  }>([
    {
      $match: {
        userId: userObjectId,
        deletedAt: null,
        type: 'pagamento',
        date: { $gte: sixMonthsAgo },
      },
    },
    {
      $group: {
        _id: { y: { $year: '$date' }, m: { $month: '$date' } },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ])

  // Preenche os 6 meses (inclusive os sem pagamento) na ordem cronológica.
  const monthMap = new Map<string, { total: number; count: number }>()
  for (const row of monthlyRaw) {
    monthMap.set(`${row._id.y}-${row._id.m}`, { total: row.total, count: row.count })
  }
  const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const monthlyPayments: Array<{ month: string; total: number; count: number }> = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo)
    d.setMonth(d.getMonth() + i)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    const entry = monthMap.get(key) ?? { total: 0, count: 0 }
    monthlyPayments.push({
      month: `${MONTH_LABELS[d.getMonth()]}/${d.getFullYear().toString().slice(-2)}`,
      total: entry.total,
      count: entry.count,
    })
  }

  // Adiantamentos por funcionário (total histórico), top 8.
  const advancesRaw = await EmployeeTransaction.aggregate<{
    _id: mongoose.Types.ObjectId
    total: number
  }>([
    {
      $match: {
        userId: userObjectId,
        deletedAt: null,
        type: 'adiantamento',
      },
    },
    { $group: { _id: '$employeeId', total: { $sum: '$amount' } } },
    { $sort: { total: -1 } },
    { $limit: 8 },
  ])

  // Mantém apenas funcionários não excluídos (presentes em `employees`).
  const nameById = new Map(employees.map((e) => [e._id.toString(), e.fullName]))
  const advancesByEmployee = advancesRaw
    .filter((row) => nameById.has(row._id.toString()))
    .map((row) => ({
      fullName: nameById.get(row._id.toString())!,
      total: row.total,
    }))

  return NextResponse.json({
    totalEmployees: employees.length,
    payrollTotal,
    pendingAdvancesTotal,
    pendingDebtsTotal,
    upcomingPayments,
    monthlyPayments,
    advancesByEmployee,
  })
}
