'use client'

import { useState, FormEvent, ChangeEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatCNPJ, validateCNPJ } from '@/lib/utils'
import { Logo } from '@/components/brand/Logo'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    companyName: '',
    cnpj: '',
    email: '',
    password: '',
    confirmPassword: '',
    logoBase64: '',
  })

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    if (name === 'cnpj') {
      setForm((p) => ({ ...p, cnpj: formatCNPJ(value) }))
    } else {
      setForm((p) => ({ ...p, [name]: value }))
    }
  }

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo deve ter no máximo 2MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setLogoPreview(result)
      setForm((p) => ({ ...p, logoBase64: result }))
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!validateCNPJ(form.cnpj)) {
      setError('CNPJ inválido. Verifique o número digitado.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    if (form.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: form.companyName,
        cnpj: form.cnpj,
        email: form.email,
        password: form.password,
        logoBase64: form.logoBase64 || null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.message ?? 'Erro ao criar conta.')
      setLoading(false)
      return
    }

    await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    })

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#FAFAFA]">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Logo variant="lockup" size={56} />
          <p className="text-gray-500 text-sm mt-3">Crie sua conta gratuitamente</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Dados da empresa</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Logo upload */}
            <div>
              <label className="label">Logo da empresa (opcional)</label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-14 w-14 rounded-lg object-cover border border-gray-200" />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div>
                  <label className="btn-secondary cursor-pointer text-xs">
                    {logoPreview ? 'Trocar imagem' : 'Enviar logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG até 2MB</p>
                </div>
              </div>
            </div>

            <div>
              <label className="label">Nome da empresa *</label>
              <input name="companyName" type="text" className="input-base"
                placeholder="Construtora Silva Ltda." value={form.companyName}
                onChange={handleChange} required />
            </div>

            <div>
              <label className="label">CNPJ *</label>
              <input name="cnpj" type="text" className="input-base"
                placeholder="00.000.000/0000-00" value={form.cnpj}
                onChange={handleChange} required maxLength={18} />
            </div>

            <div>
              <label className="label">Email *</label>
              <input name="email" type="email" className="input-base"
                placeholder="contato@empresa.com" value={form.email}
                onChange={handleChange} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Senha *</label>
                <input name="password" type="password" className="input-base"
                  placeholder="Min. 6 caracteres" value={form.password}
                  onChange={handleChange} required />
              </div>
              <div>
                <label className="label">Confirmar senha *</label>
                <input name="confirmPassword" type="password" className="input-base"
                  placeholder="Repetir senha" value={form.confirmPassword}
                  onChange={handleChange} required />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Já tem conta?{' '}
          <Link href="/login" className="text-brand-600 font-semibold hover:text-brand-700">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}