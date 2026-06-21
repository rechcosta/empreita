'use client'

import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import { Employee, EmployeeTransaction, CompanyInfo } from '@/types'
import { formatCurrency, formatCPF, formatDate } from './utils'
import { PAYMENT_TYPE_LABELS } from './payroll'

/**
 * Gera o comprovante de pagamento em PDF (client-side, igual ao orçamento).
 *
 * Estrutura: cabeçalho da empresa (logo, nome, CNPJ, endereço, telefone),
 * dados do funcionário, detalhamento financeiro (base, descontos, líquido),
 * rodapé com data, assinaturas e QR Code de validação.
 *
 * Assíncrona porque a geração do QR Code (`qrcode`) é assíncrona.
 */
export async function generateComprovantePDF(
  payment: EmployeeTransaction,
  employee: Employee,
  company: CompanyInfo
): Promise<void> {
  const details = payment.paymentDetails
  if (!details) throw new Error('Comprovante exige um lançamento de pagamento.')

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const ML = 16
  const MR = 16
  const innerWidth = pageWidth - ML - MR

  // ── Palette (alinhada ao orçamento) ─────────────────────────
  const inkDark: [number, number, number] = [17, 24, 39]
  const inkMid: [number, number, number] = [55, 65, 81]
  const inkLight: [number, number, number] = [107, 114, 128]
  const inkMuted: [number, number, number] = [156, 163, 175]
  const stripe1: [number, number, number] = [250, 250, 250]
  const border: [number, number, number] = [229, 231, 235]
  const accent: [number, number, number] = [255, 122, 0]
  const accentSoft: [number, number, number] = [255, 244, 230]
  const accentText: [number, number, number] = [138, 62, 0]
  const danger: [number, number, number] = [185, 28, 28]

  const setInk = (rgb: [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2])
  const setFill = (rgb: [number, number, number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2])
  const setStroke = (rgb: [number, number, number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2])

  function sectionLabel(text: string, x: number, y: number) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    setInk(inkLight)
    doc.setCharSpace(0.8)
    doc.text(text.toUpperCase(), x, y)
    doc.setCharSpace(0)
  }

  // ═══════════ HEADER ══════════════════════════════════════════
  const headerTop = 14
  let logoEndX = ML

  if (company.logoBase64) {
    try {
      const imgFormat = company.logoBase64.includes('data:image/png') ? 'PNG' : 'JPEG'
      const imgData = company.logoBase64.includes('base64,')
        ? company.logoBase64.split('base64,')[1]
        : company.logoBase64
      doc.addImage(imgData, imgFormat, ML, headerTop, 12, 12)
      logoEndX = ML + 12 + 4
    } catch {
      /* skip */
    }
  } else {
    setFill(accent)
    doc.roundedRect(ML, headerTop, 12, 12, 2, 2, 'F')
    logoEndX = ML + 12 + 4
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  setInk(inkDark)
  doc.text(company.companyName, logoEndX, headerTop + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  setInk(inkLight)
  let companyLineY = headerTop + 9.5
  doc.text(`CNPJ: ${company.cnpj}`, logoEndX, companyLineY)
  if (company.address) {
    companyLineY += 3.8
    doc.text(company.address, logoEndX, companyLineY)
  }
  if (company.phone) {
    companyLineY += 3.8
    doc.text(`Tel: ${company.phone}`, logoEndX, companyLineY)
  }

  // Tipo + número do comprovante à direita
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  setInk(inkLight)
  doc.setCharSpace(0.8)
  doc.text('COMPROVANTE', pageWidth - MR, headerTop + 3, { align: 'right' })
  doc.setCharSpace(0)

  const receiptNo = (payment._id ?? '').toUpperCase().slice(-8).replace(/(.{4})(.+)/, '$1-$2')
  doc.setFont('courier', 'normal')
  doc.setFontSize(10)
  setInk(inkDark)
  doc.text(`Nº ${receiptNo || 'NOVO'}`, pageWidth - MR, headerTop + 8, { align: 'right' })

  const payDateStr = payment.date ? formatDate(payment.date) : formatDate(new Date().toISOString())
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  setInk(inkLight)
  doc.text(payDateStr, pageWidth - MR, headerTop + 12.5, { align: 'right' })

  const ruleY = Math.max(headerTop + 16, companyLineY + 3)
  setFill(accent)
  doc.rect(ML, ruleY, innerWidth, 0.8, 'F')

  // ═══════════ TÍTULO ══════════════════════════════════════════
  let y = ruleY + 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  setInk(inkDark)
  doc.text('Comprovante de pagamento', ML, y)
  y += 11

  // ═══════════ DADOS DO FUNCIONÁRIO ════════════════════════════
  sectionLabel('Funcionário', ML, y)
  y += 6

  const labelCol = 26
  const rowGap = 5.5
  const line = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setInk(inkLight)
    doc.text(label, ML, y)
    setInk(inkDark)
    doc.setFont('helvetica', 'bold')
    doc.text(value || '—', ML + labelCol, y)
    y += rowGap
  }
  line('Nome', employee.fullName)
  line('CPF', employee.cpf ? formatCPF(employee.cpf) : '—')
  line('Cargo', employee.role)
  line('Pagamento', PAYMENT_TYPE_LABELS[employee.paymentType])
  y += 6

  // ═══════════ DADOS FINANCEIROS ═══════════════════════════════
  sectionLabel('Dados financeiros', ML, y)
  y += 4

  const valueRow = (label: string, value: string, opts?: { color?: [number, number, number] }) => {
    setFill(stripe1)
    setStroke(border)
    doc.setLineWidth(0.2)
    doc.rect(ML, y, innerWidth, 9, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setInk(inkMid)
    doc.text(label, ML + 3, y + 5.8)
    doc.setFont('helvetica', 'bold')
    setInk(opts?.color ?? inkDark)
    doc.text(value, pageWidth - MR - 3, y + 5.8, { align: 'right' })
    y += 9
  }

  if (details.daysWorked !== undefined && details.daysWorked !== null && details.dailyRate) {
    valueRow('Dias trabalhados', `${details.daysWorked} × ${formatCurrency(details.dailyRate)}`)
    valueRow('Total bruto', formatCurrency(details.baseSalary))
  } else {
    valueRow('Salário base', formatCurrency(details.baseSalary))
    if (details.absenceDays && details.absenceDeduction && details.dailyRate) {
      valueRow(
        `Faltas (${details.absenceDays} × ${formatCurrency(details.dailyRate)})`,
        `− ${formatCurrency(details.absenceDeduction)}`,
        { color: danger }
      )
    }
  }
  valueRow(
    'Adiantamentos descontados',
    details.advancesDiscounted > 0 ? `− ${formatCurrency(details.advancesDiscounted)}` : formatCurrency(0),
    { color: details.advancesDiscounted > 0 ? danger : inkMuted }
  )
  valueRow(
    'Dívidas descontadas',
    details.debtsDiscounted > 0 ? `− ${formatCurrency(details.debtsDiscounted)}` : formatCurrency(0),
    { color: details.debtsDiscounted > 0 ? danger : inkMuted }
  )
  y += 5

  // ── Caixa do valor líquido pago ──
  const totalBoxH = 16
  setFill(accentSoft)
  doc.rect(ML, y, innerWidth, totalBoxH, 'F')
  setFill(accent)
  doc.rect(ML, y, 2, totalBoxH, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  setInk(accentText)
  doc.setCharSpace(0.8)
  doc.text('VALOR LÍQUIDO PAGO', ML + 7, y + 6.5)
  doc.setCharSpace(0)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  setInk(inkDark)
  doc.text(formatCurrency(details.netAmount), pageWidth - MR - 4, y + 11, { align: 'right' })
  y += totalBoxH + 6

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  setInk(inkLight)
  doc.text(
    `Líquido = Salário base − adiantamentos − dívidas (descontos: ${formatCurrency(details.totalDiscounts)}).`,
    ML,
    y
  )

  // ═══════════ QR CODE DE VALIDAÇÃO ════════════════════════════
  // Codifica a URL da página do comprovante. Ao escanear no celular, o
  // navegador abre /comprovante/[id], que regenera e baixa o PDF. Quando não
  // há origin disponível (ambiente sem window), cai num payload textual.
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : ''
  const qrPayload =
    origin && payment._id
      ? `${origin}/comprovante/${payment._id}`
      : [
          'EMPREITA',
          'COMPROVANTE',
          `id:${payment._id ?? ''}`,
          `liquido:${details.netAmount.toFixed(2)}`,
          `data:${payDateStr}`,
        ].join('|')

  let qrDataUrl = ''
  try {
    qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 0, width: 200 })
  } catch {
    /* se falhar, segue sem QR */
  }

  // ═══════════ ASSINATURAS + RODAPÉ (ancorados ao fim) ═════════
  const footerY = pageHeight - 12
  const qrSize = 26
  const qrX = pageWidth - MR - qrSize
  const qrTop = footerY - 6 - qrSize

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', qrX, qrTop, qrSize, qrSize)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    setInk(inkMuted)
    doc.text('Escaneie p/ baixar', qrX + qrSize / 2, qrTop + qrSize + 3, { align: 'center' })
  }

  // Linhas de assinatura (empresa + funcionário) à esquerda do QR
  const sigLineY = qrTop + qrSize - 4
  const colGap = 12
  const sigAreaWidth = qrDataUrl ? innerWidth - qrSize - 10 : innerWidth
  const sigColW = (sigAreaWidth - colGap) / 2

  setStroke(inkMid)
  doc.setLineWidth(0.3)
  doc.line(ML, sigLineY, ML + sigColW, sigLineY)
  doc.line(ML + sigColW + colGap, sigLineY, ML + sigColW + colGap + sigColW, sigLineY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(inkLight)
  doc.text('Assinatura da empresa', ML + sigColW / 2, sigLineY + 4, { align: 'center' })
  doc.text(
    'Assinatura do funcionário',
    ML + sigColW + colGap + sigColW / 2,
    sigLineY + 4,
    { align: 'center' }
  )

  // Data do pagamento acima das assinaturas
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  setInk(inkMid)
  doc.text(`Data do pagamento: ${payDateStr}`, ML, qrTop - 4)

  // ── Rodapé ──
  setStroke(border)
  doc.setLineWidth(0.3)
  doc.line(ML, footerY, pageWidth - MR, footerY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  setInk(inkMuted)
  doc.text(
    `comprovante gerado por empreita, gestão de funcionários - ${company.companyName}`,
    pageWidth / 2,
    footerY + 5,
    { align: 'center' }
  )

  const safeName = employee.fullName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
  doc.save(`comprovante_${safeName}.pdf`)
}
