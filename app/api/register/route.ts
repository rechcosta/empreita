import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import User from '@/models/User'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { companyName, cnpj, email, password, logoBase64 } = body

    if (!companyName || !cnpj || !email || !password) {
      return NextResponse.json({ message: 'Campos obrigatórios faltando.' }, { status: 400 })
    }

    await connectDB()

    const exists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { cnpj }] })
    if (exists) {
      const field = exists.email === email.toLowerCase() ? 'Email' : 'CNPJ'
      return NextResponse.json({ message: `${field} já cadastrado.` }, { status: 409 })
    }

    const user = await User.create({
      companyName: companyName.trim(),
      cnpj: cnpj.replace(/\D/g, ''),
      email: email.toLowerCase().trim(),
      password,
      logoBase64: logoBase64 ?? null,
    })

    return NextResponse.json(
      { id: user._id.toString(), email: user.email, companyName: user.companyName },
      { status: 201 }
    )
  } catch (err: any) {
    console.error('[POST /api/register]', err)
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 })
  }
}
