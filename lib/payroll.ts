import { PaymentType, AdvanceCategory } from '@/types'

/**
 * Cálculos financeiros da gestão de funcionários.
 *
 * Seguindo a convenção do projeto (ver ARCHITECTURE.md), as fórmulas de
 * negócio vivem como funções puras num módulo testável — sem dependência de
 * banco ou request. São referenciadas tanto no preview do frontend quanto nas
 * rotas de API, que recalculam tudo no servidor antes de persistir.
 */

/** Rótulos de exibição dos tipos de pagamento. */
export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
}

/** Rótulos de exibição das categorias de adiantamento. */
export const ADVANCE_CATEGORY_LABELS: Record<AdvanceCategory, string> = {
  vale: 'Vale',
  emprestimo: 'Empréstimo',
  emergencia: 'Emergência',
  equipamentos: 'Compra de equipamentos',
  outro: 'Outro',
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Soma `days` dias a uma data, sem mutar o original. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime())
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Soma `months` meses a uma data, sem mutar o original. Quando o dia de
 * origem não existe no mês de destino (ex: 31/jan + 1 mês), faz clamp para o
 * último dia do mês — comportamento esperado para vencimentos mensais.
 */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime())
  const targetDay = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(targetDay, lastDayOfTargetMonth))
  return d
}

const FRIDAY = 5 // getDay(): domingo = 0 … sexta = 5

function startOfDay(date: Date): Date {
  const d = new Date(date.getTime())
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Retorna a própria data se já for sexta-feira; caso contrário, avança para a
 * próxima sexta. Pagamentos sempre caem na sexta — regra de negócio do módulo.
 */
export function snapToNextFriday(date: Date): Date {
  const diff = (FRIDAY - date.getDay() + 7) % 7
  return addDays(date, diff)
}

/** Última sexta-feira do mês informado (a "sexta do fim do mês"). */
export function lastFridayOfMonth(year: number, monthIndex: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0) // dia 0 do mês seguinte = último dia
  const back = (lastDay.getDay() - FRIDAY + 7) % 7
  return new Date(year, monthIndex, lastDay.getDate() - back)
}

/**
 * Avança para o PRÓXIMO vencimento, tratando `from` como a competência que
 * acabou de ser paga/agendada. Usado no fechamento do ciclo (ao pagar):
 *   diário → +1 dia · semanal → +7 dias · quinzenal → +14 dias (sempre sexta)
 *   mensal → última sexta do mês SEGUINTE ao de `from`
 *
 * Ex.: pagar a competência agendada para 24/07 (mensal) agenda a última
 * sexta de agosto (28/08), mesmo pagando adiantado.
 */
export function computeNextPaymentDate(paymentType: PaymentType, from: Date): Date {
  if (paymentType === 'mensal') {
    const next = addMonths(from, 1)
    return lastFridayOfMonth(next.getFullYear(), next.getMonth())
  }
  let candidate: Date
  switch (paymentType) {
    case 'diario':
      candidate = addDays(from, 1)
      break
    case 'semanal':
      candidate = addDays(from, 7)
      break
    case 'quinzenal':
      candidate = addDays(from, 14)
      break
  }
  return snapToNextFriday(candidate!)
}

/**
 * Primeiro vencimento (na criação do funcionário ou ao auto-curar uma
 * previsão vencida), calculado a partir de hoje:
 *   mensal → última sexta deste mês se ainda no futuro, senão a do mês seguinte
 *   demais → próxima sexta-feira
 */
export function computeFirstPaymentDate(paymentType: PaymentType, from: Date): Date {
  if (paymentType === 'mensal') {
    const thisMonth = lastFridayOfMonth(from.getFullYear(), from.getMonth())
    if (thisMonth.getTime() >= startOfDay(from).getTime()) return thisMonth
    const next = addMonths(from, 1)
    return lastFridayOfMonth(next.getFullYear(), next.getMonth())
  }
  return snapToNextFriday(from)
}

/** Valor bruto de um diarista: dias trabalhados × valor diário. */
export function computeDailyBase(dailyRate: number, workedDays: number): number {
  return round2(dailyRate * workedDays)
}

/**
 * Nº de dias do período usado para derivar o "valor de um dia", contando
 * apenas DIAS ÚTEIS: semanal 5, quinzenal 10 (2 semanas), mensal 22
 * (dias úteis comerciais), diário 1.
 *
 * Esse divisor define quanto vale um dia para descontar faltas (mensais,
 * semanais, quinzenais) e para acumular (diaristas, onde o salário já é a
 * diária, logo divisor 1).
 */
export const PERIOD_DAYS: Record<PaymentType, number> = {
  diario: 1,
  semanal: 5,
  quinzenal: 10,
  mensal: 22,
}

/**
 * Valor de um dia de trabalho, derivado do salário base e do tipo (dias úteis):
 *   diário → o próprio valor · semanal → /5 · quinzenal → /10 · mensal → /22
 *
 * Usado para acumular (diaristas) e para descontar faltas (demais tipos).
 */
export function computeDailyRate(paymentType: PaymentType, baseSalary: number): number {
  return round2(baseSalary / PERIOD_DAYS[paymentType])
}

export interface NetPaymentInput {
  baseSalary: number
  /** Soma dos adiantamentos pendentes a descontar. */
  pendingAdvances: number
  /** Soma das dívidas pendentes a descontar. */
  pendingDebts: number
}

export interface NetPaymentResult {
  baseSalary: number
  advancesDiscounted: number
  debtsDiscounted: number
  totalDiscounts: number
  /** Valor líquido = salário base − adiantamentos − dívidas (mínimo 0). */
  netAmount: number
}

/**
 * Fórmula canônica do pagamento:
 *
 *   Valor Líquido = Salário Base − Adiantamentos Pendentes − Dívidas Pendentes
 *
 * O líquido tem piso em 0: descontos nunca produzem valor negativo a pagar.
 * Quando os descontos selecionados excedem o salário, a UI/API alerta e o
 * usuário deve deselecionar parte deles (o saldo permanece pendente para o
 * próximo ciclo).
 */
export function computeNetPayment(input: NetPaymentInput): NetPaymentResult {
  const advancesDiscounted = round2(input.pendingAdvances)
  const debtsDiscounted = round2(input.pendingDebts)
  const totalDiscounts = round2(advancesDiscounted + debtsDiscounted)
  const netAmount = Math.max(0, round2(input.baseSalary - totalDiscounts))

  return {
    baseSalary: round2(input.baseSalary),
    advancesDiscounted,
    debtsDiscounted,
    totalDiscounts,
    netAmount,
  }
}
