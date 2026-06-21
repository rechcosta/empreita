'use client'

import { formatCurrency } from '@/lib/utils'

/**
 * Gráficos leves em CSS/SVG puro — sem dependência externa de charting,
 * coerente com a filosofia do projeto de evitar complexidade prematura.
 */

interface VerticalDatum {
  label: string
  value: number
  /** valor secundário opcional exibido no tooltip/legenda (ex: nº pagamentos) */
  secondary?: number
}

/** Gráfico de barras verticais — usado para a evolução mensal da folha. */
export function VerticalBars({
  data,
  formatValue = formatCurrency,
}: {
  data: VerticalDatum[]
  formatValue?: (n: number) => string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex items-end justify-between gap-2 h-44 pt-4">
      {data.map((d, i) => {
        const heightPct = (d.value / max) * 100
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
            <span className="text-[10px] text-gray-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {formatValue(d.value)}
            </span>
            <div
              className="w-full max-w-[36px] rounded-t bg-brand-500/80 hover:bg-brand-500 transition-colors"
              style={{ height: `${Math.max(heightPct, d.value > 0 ? 4 : 0)}%` }}
              title={formatValue(d.value)}
            />
            <span className="text-[10px] text-gray-500 mt-1.5 whitespace-nowrap">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

interface HorizontalDatum {
  label: string
  value: number
}

/** Gráfico de barras horizontais — usado para adiantamentos por funcionário. */
export function HorizontalBars({ data }: { data: HorizontalDatum[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500 py-6 text-center">Sem dados no período.</p>
  }
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="space-y-3 pt-2">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-700 truncate max-w-[60%]">{d.label}</span>
            <span className="text-gray-500 font-medium">{formatCurrency(d.value)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-500/80"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
