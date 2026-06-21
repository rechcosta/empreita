import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Employee from '@/models/Employee'
import EmployeeTransaction from '@/models/EmployeeTransaction'
import mongoose from 'mongoose'
import { AdvanceCategory } from '@/types'

type Params = { params: { id: string } }

const VALID_CATEGORIES: AdvanceCategory[] = [
  'vale',
  'emprestimo',
  'emergencia',
  'equipamentos',
  'outro',
]

/**
 * Registra um adiantamento. Gera lançamento pendente vinculado ao funcionário,
 * que reduz automaticamente o próximo pagamento (descontado em
 * /pagamentos enquanto status === 'pendente').
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })
  if (!mongoose.Types.ObjectId.isValid(params.id))
    return NextResponse.json({ message: 'ID inválido.' }, { status: 400 })

  try {
    const body = await req.json()
    const { amount, date, reason, category } = body as {
      amount?: number
      date?: string
      reason?: string
      category?: AdvanceCategory
    }

    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ message: 'Informe um valor maior que zero.' }, { status: 400 })
    }
    const cat: AdvanceCategory =
      category && VALID_CATEGORIES.includes(category) ? category : 'outro'

    await connectDB()

    // Garante que o funcionário pertence à empresa e está ativo.
    const employee = await Employee.findOne({
      _id: params.id,
      userId: session.user.id,
      deletedAt: null,
    }).lean()
    if (!employee) return NextResponse.json({ message: 'Não encontrado.' }, { status: 404 })

    const tx = await EmployeeTransaction.create({
      userId: session.user.id,
      employeeId: params.id,
      type: 'adiantamento',
      amount: value,
      date: date ? new Date(date) : new Date(),
      reason: reason?.trim() ?? '',
      category: cat,
      status: 'pendente',
      responsibleUserId: session.user.id,
      responsibleName: session.user.companyName,
    })

    return NextResponse.json(tx, { status: 201 })
  } catch (err) {
    console.error('[POST /api/funcionarios/:id/adiantamentos]', err)
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 })
  }
}
