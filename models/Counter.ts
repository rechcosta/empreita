import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * Atomic counter, used for per-account sequential budget numbering.
 *
 * Each document is keyed by `name` — for budgets, we use
 * `orcamento:{userId}` so each company gets its own sequence starting at 1.
 *
 * Atomicity comes from MongoDB's `$inc` operator inside `findOneAndUpdate`
 * with `upsert: true`. Two concurrent requests will get distinct values;
 * no app-level locking is needed.
 *
 * Design choices:
 * - Per-user (not global) so two companies can both have ORC-0001.
 * - Continuous (not reset per year). Year is already in the PDF date; an
 *   extra reset rule is operational complexity for marginal UX gain.
 * - No backfill for documents created before this counter existed —
 *   the PDF generator falls back to the legacy ObjectId-based number.
 */
export interface ICounter extends Document {
  name: string
  seq: number
}

const CounterSchema = new Schema<ICounter>({
  name: { type: String, required: true, unique: true, index: true },
  seq:  { type: Number, required: true, default: 0 },
})

const Counter: Model<ICounter> =
  mongoose.models.Counter ?? mongoose.model<ICounter>('Counter', CounterSchema)

/**
 * Atomically increments and returns the next sequence value for `name`.
 * If the counter doesn't exist yet, it is created at 1.
 */
export async function nextSequence(name: string): Promise<number> {
  const result = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  )
  return result.seq
}

export default Counter