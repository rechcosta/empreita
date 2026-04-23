import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Orcamento from '@/models/Orcamento'
import { computeLaborTotal } from '@/lib/labor'
import { Labor } from '@/types'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })

  await connectDB()
  const orcamentos = await Orcamento
    .find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .lean()

  return NextResponse.json(orcamentos)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })

  try {
    const body = await req.json()
    const { clientName, clientAddress, serviceName, materials, labor } = body as {
      clientName: string
      clientAddress: string
      serviceName: string
      materials?: Array<{ total: number | null }>
      labor: Labor
    }

    if (!clientName || !clientAddress || !serviceName || !labor) {
      return NextResponse.json({ message: 'Dados incompletos.' }, { status: 400 })
    }

    // Sum only materials with informed price (`total !== null`).
    const materialsTotal = (materials ?? []).reduce(
      (acc, m) => (m.total !== null && m.total !== undefined ? acc + m.total : acc),
      0
    )

    // Recompute labor total server-side (never trust the client's own sum).
    const laborTotal = computeLaborTotal(labor)
    const laborSafe: Labor = { ...labor, total: laborTotal }

    const grandTotal = materialsTotal + laborTotal

    await connectDB()
    const orc = await Orcamento.create({
      userId: session.user.id,
      clientName: clientName.trim(),
      clientAddress: clientAddress.trim(),
      serviceName: serviceName.trim(),
      materials: materials ?? [],
      labor: laborSafe,
      materialsTotal,
      grandTotal,
    })

    return NextResponse.json(orc, { status: 201 })
  } catch (err) {
    console.error('[POST /api/orcamentos]', err)
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 })
  }
}