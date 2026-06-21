import { Suspense } from 'react'
import ReciboFormPage from '@/components/recibo/ReciboFormPage'

export default function EditarReciboPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <ReciboFormPage mode="edit" id={params.id} />
    </Suspense>
  )
}
