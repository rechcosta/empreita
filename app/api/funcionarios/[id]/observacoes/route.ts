import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Employee from '@/models/Employee'
import EmployeeTransaction from '@/models/EmployeeTransaction'
import mongoose from 'mongoose'

type Params = { params: { id: string } }

/** Registra uma observação (nota livre, sem efeito financeiro) no extrato. */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })
  if (!mongoose.Types.ObjectId.isValid(params.id))
    return NextResponse.json({ message: 'ID inválido.' }, { status: 400 })

  try {
    const body = await req.json()
    const { reason } = body as { reason?: string }
    if (!reason?.trim()) {
      return NextResponse.json({ message: 'Informe o texto da observação.' }, { status: 400 })
    }

    await connectDB()
    const employee = await Employee.findOne({
      _id: params.id,
      userId: session.user.id,
      deletedAt: null,
    }).lean()
    if (!employee) return NextResponse.json({ message: 'Não encontrado.' }, { status: 404 })

    const tx = await EmployeeTransaction.create({
      userId: session.user.id,
      employeeId: params.id,
      type: 'observacao',
      amount: 0,
      date: new Date(),
      reason: reason.trim(),
      status: 'registrado',
      responsibleUserId: session.user.id,
      responsibleName: session.user.companyName,
    })

    return NextResponse.json(tx, { status: 201 })
  } catch (err) {
    console.error('[POST /api/funcionarios/:id/observacoes]', err)
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 })
  }
}
