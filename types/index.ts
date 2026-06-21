export type UnitType = 'unidade' | 'm3' | 'kg'
export type LaborItemType = 'fixo' | 'por_unidade' | 'por_m2'

export interface Material {
  _id?: string
  name: string
  unit: UnitType
  quantity: number
  /** null when price was not informed; zero is a valid price (e.g., donated material). */
  unitPrice: number | null
  /** null when unitPrice is null — UI/PDF must render "—" in this case. */
  total: number | null
}

/**
 * Item de preço fixo: descrição obrigatória + valor individual opcional.
 *
 * - Sem `itemValue` (null/undefined): item é coberto apenas pelo valor
 *   compartilhado do grupo (`labor.fixedGroupValue`).
 * - Com `itemValue`: o valor soma ao valor compartilhado no total do grupo
 *   de preço fixo.
 *
 * Zero é um valor válido (item listado sem custo específico) e distinto de
 * null (valor não informado).
 */
export interface LaborFixedItem {
  type: 'fixo'
  description: string
  itemValue?: number | null
}

/** Item por unidade: descrição + quantidade × valor unitário. */
export interface LaborUnitItem {
  type: 'por_unidade'
  description: string
  quantity: number
  unitPrice: number
  subtotal: number
}

/** Item por m²: descrição + área × valor por m². */
export interface LaborSqmItem {
  type: 'por_m2'
  description: string
  area: number
  pricePerMeter: number
  subtotal: number
}

export type LaborItem = LaborFixedItem | LaborUnitItem | LaborSqmItem

export interface Labor {
  items: LaborItem[]
  /**
   * Valor compartilhado entre os itens de preço fixo. Opcional:
   * - null quando não há nenhum item do tipo "fixo" na lista;
   * - também pode ser null (ou zero) quando todos os itens fixos usam apenas
   *   seus valores individuais (`itemValue`).
   */
  fixedGroupValue: number | null
  /**
   * Fórmula canônica:
   *   total = (fixedGroupValue ?? 0)
   *         + Σ (itemValue dos itens fixos)
   *         + Σ (subtotal dos itens por_unidade)
   *         + Σ (subtotal dos itens por_m2)
   */
  total: number
}

export interface Orcamento {
  _id?: string
  userId?: string
  /**
   * Per-account sequential number, formatted in the PDF as `ORC-{padded}`.
   * Optional because documents created before the counter existed don't
   * have it — the PDF generator falls back to an ObjectId-derived format.
   */
  number?: number
  clientName: string
  clientAddress: string
  serviceName: string
  materials: Material[]
  labor: Labor
  /** Sum of materials with total !== null. Materials without price are excluded. */
  materialsTotal: number
  grandTotal: number
  createdAt?: string
  updatedAt?: string
}

// ─────────────────────────────────────────────────────────────────
// Recibo de Prestação de Serviços (digitalização do bloco em papel)
// ─────────────────────────────────────────────────────────────────

/** Linha da tabela "Quant. / Descrição dos Serviços / Valores". */
export interface ReciboItem {
  /** Quantidade — null quando em branco (ex.: serviço por preço fixo). */
  quantity: number | null
  description: string
  /** Valor da linha — null quando em branco. */
  value: number | null
}

/**
 * Recibo de prestação de serviços, derivado de um orçamento mas independente
 * (campos editáveis). Numeração própria por empresa (REC-0001…) via Counter.
 */
export interface Recibo {
  _id?: string
  userId?: string
  /** Sequencial por empresa, formatado como `REC-{padded}`. */
  number?: number
  /** Orçamento de origem (quando gerado a partir de um). */
  orcamentoId?: string | null
  /** Cidade da linha de local/data ("{cidade}, dd de mês de aaaa"). */
  city: string
  /** Data do recibo (ISO). */
  date: string
  /** "Firma ou Sr." — tomador do serviço. */
  clientName: string
  clientAddress: string
  clientAddressNumber: string
  clientNeighborhood: string
  clientCity: string
  clientState: string
  clientCnpj: string
  clientInscricaoEstadual: string
  items: ReciboItem[]
  /** Mão de Obra (R$). */
  laborTotal: number
  /** Material Empregado (R$). */
  materialsTotal: number
  /** TOTAL (R$). */
  total: number
  createdAt?: string
  updatedAt?: string
}

export interface CompanyInfo {
  companyName: string
  cnpj: string
  logoBase64?: string
  email: string
  /** Optional — shown in the payment receipt header when present. */
  address?: string
  phone?: string
}

// ─────────────────────────────────────────────────────────────────
// Gestão de Funcionários (Employee management)
// ─────────────────────────────────────────────────────────────────

/** Ciclo de pagamento do funcionário. Define o cálculo do próximo vencimento. */
export type PaymentType = 'diario' | 'semanal' | 'quinzenal' | 'mensal'

/**
 * Tipos de lançamento no histórico financeiro do funcionário.
 * - `divida_inicial`  — dívida registrada no cadastro (status pendente até quitada).
 * - `adiantamento`    — vale/empréstimo/etc. (status pendente até descontado num pagamento).
 * - `pagamento`       — salário pago (status `pago`, nunca excluído).
 * - `observacao`      — nota livre, sem valor financeiro.
 */
export type TransactionType =
  | 'divida_inicial'
  | 'adiantamento'
  | 'pagamento'
  | 'observacao'

/** Categorias possíveis para um adiantamento. */
export type AdvanceCategory =
  | 'vale'
  | 'emprestimo'
  | 'emergencia'
  | 'equipamentos'
  | 'outro'

/**
 * Status de um lançamento:
 * - `pendente`   — adiantamento/dívida ainda não descontado.
 * - `quitado`    — adiantamento/dívida já descontado num pagamento.
 * - `pago`       — lançamento de pagamento concluído.
 * - `registrado` — observação (sem efeito financeiro).
 */
export type TransactionStatus = 'pendente' | 'quitado' | 'pago' | 'registrado'

/** Detalhamento financeiro persistido junto ao lançamento de `pagamento`. */
export interface PaymentDetails {
  baseSalary: number
  advancesDiscounted: number
  debtsDiscounted: number
  totalDiscounts: number
  netAmount: number
  /** Diaristas: dias trabalhados no ciclo e valor diário (base = dias × diária). */
  daysWorked?: number
  dailyRate?: number
  /** Demais tipos: faltas no ciclo e valor descontado por elas. */
  absenceDays?: number
  absenceDeduction?: number
  /** Ex: "Semanal · 12/06 a 18/06". Texto livre para o comprovante. */
  periodLabel?: string
  /** Ids dos adiantamentos/dívidas quitados por este pagamento. */
  discountedTransactionIds: string[]
}

export interface EmployeeTransaction {
  _id?: string
  userId?: string
  employeeId: string
  type: TransactionType
  amount: number
  date: string
  /** Motivo (dívida/adiantamento) ou descrição (observação). */
  reason?: string
  category?: AdvanceCategory | null
  status: TransactionStatus
  paymentDetails?: PaymentDetails | null
  /** Para adiantamentos/dívidas: id do pagamento que os quitou. */
  settledByPaymentId?: string | null
  /** Auditoria — quem lançou. */
  responsibleUserId?: string
  responsibleName?: string
  deletedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface Employee {
  _id?: string
  userId?: string
  fullName: string
  /** Apenas dígitos (11). Formatado para exibição via formatCPF. */
  cpf: string
  birthDate?: string | null
  phone?: string
  address?: string
  role: string
  admissionDate?: string | null
  notes?: string
  paymentType: PaymentType
  baseSalary: number
  nextPaymentDate?: string | null
  active?: boolean
  deletedAt?: string | null
  createdByUserId?: string
  createdByName?: string
  createdAt?: string
  updatedAt?: string

  // Campos computados pela API (não persistidos no documento Employee):
  /** Soma de adiantamentos pendentes. */
  pendingAdvancesTotal?: number
  /** Soma de dívidas pendentes. */
  pendingDebtsTotal?: number
  /** Valor líquido previsto para o próximo pagamento. */
  netForecast?: number
  /** Diaristas: dias trabalhados no ciclo aberto (presenças não pagas). */
  workedDays?: number
  /** Diaristas: valor bruto acumulado (workedDays × baseSalary). */
  accumulatedValue?: number
}

/** Registro de presença de um diarista num dia. */
export interface Attendance {
  _id?: string
  userId?: string
  employeeId: string
  date: string
  present: boolean
  settledByPaymentId?: string | null
  responsibleName?: string
  createdAt?: string
  updatedAt?: string
}

/** Linha do registro de presença (roll-call) por dia. */
export interface AttendanceRow {
  employeeId: string
  fullName: string
  role: string
  paymentType: PaymentType
  baseSalary: number
  /** Valor de um dia (diária, ou salário ÷ dias do período). */
  dailyRate: number
  present: boolean
}

/** Totais financeiros computados de um funcionário. */
export interface EmployeeFinancials {
  pendingAdvancesTotal: number
  pendingDebtsTotal: number
  totalDiscountsPending: number
  /** Base − descontos pendentes (mínimo 0). Para diaristas, base = valor acumulado. */
  netForecast: number
  nextPaymentDate: string | null
  /** Valor de um dia de trabalho (diária ou salário ÷ dias do período). */
  dailyRate?: number
  /** Diaristas: dias trabalhados no ciclo aberto. */
  workedDays?: number
  /** Diaristas: valor bruto acumulado (workedDays × baseSalary). */
  accumulatedValue?: number
  /** Demais tipos: faltas no ciclo aberto e valor a descontar por elas. */
  absenceDays?: number
  absenceDeduction?: number
}

/** Payload de GET /api/funcionarios/[id]. */
export interface EmployeeDetail {
  employee: Employee
  transactions: EmployeeTransaction[]
  financials: EmployeeFinancials
}

/** Payload de GET /api/funcionarios/dashboard. */
export interface EmployeesDashboard {
  totalEmployees: number
  payrollTotal: number
  pendingAdvancesTotal: number
  pendingDebtsTotal: number
  upcomingPayments: Array<{
    employeeId: string
    fullName: string
    role: string
    nextPaymentDate: string | null
    netForecast: number
  }>
  monthlyPayments: Array<{ month: string; total: number; count: number }>
  advancesByEmployee: Array<{ fullName: string; total: number }>
}