import mongoose from 'mongoose'
import EmployeeTransaction from '@/models/EmployeeTransaction'
import Attendance from '@/models/Attendance'

/**
 * Helpers de agregação financeira (server-side — usam o banco). Mantidos fora
 * das rotas para serem reaproveitados entre listagem, detalhe e dashboard sem
 * duplicar a lógica de "o que conta como pendência".
 *
 * Pendências = adiantamentos + dívidas com status `pendente` e não excluídos.
 * Pagamentos quitam esses lançamentos (viram `quitado`), saindo do cálculo.
 */

export interface PendingTotals {
  advances: number
  debts: number
}

const PENDING_TYPES = ['adiantamento', 'divida_inicial']

/** Agrega pendências de todos os funcionários de uma empresa, por funcionário. */
export async function aggregatePendingByEmployee(
  userId: string
): Promise<Map<string, PendingTotals>> {
  const rows = await EmployeeTransaction.aggregate<{
    _id: { employeeId: mongoose.Types.ObjectId; type: string }
    total: number
  }>([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        deletedAt: null,
        status: 'pendente',
        type: { $in: PENDING_TYPES },
      },
    },
    {
      $group: {
        _id: { employeeId: '$employeeId', type: '$type' },
        total: { $sum: '$amount' },
      },
    },
  ])

  const map = new Map<string, PendingTotals>()
  for (const row of rows) {
    const key = row._id.employeeId.toString()
    const entry = map.get(key) ?? { advances: 0, debts: 0 }
    if (row._id.type === 'adiantamento') entry.advances += row.total
    else entry.debts += row.total
    map.set(key, entry)
  }
  return map
}

export interface AttendanceCounts {
  present: number
  absent: number
}

/**
 * Conta presenças e faltas em aberto (não pagas) de todos os funcionários de
 * uma empresa, por funcionário. Diaristas acumulam por presença; os demais
 * descontam uma diária por falta.
 */
export async function aggregateOpenAttendance(
  userId: string
): Promise<Map<string, AttendanceCounts>> {
  const rows = await Attendance.aggregate<{
    _id: { employeeId: mongoose.Types.ObjectId; present: boolean }
    days: number
  }>([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        settledByPaymentId: null,
      },
    },
    { $group: { _id: { employeeId: '$employeeId', present: '$present' }, days: { $sum: 1 } } },
  ])

  const map = new Map<string, AttendanceCounts>()
  for (const row of rows) {
    const key = row._id.employeeId.toString()
    const entry = map.get(key) ?? { present: 0, absent: 0 }
    if (row._id.present) entry.present += row.days
    else entry.absent += row.days
    map.set(key, entry)
  }
  return map
}

/** Presenças e faltas em aberto de um único funcionário. */
export async function getOpenAttendance(
  userId: string,
  employeeId: string
): Promise<AttendanceCounts> {
  const rows = await Attendance.aggregate<{ _id: boolean; days: number }>([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        employeeId: new mongoose.Types.ObjectId(employeeId),
        settledByPaymentId: null,
      },
    },
    { $group: { _id: '$present', days: { $sum: 1 } } },
  ])

  const counts: AttendanceCounts = { present: 0, absent: 0 }
  for (const row of rows) {
    if (row._id) counts.present = row.days
    else counts.absent = row.days
  }
  return counts
}

/** Pendências de um único funcionário. */
export async function getPendingTotals(
  userId: string,
  employeeId: string
): Promise<PendingTotals> {
  const rows = await EmployeeTransaction.aggregate<{ _id: string; total: number }>([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        employeeId: new mongoose.Types.ObjectId(employeeId),
        deletedAt: null,
        status: 'pendente',
        type: { $in: PENDING_TYPES },
      },
    },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ])

  const totals: PendingTotals = { advances: 0, debts: 0 }
  for (const row of rows) {
    if (row._id === 'adiantamento') totals.advances = row.total
    else totals.debts = row.total
  }
  return totals
}
