import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * Presença de um diarista num dia. Cada dia marcado como presente acumula um
 * valor diário (= baseSalary do funcionário) a receber no próximo pagamento.
 *
 * - Multi-tenant via `userId`.
 * - Um registro por (employeeId, date); `date` é normalizada para 00:00 UTC.
 * - `settledByPaymentId` marca os dias já pagos, para não contarem de novo
 *   (mesmo padrão dos adiantamentos/dívidas).
 * - Auditoria: responsável + timestamps.
 */
export interface IAttendance extends Document {
  userId: mongoose.Types.ObjectId
  employeeId: mongoose.Types.ObjectId
  date: Date
  present: boolean
  settledByPaymentId?: mongoose.Types.ObjectId | null
  responsibleUserId?: mongoose.Types.ObjectId
  responsibleName?: string
  createdAt: Date
  updatedAt: Date
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: Date, required: true },
    present: { type: Boolean, required: true, default: true },
    settledByPaymentId: { type: Schema.Types.ObjectId, ref: 'EmployeeTransaction', default: null },
    responsibleUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    responsibleName: { type: String, default: '' },
  },
  { timestamps: true }
)

// Um registro por funcionário por dia (upsert no roll-call).
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true })
// Agregação de dias trabalhados em aberto por empresa.
AttendanceSchema.index({ userId: 1, present: 1, settledByPaymentId: 1 })

const Attendance: Model<IAttendance> =
  mongoose.models.Attendance ?? mongoose.model<IAttendance>('Attendance', AttendanceSchema)

export default Attendance
