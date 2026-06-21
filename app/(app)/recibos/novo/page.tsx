import { Suspense } from 'react'
import ReciboFormPage from '@/components/recibo/ReciboFormPage'

export default function NovoReciboPage() {
  return (
    <Suspense>
      <ReciboFormPage mode="create" />
    </Suspense>
  )
}
