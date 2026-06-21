import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Employee from '@/models/Employee'
import EmployeeTransaction from '@/models/EmployeeTransaction'
import mongoose from 'mongoose'

type Params = { params: { id: string } }

/**
 * Retorna os dados de um comprovante de pagamento (lançamento `pagamento`)
 * para regerar o PDF — usado pela página /comprovante/[id], que é o destino
 * do QR Code impresso no próprio comprovante.
 *
 * Tenant-scoped: só devolve comprovantes da empresa logada (404 caso
 * contrário, evitando vazar a existência do documento).
 */
export async function GET(_: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })
  if (!mongoose.Types.ObjectId.isValid(params.id))
    return NextResponse.json({ message: 'ID inválido.' }, { status: 400 })

  await connectDB()

  const payment = await EmployeeTransaction.findOne({
    _id: params.id,
    userId: session.user.id,
    type: 'pagamento',
    deletedAt: null,
  }).lean()
  if (!payment) return NextResponse.json({ message: 'Comprovante não encontrado.' }, { status: 404 })

  const employee = await Employee.findOne({
    _id: payment.employeeId,
    userId: session.user.id,
  }).lean()
  if (!employee) return NextResponse.json({ message: 'Funcionário não encontrado.' }, { status: 404 })

  return NextResponse.json({ payment, employee })
}
