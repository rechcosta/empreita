import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Recibo from '@/models/Recibo'
import mongoose from 'mongoose'
import { sanitizeReciboItems, positiveNumber } from '@/lib/recibo'

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
  const recibo = await Recibo.findOne({ _id: params.id, userId: session!.user.id }).lean()
  if (!recibo) return NextResponse.json({ message: 'Não encontrado.' }, { status: 404 })
  return NextResponse.json(recibo)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { session, error } = await authorize(params.id)
  if (error) return error

  try {
    const body = await req.json()
    if (!body.clientName || !body.clientName.toString().trim()) {
      return NextResponse.json({ message: 'Informe o nome do tomador (Firma ou Sr.).' }, { status: 400 })
    }

    await connectDB()
    const recibo = await Recibo.findOneAndUpdate(
      { _id: params.id, userId: session!.user.id },
      {
        city: (body.city ?? '').toString().trim(),
        date: body.date ? new Date(body.date) : new Date(),
        clientName: body.clientName.toString().trim(),
        clientAddress: (body.clientAddress ?? '').toString().trim(),
        clientAddressNumber: (body.clientAddressNumber ?? '').toString().trim(),
        clientNeighborhood: (body.clientNeighborhood ?? '').toString().trim(),
        clientCity: (body.clientCity ?? '').toString().trim(),
        clientState: (body.clientState ?? '').toString().trim(),
        clientCnpj: (body.clientCnpj ?? '').toString().trim(),
        clientInscricaoEstadual: (body.clientInscricaoEstadual ?? '').toString().trim(),
        items: sanitizeReciboItems(body.items),
        laborTotal: positiveNumber(body.laborTotal),
        materialsTotal: positiveNumber(body.materialsTotal),
        total: positiveNumber(body.total),
      },
      { new: true, runValidators: true }
    )
    if (!recibo) return NextResponse.json({ message: 'Não encontrado.' }, { status: 404 })
    return NextResponse.json(recibo)
  } catch (err) {
    console.error('[PUT /api/recibos/:id]', err)
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { session, error } = await authorize(params.id)
  if (error) return error

  await connectDB()
  const recibo = await Recibo.findOneAndDelete({ _id: params.id, userId: session!.user.id })
  if (!recibo) return NextResponse.json({ message: 'Não encontrado.' }, { status: 404 })
  return NextResponse.json({ message: 'Excluído com sucesso.' })
}
