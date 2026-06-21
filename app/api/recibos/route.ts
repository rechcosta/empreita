import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Recibo from '@/models/Recibo'
import { nextSequence } from '@/models/Counter'
import { sanitizeReciboItems, positiveNumber } from '@/lib/recibo'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })

  await connectDB()
  const recibos = await Recibo
    .find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .lean()

  return NextResponse.json(recibos)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })

  try {
    const body = await req.json()
    if (!body.clientName || !body.clientName.toString().trim()) {
      return NextResponse.json({ message: 'Informe o nome do tomador (Firma ou Sr.).' }, { status: 400 })
    }

    await connectDB()

    // Reserva o próximo número antes de criar — uma falha posterior queima um
    // valor da sequência, mas preserva a monotonicidade (preferível a colisão).
    const number = await nextSequence(`recibo:${session.user.id}`)

    const recibo = await Recibo.create({
      userId: session.user.id,
      number,
      orcamentoId: body.orcamentoId || null,
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
    })

    return NextResponse.json(recibo, { status: 201 })
  } catch (err) {
    console.error('[POST /api/recibos]', err)
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 })
  }
}
