import EmployeeForm from '@/components/funcionario/EmployeeForm'

export default function EditarFuncionarioPage({ params }: { params: { id: string } }) {
  return <EmployeeForm mode="edit" id={params.id} />
}
