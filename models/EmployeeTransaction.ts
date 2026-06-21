import mongoose, { Schema, Document, Model } from 'mongoose'
import {
  TransactionType,
  TransactionStatus,
  AdvanceCategory,
} from '@/types'

/**
 * Lançamento no extrato financeiro de um funcionário — a fonte de verdade
 * auditável de toda movimentação (dívidas, adiantamentos, pagamentos,
 * observações).
 *
 * Regras de auditoria aplicadas (ver regras do módulo):
 * - Multi-tenant: toda query filtra por `userId`.
 * - Responsável (`responsibleUserId`/`responsibleName`) e data/hora
 *   (`createdAt`) registrados em todo lançamento.
 * - Exclusão é soft (`deletedAt`). Lançamentos de `pagamento` NUNCA podem ser
 *   excluídos — a regra é imposta na rota de API.
 */
const PaymentDetailsSchema = new Schema(
  {
    baseSalary: { type: Number, required: true, min: 0 },
    advancesDiscounted: { type: Number, required: true, min: 0 },
    debtsDiscounted: { type: Number, required: true, min: 0 },
    totalDiscounts: { type: Number, required: true, min: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    periodLabel: { type: String, default: '' },
    discountedTransactionIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'EmployeeTransaction' }],
      default: [],
    },
  },
  { _id: false }
)

export interface IEmployeeTransaction extends Document {
  userId: mongoose.Types.ObjectId
  employeeId: mongoose.Types.ObjectId
  type: TransactionType
  amount: number
  date: Date
  reason?: string
  category?: AdvanceCategory | null
  status: TransactionStatus
  paymentDetails?: {
    baseSalary: number
    advancesDiscounted: number
    debtsDiscounted: number
    totalDiscounts: number
    netAmount: number
    periodLabel?: string
    discountedTransactionIds: mongoose.Types.ObjectId[]
  } | null
  settledByPaymentId?: mongoose.Types.ObjectId | null
  responsibleUserId?: mongoose.Types.ObjectId
  responsibleName?: string
  deletedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

const EmployeeTransactionSchema = new Schema<IEmployeeTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    type: {
      type: String,
      enum: ['divida_inicial', 'adiantamento', 'pagamento', 'observacao'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0, default: 0 },
    date: { type: Date, required: true, default: Date.now },
    reason: { type: String, trim: true, default: '' },
    category: {
      type: String,
      enum: ['vale', 'emprestimo', 'emergencia', 'equipamentos', 'outro'],
      default: null,
    },
    status: {
      type: String,
      enum: ['pendente', 'quitado', 'pago', 'registrado'],
      required: true,
    },
    paymentDetails: { type: PaymentDetailsSchema, default: null },
    settledByPaymentId: { type: Schema.Types.ObjectId, ref: 'EmployeeTransaction', default: null },
    responsibleUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    responsibleName: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

// Extrato de um funcionário (mais recentes primeiro).
EmployeeTransactionSchema.index({ employeeId: 1, deletedAt: 1, date: -1 })
// Agregações de pendências por empresa (dashboard, listagem, pagamento).
EmployeeTransactionSchema.index({ userId: 1, type: 1, status: 1, deletedAt: 1 })

const EmployeeTransaction: Model<IEmployeeTransaction> =
  mongoose.models.EmployeeTransaction ??
  mongoose.model<IEmployeeTransaction>('EmployeeTransaction', EmployeeTransactionSchema)

export default EmployeeTransaction
