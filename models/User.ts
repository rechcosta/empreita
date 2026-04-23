import mongoose, { Schema, Document, Model } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IUser extends Document {
  companyName: string
  cnpj: string
  logoBase64?: string
  email: string
  password: string
  createdAt: Date
  updatedAt: Date
  comparePassword(candidate: string): Promise<boolean>
}

const UserSchema = new Schema<IUser>(
  {
    companyName: { type: String, required: [true, 'Nome da empresa obrigatório'] },
    cnpj: {
      type: String,
      required: [true, 'CNPJ obrigatório'],
      unique: true,
      trim: true,
    },
    logoBase64: { type: String, default: null },
    email: {
      type: String,
      required: [true, 'Email obrigatório'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email inválido'],
    },
    password: {
      type: String,
      required: [true, 'Senha obrigatória'],
      minlength: [6, 'Senha deve ter ao menos 6 caracteres'],
      select: false,
    },
  },
  { timestamps: true }
)

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password)
}

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema)

export default User
