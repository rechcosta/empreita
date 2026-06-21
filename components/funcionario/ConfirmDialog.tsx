'use client'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

/**
 * Diálogo de confirmação. Substitui window.confirm(), que não é suportado em
 * alguns ambientes (webview/preview) — onde dispara "confirm() is not supported".
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`${danger ? 'btn-danger' : 'btn-primary'} flex-1`}
          >
            {loading ? 'Processando...' : confirmLabel}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
