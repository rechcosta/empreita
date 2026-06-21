'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AttendanceRow } from '@/types'
import { formatCurrency } from '@/lib/utils'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function PresencaPage() {
  const [date, setDate] = useState(today())
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const load = useCallback((d: string) => {
    setLoading(true)
    setSaved(false)
    fetch(`/api/funcionarios/presenca?date=${d}`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        setRows(data.rows)
        setLoading(false)
      })
      .catch(() => {
        setError('Erro ao carregar presenças.')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load(date)
  }, [date, load])

  function toggle(employeeId: string, present: boolean) {
    setRows((prev) => prev.map((r) => (r.employeeId === employeeId ? { ...r, present } : r)))
    setSaved(false)
  }

  function setAll(present: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, present })))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/funcionarios/presenca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        entries: rows.map((r) => ({ employeeId: r.employeeId, present: r.present })),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return setError(data.message ?? 'Erro ao salvar presenças.')
    }
    setSaved(true)
  }

  const presentCount = rows.filter((r) => r.present).length
  // Custo do dia = soma do valor/dia dos presentes.
  const totalForDay = rows
    .filter((r) => r.present)
    .reduce((s, r) => s + r.dailyRate, 0)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-700">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="page-title">Registrar presença</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Marque quem trabalhou no dia. Diaristas acumulam o valor da diária por dia presente.
        Mensais, semanais e quinzenais têm uma diária descontada por falta (salário ÷ dias
        úteis: mês 22, quinzena 10, semana 5).
      </p>

      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-4">
          <div>
            <label className="label">Data</label>
            <input
              type="date"
              className="input-base"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {rows.length > 0 && (
            <div className="flex gap-2 sm:ml-auto">
              <button type="button" onClick={() => setAll(true)} className="btn-secondary text-sm">
                Todos presentes
              </button>
              <button type="button" onClick={() => setAll(false)} className="btn-secondary text-sm">
                Todos ausentes
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <svg className="animate-spin h-7 w-7 text-brand-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            Nenhum funcionário cadastrado.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 border-y border-gray-100">
              {rows.map((r) => (
                <li key={r.employeeId} className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.fullName}</p>
                    <p className="text-xs text-gray-500">
                      {r.role} · valor/dia {formatCurrency(r.dailyRate)}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => toggle(r.employeeId, true)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                        r.present
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Presente
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(r.employeeId, false)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                        !r.present
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Ausente
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-500">
                {presentCount} de {rows.length} presentes · total do dia{' '}
                <span className="font-semibold text-gray-700">{formatCurrency(totalForDay)}</span>
              </p>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar presença'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
