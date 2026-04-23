import OrcamentoFormPage from '@/components/orcamento/OrcamentoFormPage'

export default function EditarOrcamentoPage({ params }: { params: { id: string } }) {
  return <OrcamentoFormPage mode="edit" id={params.id} />
}
