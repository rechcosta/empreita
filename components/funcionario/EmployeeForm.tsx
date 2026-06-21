'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PaymentType } from '@/types'
import { formatCPF, validateCPF } from '@/lib/utils'
import { PAYMENT_TYPE_LABELS } from '@/lib/payroll'

interface Props {
  mode: 'create' | 'edit'
  id?: string
}

interface FormState {
  fullName: string
  cpf: string
  birthDate: string
  phone: string
  address: string
  role: string
  admissionDate: string
  notes: string
  paymentType: PaymentType
  baseSalary: string
  hasInitialDebt: boolean
  initialDebtAmount: string
  initialDebtReason: string
}

const EMPTY: FormState = {
  fullName: '',
  cpf: '',
  birthDate: '',
  phone: '',
  address: '',
  role: '',
  admissionDate: '',
  notes: '',
  paymentType: 'mensal',
  baseSalary: '',
  hasInitialDebt: false,
  initialDebtAmount: '',
  initialDebtReason: '',
}

export default function EmployeeForm({ mode, id }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(mode === 'edit')
  const [error, setError] = useState('')

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  useEffect(() => {
    if (mode !== 'edit' || !id) return
    fetch(`/api/funcionarios/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const e = data.employee
        const iso = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '')
        setForm({
          ...EMPTY,
          fullName: e.fullName ?? '',
          cpf: e.cpf ? formatCPF(e.cpf) : '',
          birthDate: iso(e.birthDate),
          phone: e.phone ?? '',
          address: e.address ?? '',
          role: e.role ?? '',
          admissionDate: iso(e.admissionDate),
          notes: e.notes ?? '',
          paymentType: e.paymentType ?? 'mensal',
          baseSalary: e.baseSalary?.toString() ?? '',
        })
        setFetching(false)
      })
      .catch(() => {
        setError('Erro ao carregar funcionário.')
        setFetching(false)
      })
  }, [mode, id])

  async function handleSave() {
    if (!form.fullName.trim()) return setError('Informe o nome completo.')
    if (!validateCPF(form.cpf)) return setError('CPF inválido. Verifique o número digitado.')
    if (!form.role.trim()) return setError('Informe o cargo.')
    const salary = parseFloat(form.baseSalary)
    if (!Number.isFinite(salary) || salary < 0) return setError('Informe um salário base válido.')
    if (form.hasInitialDebt && (!form.initialDebtAmount || parseFloat(form.initialDebtAmount) <= 0)) {
      return setError('Informe o valor da dívida inicial ou desmarque a opção.')
    }

    setError('')
    setLoading(true)

    const payload: Record<string, unknown> = {
      fullName: form.fullName.trim(),
      cpf: form.cpf,
      birthDate: form.birthDate || null,
      phone: form.phone.trim(),
      address: form.address.trim(),
      role: form.role.trim(),
      admissionDate: form.admissionDate || null,
      notes: form.notes.trim(),
      paymentType: form.paymentType,
      baseSalary: salary,
    }
    if (mode === 'create' && form.hasInitialDebt) {
      payload.initialDebt = {
        amount: parseFloat(form.initialDebtAmount),
        reason: form.initialDebtReason.trim(),
      }
    }

    const url = mode === 'create' ? '/api/funcionarios' : `/api/funcionarios/${id}`
    const method = mode === 'create' ? 'POST' : 'PUT'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.message ?? 'Erro ao salvar.')

    const newId = mode === 'create' ? data._id : id
    router.push(`/funcionarios/${newId}`)
    router.refresh()
  }

  if (fetching) {
    return (
      <div className="flex justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-brand-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="page-title">
          {mode === 'create' ? 'Novo funcionário' : 'Editar funcionário'}
        </h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* 1. Dados cadastrais */}
        <div className="card p-6">
          <h2 className="section-title">1. Dados cadastrais</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Nome completo *</label>
              <input className="input-base" placeholder="Ex: João da Silva"
                value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
            </div>
            <div>
              <label className="label">CPF *</label>
              <input className="input-base" placeholder="000.000.000-00" maxLength={14}
                value={form.cpf} onChange={(e) => set('cpf', formatCPF(e.target.value))} />
            </div>
            <div>
              <label className="label">Data de nascimento</label>
              <input type="date" className="input-base"
                value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input className="input-base" placeholder="(11) 99999-9999"
                value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Cargo *</label>
              <input className="input-base" placeholder="Ex: Pedreiro, Servente"
                value={form.role} onChange={(e) => set('role', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Endereço</label>
              <input className="input-base" placeholder="Rua, número, bairro, cidade/UF"
                value={form.address} onChange={(e) => set('address', e.target.value)} />
            </div>
            <div>
              <label className="label">Data de admissão</label>
              <input type="date" className="input-base"
                value={form.admissionDate} onChange={(e) => set('admissionDate', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Observações</label>
              <textarea className="input-base min-h-[80px]" placeholder="Anotações sobre o funcionário"
                value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>
        </div>

        {/* 2. Configuração salarial */}
        <div className="card p-6">
          <h2 className="section-title">2. Configuração salarial</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de pagamento *</label>
              <select className="input-base" value={form.paymentType}
                onChange={(e) => set('paymentType', e.target.value as PaymentType)}>
                {(Object.entries(PAYMENT_TYPE_LABELS) as [PaymentType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Valor base (R$) *</label>
              <input type="number" min="0" step="0.01" className="input-base" placeholder="0,00"
                value={form.baseSalary} onChange={(e) => set('baseSalary', e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            O sistema calcula automaticamente os próximos vencimentos a partir da data de admissão.
          </p>
        </div>

        {/* 3. Dívida inicial (apenas na criação) */}
        {mode === 'create' && (
          <div className="card p-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-brand-600"
                checked={form.hasInitialDebt}
                onChange={(e) => set('hasInitialDebt', e.target.checked)} />
              <span className="section-title mb-0">Funcionário possui dívida inicial</span>
            </label>
            {form.hasInitialDebt && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="label">Valor da dívida (R$)</label>
                  <input type="number" min="0" step="0.01" className="input-base" placeholder="Ex: 800,00"
                    value={form.initialDebtAmount}
                    onChange={(e) => set('initialDebtAmount', e.target.value)} />
                </div>
                <div>
                  <label className="label">Motivo</label>
                  <input className="input-base" placeholder="Ex: Empréstimo inicial"
                    value={form.initialDebtReason}
                    onChange={(e) => set('initialDebtReason', e.target.value)} />
                </div>
                <p className="sm:col-span-2 text-xs text-gray-500">
                  A dívida será registrada no histórico financeiro como pendente e
                  descontada nos próximos pagamentos.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={handleSave} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Salvando...' : mode === 'create' ? 'Cadastrar funcionário' : 'Salvar alterações'}
          </button>
          <Link href="/funcionarios" className="btn-secondary flex-1 text-center">Cancelar</Link>
        </div>
      </div>
    </div>
  )
}
