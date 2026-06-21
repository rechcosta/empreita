import mongoose, { Schema, Document, Model } from 'mongoose'
import { PaymentType } from '@/types'

/**
 * Funcionário de uma empresa (tenant). Isolamento multi-tenant via `userId` —
 * toda query filtra por ele. Exclusão é soft (`deletedAt`), nunca física:
 * o histórico financeiro associado precisa permanecer auditável.
 */
export interface IEmployee extends Document {
  userId: mongoose.Types.ObjectId
  fullName: string
  cpf: string
  birthDate?: Date | null
  phone?: string
  address?: string
  role: string
  admissionDate?: Date | null
  notes?: string
  paymentType: PaymentType
  baseSalary: number
  /** Próximo vencimento. Recalculado a cada pagamento concluído. */
  nextPaymentDate?: Date | null
  active: boolean
  deletedAt?: Date | null
  /** Auditoria — conta responsável pelo cadastro. */
  createdByUserId?: mongoose.Types.ObjectId
  createdByName?: string
  createdAt: Date
  updatedAt: Date
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fullName: { type: String, required: [true, 'Nome completo obrigatório'], trim: true },
    // Armazenado apenas com dígitos. Unicidade é por empresa (índice composto abaixo).
    cpf: { type: String, required: [true, 'CPF obrigatório'], trim: true },
    birthDate: { type: Date, default: null },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    role: { type: String, required: [true, 'Cargo obrigatório'], trim: true },
    admissionDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
    paymentType: {
      type: String,
      enum: ['diario', 'semanal', 'quinzenal', 'mensal'],
      required: [true, 'Tipo de pagamento obrigatório'],
    },
    baseSalary: { type: Number, required: [true, 'Salário base obrigatório'], min: 0 },
    nextPaymentDate: { type: Date, default: null },
    active: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, default: '' },
  },
  { timestamps: true }
)

// Listagem do tenant (ativos, ordenados por nome) e busca de próximos vencimentos.
EmployeeSchema.index({ userId: 1, deletedAt: 1, fullName: 1 })
EmployeeSchema.index({ userId: 1, nextPaymentDate: 1 })
// CPF único por empresa (parcial: ignora soft-deleted para permitir recadastro).
EmployeeSchema.index(
  { userId: 1, cpf: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
)

const Employee: Model<IEmployee> =
  mongoose.models.Employee ?? mongoose.model<IEmployee>('Employee', EmployeeSchema)

export default Employee
