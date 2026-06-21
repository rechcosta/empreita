import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Employee from '@/models/Employee'
import Attendance from '@/models/Attendance'
import { computeDailyRate } from '@/lib/payroll'
import mongoose from 'mongoose'

/**
 * Registro de presença (roll-call) dos diaristas, por dia.
 *
 * Segmento estático irmão de `[id]` — tem precedência no App Router, mas exige
 * limpar o cache `.next` ao adicionar a rota com o dev server rodando.
 */

/** Normaliza "YYYY-MM-DD" para meia-noite UTC (chave estável do dia). */
function parseDay(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  return isNaN(d.getTime()) ? null : d
}

// GET /api/funcionarios/presenca?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })

  const dateStr = req.nextUrl.searchParams.get('date') ?? ''
  const day = parseDay(dateStr)
  if (!day) return NextResponse.json({ message: 'Data inválida.' }, { status: 400 })

  await connectDB()

  const employees = await Employee.find({
    userId: session.user.id,
    deletedAt: null,
  })
    .sort({ fullName: 1 })
    .lean()

  const records = await Attendance.find({
    userId: session.user.id,
    date: day,
  }).lean()

  const presentById = new Map(records.map((r) => [r.employeeId.toString(), r.present]))

  const rows = employees.map((e) => ({
    employeeId: e._id.toString(),
    fullName: e.fullName,
    role: e.role,
    paymentType: e.paymentType,
    baseSalary: e.baseSalary,
    dailyRate: computeDailyRate(e.paymentType, e.baseSalary),
    // Sem registro ainda → assume presente (basta desmarcar os ausentes).
    present: presentById.has(e._id.toString()) ? presentById.get(e._id.toString())! : true,
  }))

  return NextResponse.json({ date: dateStr, rows })
}

// POST /api/funcionarios/presenca  body: { date, entries: [{ employeeId, present }] }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })

  try {
    const body = await req.json()
    const { date, entries } = body as {
      date?: string
      entries?: Array<{ employeeId: string; present: boolean }>
    }

    const day = parseDay(date ?? '')
    if (!day) return NextResponse.json({ message: 'Data inválida.' }, { status: 400 })
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ message: 'Nenhuma presença informada.' }, { status: 400 })
    }

    await connectDB()

    // Restringe aos funcionários ativos da empresa.
    const validIds = new Set(
      (
        await Employee.find({
          userId: session.user.id,
          deletedAt: null,
        })
          .select('_id')
          .lean()
      ).map((e) => e._id.toString())
    )

    const ops = entries
      .filter((e) => mongoose.Types.ObjectId.isValid(e.employeeId) && validIds.has(e.employeeId))
      .map((e) => ({
        updateOne: {
          filter: { employeeId: new mongoose.Types.ObjectId(e.employeeId), date: day },
          update: {
            $set: {
              present: !!e.present,
              responsibleUserId: new mongoose.Types.ObjectId(session.user.id),
              responsibleName: session.user.companyName,
            },
            $setOnInsert: {
              userId: new mongoose.Types.ObjectId(session.user.id),
              settledByPaymentId: null,
            },
          },
          upsert: true,
        },
      }))

    if (ops.length === 0) {
      return NextResponse.json({ message: 'Nenhum diarista válido informado.' }, { status: 400 })
    }

    await Attendance.bulkWrite(ops)

    return NextResponse.json({ message: 'Presença registrada.', count: ops.length })
  } catch (err) {
    console.error('[POST /api/funcionarios/presenca]', err)
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 })
  }
}
