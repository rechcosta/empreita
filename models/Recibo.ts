import mongoose, { Schema, Document, Model } from 'mongoose'

const ReciboItemSchema = new Schema(
  {
    // null = em branco (ex.: serviço por preço fixo, sem quantidade).
    quantity:    { type: Number, default: null, min: 0 },
    description: { type: String, default: '', trim: true },
    value:       { type: Number, default: null, min: 0 },
  },
  { _id: false }
)

export interface IRecibo extends Document {
  userId: mongoose.Types.ObjectId
  /**
   * Sequencial por empresa (1, 2, 3…). Atribuído na criação via Counter
   * (`recibo:{userId}`). Opcional para documentos legados; o PDF cai num
   * formato derivado do ObjectId quando ausente.
   */
  number?: number
  orcamentoId?: mongoose.Types.ObjectId | null
  city: string
  date: Date
  clientName: string
  clientAddress: string
  clientAddressNumber: string
  clientNeighborhood: string
  clientCity: string
  clientState: string
  clientCnpj: string
  clientInscricaoEstadual: string
  items: Array<{
    quantity: number | null
    description: string
    value: number | null
  }>
  laborTotal: number
  materialsTotal: number
  total: number
  createdAt: Date
  updatedAt: Date
}

const ReciboSchema = new Schema<IRecibo>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    number:      { type: Number, default: null, min: 1 },
    orcamentoId: { type: Schema.Types.ObjectId, ref: 'Orcamento', default: null },
    city:        { type: String, default: '', trim: true },
    date:        { type: Date, required: true, default: Date.now },
    clientName:  { type: String, required: [true, 'Nome do tomador obrigatório'], trim: true },
    clientAddress:           { type: String, default: '', trim: true },
    clientAddressNumber:     { type: String, default: '', trim: true },
    clientNeighborhood:      { type: String, default: '', trim: true },
    clientCity:              { type: String, default: '', trim: true },
    clientState:             { type: String, default: '', trim: true },
    clientCnpj:              { type: String, default: '', trim: true },
    clientInscricaoEstadual: { type: String, default: '', trim: true },
    items:          { type: [ReciboItemSchema], default: [] },
    laborTotal:     { type: Number, required: true, min: 0, default: 0 },
    materialsTotal: { type: Number, required: true, min: 0, default: 0 },
    total:          { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
)

// Listagem do dashboard de recibos (mais recentes primeiro) e busca por número.
ReciboSchema.index({ userId: 1, createdAt: -1 })
ReciboSchema.index({ userId: 1, number: 1 })

const Recibo: Model<IRecibo> =
  mongoose.models.Recibo ?? mongoose.model<IRecibo>('Recibo', ReciboSchema)

export default Recibo
