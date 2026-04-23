import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Orcamento from '@/models/Orcamento'
import mongoose from 'mongoose'
import { computeLaborTotal } from '@/lib/labor'
import { Labor } from '@/types'

type Params = { params: { id: string } }

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
  const orc = await Orcamento.findOne({ _id: params.id, userId: session!.user.id }).lean()
  if (!orc) return NextResponse.json({ message: 'Não encontrado.' }, { status: 404 })
  return NextResponse.json(orc)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { session, error } = await authorize(params.id)
  if (error) return error

  try {
    const body = await req.json()
    const { clientName, clientAddress, serviceName, materials, labor } = body as {
      clientName: string
      clientAddress: string
      serviceName: string
      materials?: Array<{ total: number | null }>
      labor: Labor
    }

    const materialsTotal = (materials ?? []).reduce(
      (acc, m) => (m.total !== null && m.total !== undefined ? acc + m.total : acc),
      0
    )

    const laborTotal = computeLaborTotal(labor)
    const laborSafe: Labor = { ...labor, total: laborTotal }

    const grandTotal = materialsTotal + laborTotal

    await connectDB()
    const orc = await Orcamento.findOneAndUpdate(
      { _id: params.id, userId: session!.user.id },
      {
        clientName: clientName?.trim(),
        clientAddress: clientAddress?.trim(),
        serviceName: serviceName?.trim(),
        materials,
        labor: laborSafe,
        materialsTotal,
        grandTotal,
      },
      { new: true, runValidators: true }
    )
    if (!orc) return NextResponse.json({ message: 'Não encontrado.' }, { status: 404 })
    return NextResponse.json(orc)
  } catch (err) {
    console.error('[PUT /api/orcamentos/:id]', err)
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { session, error } = await authorize(params.id)
  if (error) return error

  await connectDB()
  const orc = await Orcamento.findOneAndDelete({ _id: params.id, userId: session!.user.id })
  if (!orc) return NextResponse.json({ message: 'Não encontrado.' }, { status: 404 })
  return NextResponse.json({ message: 'Excluído com sucesso.' })
}