import mongoose, { Schema, Document, Model } from 'mongoose'

const MaterialSchema = new Schema({
  name:      { type: String, required: true },
  unit:      { type: String, enum: ['unidade', 'm3', 'kg'], required: true },
  quantity:  { type: Number, required: true, min: 0 },
  // null when the user chose not to inform the price. Zero is valid (e.g., donated).
  unitPrice: { type: Number, default: null, min: 0 },
  total:     { type: Number, default: null },
}, { _id: true })

// Labor items: discriminated by `type`. Mongoose stores all possible fields;
// only the ones matching the type are populated. API validates shape per type.
const LaborItemSchema = new Schema({
  type:        { type: String, enum: ['fixo', 'por_unidade', 'por_m2'], required: true },
  description: { type: String, required: true, trim: true },
  // fixo — individual value is optional; null means the item is covered only
  // by `labor.fixedGroupValue`. When informed, it sums to the group total.
  itemValue:   { type: Number, default: null, min: 0 },
  // por_unidade
  quantity:    { type: Number, min: 0 },
  unitPrice:   { type: Number, min: 0 },
  // por_m2
  area:          { type: Number, min: 0 },
  pricePerMeter: { type: Number, min: 0 },
  // por_unidade | por_m2 only
  subtotal:    { type: Number, min: 0 },
}, { _id: false })

const LaborSchema = new Schema({
  items:           { type: [LaborItemSchema], default: [] },
  // null when there is no fixed item in the list, or when every fixed item
  // uses its own `itemValue` exclusively.
  fixedGroupValue: { type: Number, default: null, min: 0 },
  total:           { type: Number, required: true, min: 0 },
}, { _id: false })

export interface IOrcamento extends Document {
  userId: mongoose.Types.ObjectId
  clientName: string
  clientAddress: string
  serviceName: string
  materials: Array<{
    name: string
    unit: string
    quantity: number
    unitPrice: number | null
    total: number | null
  }>
  labor: {
    items: Array<{
      type: 'fixo' | 'por_unidade' | 'por_m2'
      description: string
      itemValue?: number | null
      quantity?: number
      unitPrice?: number
      area?: number
      pricePerMeter?: number
      subtotal?: number
    }>
    fixedGroupValue: number | null
    total: number
  }
  materialsTotal: number
  grandTotal: number
  createdAt: Date
  updatedAt: Date
}

const OrcamentoSchema = new Schema<IOrcamento>(
  {
    userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientName:    { type: String, required: [true, 'Nome do cliente obrigatório'], trim: true },
    clientAddress: { type: String, required: [true, 'Endereço obrigatório'], trim: true },
    serviceName:   { type: String, required: [true, 'Nome do serviço obrigatório'], trim: true },
    materials:     { type: [MaterialSchema], default: [] },
    labor:         { type: LaborSchema, required: true },
    materialsTotal:{ type: Number, required: true, min: 0 },
    grandTotal:    { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
)

const Orcamento: Model<IOrcamento> =
  mongoose.models.Orcamento ?? mongoose.model<IOrcamento>('Orcamento', OrcamentoSchema)

export default Orcamento